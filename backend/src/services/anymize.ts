const ANYMIZE_API_BASE_URL = 'https://app.anymize.ai/api';
const POLL_INTERVAL_MS = 500;
const MAX_POLL_ATTEMPTS = 40;
const NETWORK_RETRY_ATTEMPTS = 3;

type AnymizeJob = {
  job_id?: unknown;
  status?: unknown;
  anonymized_text_raw?: unknown;
  error?: unknown;
};

type AnymizeHashPair = {
  placeholder?: unknown;
  original?: unknown;
};

function getApiKey(): string {
  const apiKey = process.env.ANYMIZE_API_KEY;
  if (!apiKey) {
    throw new Error('ANYMIZE_API_KEY is required to anonymize team-process descriptions.');
  }
  return apiKey;
}

async function requestAnymize(path: string, options: RequestInit): Promise<unknown> {
  let response: Response;

  for (let attempt = 0; attempt < NETWORK_RETRY_ATTEMPTS; attempt += 1) {
    try {
      response = await fetch(`${ANYMIZE_API_BASE_URL}${path}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${getApiKey()}`,
          ...options.headers,
        },
      });
      const body: unknown = await response.json().catch(() => undefined);
      if (!response.ok) {
        const message =
          typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string'
            ? body.error
            : `Anymize request failed with status ${response.status}.`;
        throw new Error(message);
      }
      return body;
    } catch (error) {
      if (error instanceof Error && !error.message.includes('fetch failed')) throw error;
      if (attempt < NETWORK_RETRY_ATTEMPTS - 1) {
        await wait(400 * (attempt + 1));
      }
    }
  }

  throw new Error('Could not reach Anymize after several attempts. Check the network connection and restart the backend.');
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForCompletedJob(jobId: string): Promise<AnymizeJob> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
    const job = (await requestAnymize(`/status/${encodeURIComponent(jobId)}`, {
      method: 'GET',
    })) as AnymizeJob;

    if (job.status === 'completed' && typeof job.anonymized_text_raw === 'string') {
      return job;
    }
    if (job.status === 'failed' || job.status === 'error') {
      throw new Error(typeof job.error === 'string' ? job.error : 'Anymize could not anonymize the text.');
    }
    await wait(POLL_INTERVAL_MS);
  }
  throw new Error('Anymize did not complete the anonymization request in time.');
}

async function getRestoreMap(jobId: string): Promise<Record<string, string>> {
  const result = (await requestAnymize(`/status/${encodeURIComponent(jobId)}/strings`, {
    method: 'GET',
  })) as { hash_pairs?: unknown };

  if (!Array.isArray(result.hash_pairs)) return {};

  return result.hash_pairs.reduce<Record<string, string>>((map, pair) => {
    const hashPair = pair as AnymizeHashPair;
    if (typeof hashPair.placeholder === 'string' && typeof hashPair.original === 'string') {
      map[hashPair.placeholder] = hashPair.original;
    }
    return map;
  }, {});
}

/**
 * Sends text to Anymize, waits for the asynchronous job, and returns only the
 * placeholder version plus the in-memory data needed to restore it later.
 */
export async function anonymizeText(
  text: string,
): Promise<{ anonymized: string; restoreMap: object }> {
  const startedJob = (await requestAnymize('/anonymize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })) as AnymizeJob;

  if (typeof startedJob.job_id !== 'string') {
    throw new Error('Anymize did not return an anonymization job ID.');
  }

  const completedJob = await waitForCompletedJob(startedJob.job_id);
  return {
    anonymized: completedJob.anonymized_text_raw as string,
    restoreMap: await getRestoreMap(startedJob.job_id),
  };
}

/** Replaces Anymize placeholders with their original values using an in-memory map. */
export function restoreText(text: string, restoreMap: object): string {
  const replacements = Object.entries(restoreMap as Record<string, unknown>)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    .sort(([left], [right]) => right.length - left.length);

  return replacements.reduce(
    (restored, [placeholder, original]) => restored.split(placeholder).join(original),
    text,
  );
}
