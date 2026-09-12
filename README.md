# now2next

AI hackathon project: turns team process interviews into an AI implementation plan.

This repository starts with a small full-stack TypeScript application.

## Folders

- `frontend/` — the React user interface, styled with Tailwind CSS.
- `backend/` — the Express server and API routes.
- `shared/` — TypeScript types that can be used by both the frontend and backend.

## Run locally

### 1. Install dependencies

Install Node.js (which includes npm), then run this command from the repository
root. It installs the frontend, backend, OpenAI SDK, and `tsx` development
runner:

```bash
npm install
```

### 2. Configure the OpenAI API key

The process-analysis and recommendation services require an API key. Set it in
your shell before starting the backend; do not commit it to the repository.

```powershell
$env:OPENAI_API_KEY = "your_api_key_here"
```

Optionally choose a model:

```powershell
$env:OPENAI_MODEL = "gpt-5"
```

### 3. Start the application

Start the frontend and backend together:

```bash
npm run dev
```

Open `http://localhost:5173`. The backend health endpoint is at `http://localhost:3001/api/health`.
