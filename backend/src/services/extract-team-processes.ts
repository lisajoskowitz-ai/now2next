import OpenAI from 'openai';
import type { TeamProcess, TeamProcessDescription } from '../../../shared/types';
import { PROCESS_EXTRACTION_SYSTEM_PROMPT } from '../prompts/process-extraction';

export function isTeamProcess(value: unknown): value is TeamProcess {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.team === 'string' &&
    typeof candidate.booking_owner === 'string' &&
    typeof candidate.booking_channel === 'string' &&
    typeof candidate.approval_timing === 'string' &&
    typeof candidate.approval_steps === 'number' &&
    Number.isInteger(candidate.approval_steps) &&
    candidate.approval_steps >= 0 &&
    typeof candidate.policy_check === 'string' &&
    typeof candidate.expense_submission === 'string' &&
    typeof candidate.processing_time_days === 'string' &&
    Array.isArray(candidate.systems_used) &&
    candidate.systems_used.every((system) => typeof system === 'string')
  );
}

function parseTeamProcesses(rawOutput: string, descriptions: TeamProcessDescription[]): TeamProcess[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawOutput);
  } catch {
    throw new Error('The process-extraction model returned invalid JSON.');
  }

  if (
    !Array.isArray(parsed) ||
    parsed.length !== descriptions.length ||
    !parsed.every(isTeamProcess) ||
    !parsed.every((process, index) => process.team === descriptions[index].team)
  ) {
    throw new Error('The process-extraction model returned data outside the TeamProcess schema.');
  }
  return parsed;
}

/** Converts all submitted descriptions into validated structured team processes. */
export async function extractTeamProcesses(descriptions: TeamProcessDescription[]): Promise<TeamProcess[]> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required to analyze team processes.');
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.responses.create({
    model: process.env.OPENAI_MODEL || 'gpt-5',
    instructions: PROCESS_EXTRACTION_SYSTEM_PROMPT,
    input: JSON.stringify(descriptions),
    store: false,
  });

  if (!response.output_text) throw new Error('The process-extraction model returned an empty response.');
  return parseTeamProcesses(response.output_text, descriptions);
}
