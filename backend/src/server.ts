import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import path from 'node:path';
import type {
  HealthResponse,
  ProcessPipelineResult,
  TeamProcess,
  TeamProcessDescription,
} from '../../shared/types';
import { analyzeProcesses } from './services/analyze-processes';
import { anonymizeText } from './services/anymize';
import { extractTeamProcesses, isTeamProcess } from './services/extract-team-processes';
import { generateRecommendations } from './services/generate-recommendations';
import { createTargetProcess } from './services/target-process';
import { createBusinessCase, createToolFitAnalysis } from './services/decision-support';
import { askAnalysisAssistant } from './services/analysis-assistant';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

const app = express();
const port = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (_request, response) => {
  const body: HealthResponse = { message: 'now2next API is running' };
  response.json(body);
});

async function anonymizeDescriptions(descriptions: TeamProcessDescription[]) {
  // Submit one batch rather than six parallel jobs for three teams. This is
  // faster and avoids overloading a corporate proxy or the Anymize API.
  const teamAliases = descriptions.map((description, index) => ({
    team: description.team,
    alias: `[Team ${String.fromCharCode(65 + index)}]`,
  }));
  const protectedInput = descriptions.map((description, index) => ({
    team: teamAliases[index].alias,
    description: teamAliases.reduce(
      (text, item) => text.split(item.team).join(item.alias),
      description.description,
    ),
  }));
  const { anonymized } = await anonymizeText(JSON.stringify(protectedInput));
  const parsed: unknown = JSON.parse(anonymized);

  if (
    !Array.isArray(parsed) ||
    parsed.length !== descriptions.length ||
    !parsed.every(
      (item): item is TeamProcessDescription =>
        typeof item === 'object' &&
        item !== null &&
        typeof item.team === 'string' &&
        typeof item.description === 'string',
    )
  ) {
    throw new Error('Could not safely prepare the interview notes for analysis.');
  }

  return { anonymizedDescriptions: parsed };
}

async function buildDecisionCanvas(processes: TeamProcess[]): Promise<ProcessPipelineResult> {
  const findings = await analyzeProcesses(processes);
  const recommendations = await generateRecommendations(findings);
  return {
    processes,
    findings,
    recommendations,
    target_process: createTargetProcess(findings),
    business_case: createBusinessCase(processes, findings),
    tool_fit: createToolFitAnalysis(processes, recommendations),
  };
}

app.post('/api/process-pipeline', async (request, response) => {
  const descriptions = request.body?.teams;

  if (
    !Array.isArray(descriptions) ||
    descriptions.length < 1 ||
    descriptions.length > 3 ||
    !descriptions.every(
      (item): item is TeamProcessDescription =>
        typeof item === 'object' &&
        item !== null &&
        typeof item.team === 'string' &&
        item.team.trim().length > 0 &&
        typeof item.description === 'string' &&
        item.description.trim().length > 0,
    )
  ) {
    response.status(400).json({
      message: 'Submit between one and three teams, each with a name and a description.',
    });
    return;
  }

  try {
    const { anonymizedDescriptions } = await anonymizeDescriptions(descriptions);
    const processes = await extractTeamProcesses(anonymizedDescriptions);
    const result = await buildDecisionCanvas(processes);
    // The Decision Canvas is intentionally kept anonymized. It is the payload
    // displayed from "Current state" onward and is also reused by the assistant.
    response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to analyze the team processes.';
    response.status(500).json({ message });
  }
});

app.post('/api/reanalyze-processes', async (request, response) => {
  const processes = request.body?.processes;

  if (!Array.isArray(processes) || processes.length < 1 || processes.length > 3 || !processes.every(isTeamProcess)) {
    response.status(400).json({ message: 'Submit between one and three complete team processes.' });
    return;
  }

  try {
    // Structured facts can contain identifying team or system names, so protect
    // the whole payload before it reaches the analysis model.
    const { anonymized } = await anonymizeText(JSON.stringify(processes));
    const anonymizedProcesses: unknown = JSON.parse(anonymized);
    if (!Array.isArray(anonymizedProcesses) || !anonymizedProcesses.every(isTeamProcess)) {
      throw new Error('Could not safely prepare the updated process facts for analysis.');
    }

    const result = await buildDecisionCanvas(anonymizedProcesses);
    response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update the decision canvas.';
    response.status(500).json({ message });
  }
});

app.post('/api/analysis-assistant', async (request, response) => {
  const question = request.body?.question;
  const decisionCanvas = request.body?.decision_canvas;

  if (typeof question !== 'string' || question.trim().length === 0 || question.length > 1_500 || typeof decisionCanvas !== 'object' || decisionCanvas === null) {
    response.status(400).json({ message: 'Submit a question and the current Decision Canvas.' });
    return;
  }

  const serializedContext = JSON.stringify(decisionCanvas);
  if (serializedContext.length > 150_000) {
    response.status(400).json({ message: 'The current Decision Canvas is too large to send to the assistant.' });
    return;
  }

  try {
    // One protected batch keeps the assistant reliable even on constrained
    // corporate networks and ensures question and context share one map.
    const protectedPayload = await anonymizeText(JSON.stringify({ question, decision_canvas: decisionCanvas }));
    const parsed: unknown = JSON.parse(protectedPayload.anonymized);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('question' in parsed) ||
      !('decision_canvas' in parsed) ||
      typeof parsed.question !== 'string'
    ) {
      throw new Error('Could not safely prepare the assistant request.');
    }
    const answer = await askAnalysisAssistant(parsed.question, parsed.decision_canvas);
    // Keep generated text in its anonymized form too: answers appear within the
    // same privacy-safe Decision Canvas.
    response.json(answer);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to answer the analysis question.';
    response.status(500).json({ message });
  }
});

app.listen(port, () => {
  console.log(`now2next API listening on http://localhost:${port}`);
});
