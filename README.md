# now2next

AI hackathon project: turns team process interviews into an AI implementation plan.

This repository starts with a small full-stack TypeScript application.

## Folders

- `frontend/` — the React user interface, styled with Tailwind CSS.
- `backend/` — the Express server and API routes.
- `shared/` — TypeScript types that can be used by both the frontend and backend.

## Run locally

Install dependencies, then start the frontend and backend together:

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. The backend health endpoint is at `http://localhost:3001/api/health`.
