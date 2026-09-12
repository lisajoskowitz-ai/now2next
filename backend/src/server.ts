import cors from 'cors';
import express from 'express';
import type { HealthResponse } from '../../shared/types';

const app = express();
const port = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (_request, response) => {
  const body: HealthResponse = { message: 'now2next API is running' };
  response.json(body);
});

app.listen(port, () => {
  console.log(`now2next API listening on http://localhost:${port}`);
});
