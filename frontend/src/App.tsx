import { FormEvent, useState } from 'react';
import type {
  Finding,
  ProcessPipelineResult,
  Recommendation,
  TeamProcessDescription,
} from '../../shared/types';

const emptyTeam = (): TeamProcessDescription => ({ team: '', description: '' });

const severityStyles: Record<Finding['severity'], string> = {
  possible_showstopper: 'bg-rose-100 text-rose-800 ring-rose-200',
  todo: 'bg-amber-100 text-amber-800 ring-amber-200',
  tolerate: 'bg-slate-100 text-slate-700 ring-slate-200',
};

function label(value: string) {
  return value.replace(/_/g, ' ');
}

function relatedFinding(recommendation: Recommendation, findings: Finding[]) {
  return findings.find((finding) => finding.reasoning === recommendation.finding_reference);
}

function App() {
  const [teams, setTeams] = useState<TeamProcessDescription[]>([emptyTeam()]);
  const [result, setResult] = useState<ProcessPipelineResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateTeam(index: number, field: keyof TeamProcessDescription, value: string) {
    setTeams((current) => current.map((team, teamIndex) => teamIndex === index ? { ...team, [field]: value } : team));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResult(null);

    if (teams.some((team) => !team.team.trim() || !team.description.trim())) {
      setError('Add a team name and a process description for every team before analyzing.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/process-pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teams }),
      });
      const body = (await response.json()) as ProcessPipelineResult & { message?: string };
      if (!response.ok) throw new Error(body.message || 'The analysis could not be completed.');
      setResult(body);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The analysis could not be completed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-700">now2next</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Process gap explorer</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
            Paste a plain-language expense process for up to three teams. We will compare them together, identify gaps, and suggest practical next steps.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Team processes</h2>
                <p className="mt-1 text-sm text-slate-500">Include approvals, policy checks, receipts, timing, and systems where known.</p>
              </div>
              {teams.length < 3 && <button type="button" onClick={() => setTeams((current) => [...current, emptyTeam()])} className="rounded-lg border border-cyan-700 px-3 py-2 text-sm font-semibold text-cyan-800 transition hover:bg-cyan-50">+ Add team</button>}
            </div>

            {teams.map((team, index) => (
              <fieldset key={index} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <legend className="font-semibold text-slate-800">Team {index + 1}</legend>
                  {teams.length > 1 && <button type="button" onClick={() => setTeams((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="text-sm font-medium text-slate-500 hover:text-rose-700">Remove</button>}
                </div>
                <div className="grid gap-4 sm:grid-cols-[minmax(0,0.35fr)_minmax(0,0.65fr)]">
                  <label className="block text-sm font-medium text-slate-700">
                    Team name
                    <input value={team.team} onChange={(event) => updateTeam(index, 'team', event.target.value)} placeholder="e.g. Sales" className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none ring-cyan-600 transition focus:ring-2" />
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    Process description
                    <textarea value={team.description} onChange={(event) => updateTeam(index, 'description', event.target.value)} placeholder="Describe how this team books, approves, submits, and processes expenses." rows={4} className="mt-1.5 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none ring-cyan-600 transition focus:ring-2" />
                  </label>
                </div>
              </fieldset>
            ))}

            {error && <p role="alert" className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
            <button type="submit" disabled={isSubmitting} className="rounded-lg bg-cyan-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-slate-400">
              {isSubmitting ? 'Analyzing all teams…' : 'Analyze processes'}
            </button>
          </form>
        </section>

        {result && (
          <section className="mt-8 space-y-8" aria-live="polite">
            <div>
              <div className="mb-4"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700">Results</p><h2 className="mt-1 text-2xl font-bold">Findings</h2></div>
              <div className="grid gap-4 md:grid-cols-2">
                {result.findings.map((finding, index) => (
                  <article key={`${finding.area}-${index}`} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold capitalize text-slate-900">{label(finding.area)}</h3><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${severityStyles[finding.severity]}`}>{label(finding.severity)}</span></div>
                    <p className="mt-3 text-sm leading-6 text-slate-700">{finding.reasoning}</p>
                    <div className="mt-4 flex flex-wrap gap-2">{finding.teams_involved.map((team) => <span key={team} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{team}</span>)}</div>
                  </article>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-4"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700">Next steps</p><h2 className="mt-1 text-2xl font-bold">Recommendations</h2></div>
              <div className="grid gap-4 md:grid-cols-2">
                {result.recommendations.map((recommendation, index) => {
                  const finding = relatedFinding(recommendation, result.findings);
                  return <article key={`${recommendation.finding_reference}-${index}`} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-slate-900">{recommendation.fix_type === 'ai' ? 'AI-supported fix' : 'Process or policy fix'}</h3>{finding && <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-800">{label(finding.area)}</span>}</div>
                    {recommendation.recommended_tool && <p className="mt-3 text-sm text-slate-700"><span className="font-semibold">Tool:</span> {recommendation.recommended_tool}</p>}
                    <ol className="mt-4 space-y-2 text-sm leading-6 text-slate-700">{recommendation.steps.map((step) => <li key={step}>{step}</li>)}</ol>
                  </article>;
                })}
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

export default App;
