import OpenAI from 'openai';
import type { Finding, TeamProcess } from '../../../shared/types';
import { PROCESS_ANALYSIS_SYSTEM_PROMPT } from '../prompts/process-analysis';

const validStatuses = new Set<Finding['status']>(['working', 'gap']);
const validSeverities = new Set<Finding['severity']>([
  'tolerate',
  'todo',
  'possible_showstopper',
]);

function isFinding(value: unknown): value is Finding {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    validStatuses.has(candidate.status as Finding['status']) &&
    validSeverities.has(candidate.severity as Finding['severity']) &&
    typeof candidate.description === 'string' &&
    Array.isArray(candidate.teams_involved) &&
    candidate.teams_involved.every((team) => typeof team === 'string')
  );
}

function parseFindings(rawOutput: string): Finding[] {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawOutput);
  } catch {
    throw new Error('The process-analysis model returned invalid JSON.');
  }

  if (!Array.isArray(parsed) || !parsed.every(isFinding)) {
    throw new Error('The process-analysis model returned data outside the Finding schema.');
  }

  return parsed;
}

/**
 * Sends all team processes together to OpenAI and returns validated findings.
 */
export async function analyzeProcesses(processes: TeamProcess[]): Promise<Finding[]> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required to analyze team processes.');
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL || 'gpt-5',
      instructions: PROCESS_ANALYSIS_SYSTEM_PROMPT,
      input: JSON.stringify(processes),
      store: false,
    });

    if (!response.output_text) {
      throw new Error('The process-analysis model returned an empty response.');
    }

    return parseFindings(response.output_text);
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof Error) {
      throw error;
    }

    throw new Error('Unable to analyze team processes.');
  }
}
