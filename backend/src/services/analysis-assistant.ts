import OpenAI from 'openai';
import type { AnalysisAssistantAnswer } from '../../../shared/types';
import { ANALYSIS_ASSISTANT_SYSTEM_PROMPT } from '../prompts/analysis-assistant';

function isAssistantAnswer(value: unknown): value is AnalysisAssistantAnswer {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.short_answer === 'string' &&
    typeof candidate.why_it_matters === 'string' &&
    Array.isArray(candidate.evidence) &&
    candidate.evidence.every((item) => typeof item === 'string') &&
    typeof candidate.validation_note === 'string' &&
    typeof candidate.recommended_next_action === 'string'
  );
}

/** Answers a question only from the protected Decision Canvas supplied by the user. */
export async function askAnalysisAssistant(question: string, decisionCanvas: unknown): Promise<AnalysisAssistantAnswer> {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is required to answer analysis questions.');

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.responses.create({
    model: process.env.OPENAI_MODEL || 'gpt-5',
    instructions: ANALYSIS_ASSISTANT_SYSTEM_PROMPT,
    input: JSON.stringify({ question, decision_canvas: decisionCanvas }),
    store: false,
  });

  if (!response.output_text) throw new Error('The Decision Assistant returned an empty response.');

  try {
    const parsed: unknown = JSON.parse(response.output_text);
    if (!isAssistantAnswer(parsed)) throw new Error();
    return parsed;
  } catch {
    throw new Error('The Decision Assistant returned data outside the expected response format.');
  }
}
