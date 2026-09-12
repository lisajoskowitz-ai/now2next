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

### 2. Configure API keys

Copy `.env.example` to a file named `.env` in the repository root, then replace
both placeholders. If `.env` already exists, add the `ANYMIZE_API_KEY` line to
that file. Do not commit `.env`.

```env
OPENAI_API_KEY=your_openai_api_key_here
ANYMIZE_API_KEY=your_anymize_api_key_here
```

`ANYMIZE_API_KEY` protects the free-text descriptions: the backend sends each
description to Anymize first, sends only its placeholders to OpenAI, then restores
the original values only in the response shown to the user.

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
