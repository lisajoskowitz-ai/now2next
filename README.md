# Now2Next

Now2Next helps organizations turn fragmented team processes into a practical implementation plan. Teams describe how they work today in plain language; Now2Next compares the anonymized process data, highlights gaps, proposes a shared target process, and creates prioritized next steps.

The current prototype uses employee-expense processes as its example, but the workflow is designed for cross-team process improvement more broadly.

## Why Now2Next

The same business process is often handled differently across teams. This leads to manual work, delayed decisions, unclear ownership, compliance risk, and difficult implementation discussions. Now2Next gives stakeholders one structured basis for deciding what to standardize and what to change first.

## Workflow

1. **Describe the current process** — each team enters its process in plain language.
2. **Protect sensitive information** — [anymize](https://anymize.ai/) removes names, team identifiers, email addresses, phone numbers, and other identifying information before AI analysis.
3. **Review extracted process data** — the submitted descriptions are converted into structured process facts that users can validate and correct.
4. **Compare the current state** — teams are compared across responsibilities, approval steps, systems, policy checks, submission methods, and processing time.
5. **Prioritize what matters** — findings include evidence, confidence, stakeholder review, and validation prompts.
6. **Define the target process and action plan** — the app creates a shared process design plus prioritized work packages with owners, dependencies, effort, and success metrics.
7. **Ask the Decision Assistant** — users can ask questions about the anonymized Decision Canvas and receive answers grounded in the analysis.

## Privacy by design

Privacy is part of the workflow, not an afterthought:

- The backend sends submitted free-text process descriptions to [anymize](https://anymize.ai/) before they reach the analysis model.
- From **Current state** onward, the Decision Canvas remains anonymized. Team references use aliases such as `[Team A]`.
- If users update extracted facts, the full structured payload is anonymized again before re-analysis.
- Questions and context sent to the Decision Assistant are also anonymized. Generated answers remain anonymized.
- `OPENAI_API_KEY` and `ANYMIZE_API_KEY` are read only on the backend. The local `.env` file is ignored by Git and is never included in the frontend build or GitHub Pages deployment.

## Architecture

| Layer | Technology | Responsibility |
| --- | --- | --- |
| Frontend | React, Vite, Tailwind CSS | Process intake, review, Decision Canvas, and assistant interface |
| Backend | Express, TypeScript | API routes, anonymization orchestration, analysis, and recommendations |
| AI | OpenAI Responses API | Process extraction, gap analysis, recommendations, and Decision Assistant |
| Privacy | [anymize](https://anymize.ai/) | Anonymization of process data before AI processing |

## Repository structure

```text
frontend/  React user interface
backend/   Express API and AI/privacy services
shared/    TypeScript types shared by frontend and backend
```

## Run locally

### Prerequisites

- Node.js 20 or newer
- An OpenAI API key
- An [anymize](https://anymize.ai/) API key

### 1. Install dependencies

From the repository root:

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env` and add the two API keys:

```env
OPENAI_API_KEY=your_openai_api_key_here
ANYMIZE_API_KEY=your_anymize_api_key_here
```

Optionally select an OpenAI model:

```powershell
$env:OPENAI_MODEL = "gpt-5"
```

### 3. Start the application

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The backend health endpoint is available at [http://localhost:3001/api/health](http://localhost:3001/api/health).

## GitHub Pages preview

The repository includes a GitHub Actions workflow that builds and publishes the frontend to:

[https://lisajoskowitz-ai.github.io/now2next/](https://lisajoskowitz-ai.github.io/now2next/)

This is a **static UI preview only**. GitHub Pages cannot host the Express API or securely provide the OpenAI and anymize environment variables. A fully functional public deployment requires a separately hosted backend with those secrets configured as server-side environment variables.

## Hackathon submission assets

- Public repository with full event commit history
- Product demo recording
- Short pitch deck
- One-pager with product description and tools used
- Social-media slide with product screenshot, logo, and claim
