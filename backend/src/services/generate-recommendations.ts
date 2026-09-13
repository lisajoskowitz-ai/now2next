import OpenAI from 'openai';
import type { Finding, Recommendation } from '../../../shared/types';
import { RECOMMENDATIONS_SYSTEM_PROMPT } from '../prompts/recommendations';

const validFixTypes = new Set<Recommendation['fix_type']>(['ai', 'non_ai']);
const validPriorities = new Set<Recommendation['priority']>(['now', 'next', 'later']);
const validEfforts = new Set<Recommendation['effort']>(['low', 'medium', 'high']);

function isRecommendation(value: unknown): value is Recommendation {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const hasOwnerActions =
    Array.isArray(candidate.process_owner_actions) &&
    candidate.process_owner_actions.length >= 2 &&
    candidate.process_owner_actions.length <= 3 &&
    candidate.process_owner_actions.every((action) => typeof action === 'string' && action.trim().length > 0);
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
    typeof candidate.title !== 'string' ||
    candidate.title.trim().length === 0 ||
    !validFixTypes.has(candidate.fix_type as Recommendation['fix_type']) ||
    !validPriorities.has(candidate.priority as Recommendation['priority']) ||
    typeof candidate.owner !== 'string' ||
    candidate.owner.trim().length === 0 ||
    !Array.isArray(candidate.dependencies) ||
    candidate.dependencies.length > 3 ||
    !candidate.dependencies.every((dependency) => typeof dependency === 'string') ||
    !validEfforts.has(candidate.effort as Recommendation['effort']) ||
    typeof candidate.success_metric !== 'string' ||
    candidate.success_metric.trim().length === 0 ||
    typeof candidate.ai_optimization !== 'string' ||
    candidate.ai_optimization.trim().length === 0 ||
    !hasOwnerActions ||
    !hasValidSteps ||
    typeof candidate.target_process_contribution !== 'string' ||
    candidate.target_process_contribution.trim().length === 0
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
    !findings.filter((finding) => finding.rating === 'gap' && finding.severity !== 'tolerate').every((finding) =>
      parsed.some((recommendation) => recommendation.finding_reference === finding.reasoning),
    ) ||
    parsed.some((recommendation) => {
      const finding = findings.find((item) => item.reasoning === recommendation.finding_reference);
      return !finding || finding.rating !== 'gap' || finding.severity === 'tolerate';
    })
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
    input: JSON.stringify(findings.filter((finding) => finding.rating === 'gap' && finding.severity !== 'tolerate')),
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
