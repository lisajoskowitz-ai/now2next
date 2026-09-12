import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import path from 'node:path';
import type {
  HealthResponse,
  ProcessPipelineResult,
  TeamProcessDescription,
} from '../../shared/types';
import { analyzeProcesses } from './services/analyze-processes';
import { anonymizeText, restoreText } from './services/anymize';
import { extractTeamProcesses } from './services/extract-team-processes';
import { generateRecommendations } from './services/generate-recommendations';

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
  const restoreMap: Record<string, string> = {};
  const anonymizedDescriptions = await Promise.all(
    descriptions.map(async (description, index) => {
      const [anonymizedTeam, anonymizedDescription] = await Promise.all([
        anonymizeText(description.team),
        anonymizeText(description.description),
      ]);
      Object.assign(restoreMap, anonymizedTeam.restoreMap, anonymizedDescription.restoreMap);

      // Team names are aliases even when Anymize does not classify them as personal data.
      const teamAlias = `[[TeamRef-${index + 1}]]`;
      restoreMap[teamAlias] = description.team;
      return { team: teamAlias, description: anonymizedDescription.anonymized };
    }),
  );
  return { anonymizedDescriptions, restoreMap };
}

function restoreResult(result: ProcessPipelineResult, restoreMap: object): ProcessPipelineResult {
  function restoreValue(value: unknown): unknown {
    if (typeof value === 'string') return restoreText(value, restoreMap);
    if (Array.isArray(value)) return value.map(restoreValue);
    if (typeof value === 'object' && value !== null) {
      return Object.fromEntries(
        Object.entries(value).map(([key, nestedValue]) => [key, restoreValue(nestedValue)]),
      );
    }
    return value;
  }

  return restoreValue(result) as ProcessPipelineResult;
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
    const { anonymizedDescriptions, restoreMap } = await anonymizeDescriptions(descriptions);
    const processes = await extractTeamProcesses(anonymizedDescriptions);
    const findings = await analyzeProcesses(processes);
    const recommendations = await generateRecommendations(findings);
    const result: ProcessPipelineResult = { findings, recommendations };
    response.json(restoreResult(result, restoreMap));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to analyze the team processes.';
    response.status(500).json({ message });
  }
});

app.listen(port, () => {
  console.log(`now2next API listening on http://localhost:${port}`);
});
