import OpenAI from 'openai';
import type { Finding, Recommendation } from '../../../shared/types';
import { RECOMMENDATIONS_SYSTEM_PROMPT } from '../prompts/recommendations';

const validFixTypes = new Set<Recommendation['fix_type']>(['ai', 'non_ai']);

function isRecommendation(value: unknown): value is Recommendation {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const hasValidSteps =
    Array.isArray(candidate.steps) &&
    candidate.steps.length >= 3 &&
    candidate.steps.length <= 4 &&
    candidate.steps.every(
      (step, index) =>
        typeof step === 'string' && step.startsWith(`${index + 1}. `),
    );

  if (
    typeof candidate.finding_reference !== 'string' ||
    !validFixTypes.has(candidate.fix_type as Recommendation['fix_type']) ||
    !hasValidSteps
  ) {
    return false;
  }

  if (candidate.fix_type === 'ai') {
    return typeof candidate.recommended_tool === 'string' && candidate.recommended_tool.length > 0;
  }

  return candidate.recommended_tool === undefined;
}

function parseRecommendations(
  rawOutput: string,
  findings: Finding[],
): Recommendation[] {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawOutput);
  } catch {
    throw new Error('The recommendation model returned invalid JSON.');
  }

  if (
    !Array.isArray(parsed) ||
    !parsed.every(isRecommendation) ||
    !parsed.every((recommendation) =>
      findings.some((finding) => finding.reasoning === recommendation.finding_reference),
    ) ||
    !findings.every((finding) =>
      parsed.some((recommendation) => recommendation.finding_reference === finding.reasoning),
    )
  ) {
    throw new Error('The recommendation model returned data outside the Recommendation schema.');
  }

  return parsed;
}

/** Sends findings to OpenAI and returns validated process recommendations. */
export async function generateRecommendations(
  findings: Finding[],
): Promise<Recommendation[]> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required to generate recommendations.');
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL || 'gpt-5',
      instructions: RECOMMENDATIONS_SYSTEM_PROMPT,
      input: JSON.stringify(findings),
      store: false,
    });

    if (!response.output_text) {
      throw new Error('The recommendation model returned an empty response.');
    }

    return parseRecommendations(response.output_text, findings);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }

    throw new Error('Unable to generate recommendations.');
  }
}
