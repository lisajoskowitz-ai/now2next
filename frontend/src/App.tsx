import { FormEvent, useState } from 'react';
import type {
  Finding,
  ProcessPipelineResult,
  Recommendation,
  TeamProcessDescription,
} from '../../shared/types';

const emptyTeam = (): TeamProcessDescription => ({ team: '', description: '' });
const personNamePattern = /\b([A-ZÄÖÜ][a-zäöüß]+(?:[-'][A-ZÄÖÜ][a-zäöüß]+)?)\s+([A-ZÄÖÜ][a-zäöüß]+(?:[-'][A-ZÄÖÜ][a-zäöüß]+)?)\b/g;

const severityStyles: Record<Finding['severity'], string> = {
  possible_showstopper: 'bg-[#fff0f4] text-[#a52f58] ring-[#ffd2df]',
  todo: 'bg-[#f1edff] text-[#5d43c9] ring-[#ddd4ff]',
  tolerate: 'bg-[#eaf9fc] text-[#287d8f] ring-[#c9eff5]',
};

function label(value: string) {
  return value.replace(/_/g, ' ');
}

function relatedFinding(recommendation: Recommendation, findings: Finding[]) {
  return findings.find((finding) => finding.reasoning === recommendation.finding_reference);
}

function replaceEvery(text: string, search: string, replacement: string) {
  return text.split(search).join(replacement);
}

/** A visual-only preview; the backend still performs the real Anymize protection. */
function createDemoAnonymizedPreview(teams: TeamProcessDescription[]): TeamProcessDescription[] {
  const personAliases = new Map<string, string>();
  let nextPersonIndex = 0;

  function getPersonAlias(givenName: string, familyName: string) {
    const existingAlias = personAliases.get(givenName) || personAliases.get(familyName);
    const alias = existingAlias || `[Person ${String.fromCharCode(65 + nextPersonIndex)}]`;

    if (!existingAlias) nextPersonIndex += 1;
    personAliases.set(givenName, alias);
    personAliases.set(familyName, alias);
    return alias;
  }

  return teams.map((team, index) => {
    let description = team.description;

    teams.forEach((otherTeam, teamIndex) => {
      description = replaceEvery(description, otherTeam.team, `[Team ${String.fromCharCode(65 + teamIndex)}]`);
    });
    description = description.replace(personNamePattern, (_match, givenName: string, familyName: string) => {
      return getPersonAlias(givenName, familyName);
    });
    [...personAliases.entries()]
      .sort(([left], [right]) => right.length - left.length)
      .forEach(([name, alias]) => {
        description = replaceEvery(description, name, alias);
      });
    description = description.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[Email]');
    description = description.replace(/\+?\d[\d\s()/.-]{7,}\d/g, '[Phone]');

    return { team: `[Team ${String.fromCharCode(65 + index)}]`, description };
  });
}

function App() {
  const [teams, setTeams] = useState<TeamProcessDescription[]>([emptyTeam()]);
  const [result, setResult] = useState<ProcessPipelineResult | null>(null);
  const [anonymizedPreview, setAnonymizedPreview] = useState<TeamProcessDescription[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnonymizing, setIsAnonymizing] = useState(false);

  function updateTeam(index: number, field: keyof TeamProcessDescription, value: string) {
    setTeams((current) => current.map((team, teamIndex) => teamIndex === index ? { ...team, [field]: value } : team));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResult(null);
    setAnonymizedPreview(null);

    if (teams.some((team) => !team.team.trim() || !team.description.trim())) {
      setError('Add a team name and a process description for every team before analyzing.');
      return;
    }

    setIsAnonymizing(true);
    setAnonymizedPreview(createDemoAnonymizedPreview(teams));

    await new Promise((resolve) => setTimeout(resolve, 900));
    setIsAnonymizing(false);
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
      setIsAnonymizing(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-canvas px-4 py-8 text-ink sm:px-6 sm:py-12 lg:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[460px] bg-gradient-to-br from-[#f0ecff] via-[#faf7ff] to-[#ebfaff] opacity-80" />
      <div className="relative mx-auto max-w-6xl">
        <header className="mb-10 pt-2 sm:mb-12">
          <div className="flex items-center gap-3" aria-label="Now2Next">
            <span className="flex h-11 w-14 items-center justify-center rounded-[11px] bg-[#143456] text-sm font-extrabold tracking-tight text-white shadow-sm">
              N<span className="mx-0.5 text-cyan-200">→</span>N
            </span>
            <span className="text-[28px] font-extrabold tracking-tight text-[#143456]">Now2Next</span>
          </div>
          <div className="mt-7 h-1 w-20 rounded-full bg-gradient-to-r from-violet via-[#a66afa] to-coral" />
          <h1 className="mt-5 max-w-3xl text-4xl font-extrabold tracking-[-0.035em] text-ink sm:text-5xl">Turn process complexity into clear next actions.</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted sm:text-lg sm:leading-8">
            Compare how teams work, identify the gaps that matter, and leave with a practical plan to improve.
          </p>
        </header>

        <section className="relative overflow-hidden rounded-[20px] bg-white p-5 shadow-surface sm:p-8">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet via-[#aa75fb] to-coral" />
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-ink">Team processes</h2>
                <p className="mt-1.5 text-sm leading-6 text-muted">Describe how your process actually works today — plain language, no special format needed.</p>
              </div>
              {teams.length < 3 && <button type="button" onClick={() => setTeams((current) => [...current, emptyTeam()])} className="rounded-full border border-violet bg-transparent px-4 py-2 text-sm font-semibold text-violet transition hover:bg-[#f3f0ff] focus:outline-none focus:ring-4 focus:ring-[#e4dcff]">+ Add team</button>}
            </div>

            {teams.map((team, index) => (
              <fieldset key={index} className="rounded-2xl bg-[#fcfbff] p-5 ring-1 ring-[#ebe7f3]">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <legend className="font-bold text-ink">Team {index + 1}</legend>
                  {teams.length > 1 && <button type="button" onClick={() => setTeams((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="text-sm font-semibold text-muted transition hover:text-[#d84b7d] focus:outline-none focus:ring-4 focus:ring-[#ffe0ea]">Remove</button>}
                </div>
                <div className="grid gap-4 sm:grid-cols-[minmax(0,0.35fr)_minmax(0,0.65fr)]">
                  <label className="block text-sm font-semibold text-ink">
                    Team name
                    <input value={team.team} onChange={(event) => updateTeam(index, 'team', event.target.value)} placeholder="e.g. Sales" className="mt-2 w-full rounded-xl border border-[#e4e1eb] bg-white px-4 py-3 text-ink outline-none transition placeholder:text-[#9895a5] focus:border-violet focus:ring-4 focus:ring-[#e6dfff]" />
                  </label>
                  <label className="block text-sm font-semibold text-ink">
                    Process description
                    <textarea value={team.description} onChange={(event) => updateTeam(index, 'description', event.target.value)} placeholder={'e.g. "Our team books trips through a portal, then submits receipts via an app..."'} rows={4} className="mt-2 w-full resize-y rounded-xl border border-[#e4e1eb] bg-white px-4 py-3 leading-6 text-ink outline-none transition placeholder:text-[#9895a5] focus:border-violet focus:ring-4 focus:ring-[#e6dfff]" />
                  </label>
                </div>
              </fieldset>
            ))}

            {error && <p role="alert" className="rounded-xl bg-[#fff0f4] px-4 py-3 text-sm font-medium text-[#a52f58] ring-1 ring-[#ffd2df]">{error}</p>}
            <div>
              <button type="submit" disabled={isSubmitting || isAnonymizing} className="rounded-full bg-gradient-to-r from-violet to-coral px-6 py-3 text-sm font-bold text-white shadow-button transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_30px_rgba(124,92,252,0.34)] focus:outline-none focus:ring-4 focus:ring-[#e3dcff] disabled:cursor-not-allowed disabled:transform-none disabled:from-[#aaa2cf] disabled:to-[#d7a2b7] disabled:shadow-none">
                {isAnonymizing ? 'Anonymizing input…' : isSubmitting ? 'Analyzing my process…' : 'Analyze my process'}
              </button>
              <p className="mt-3 text-xs font-medium text-muted">Your input is automatically anonymized before analysis.</p>
            </div>
          </form>
        </section>

        {anonymizedPreview && (
          <section className="relative mt-7 overflow-hidden rounded-[20px] bg-white p-5 shadow-surface sm:p-7" aria-live="polite">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky via-violet to-coral" />
            <div className="flex items-center gap-3">
              {isAnonymizing && <span className="h-5 w-5 animate-spin rounded-full border-2 border-violet border-t-transparent" aria-hidden="true" />}
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet">Privacy preview</p>
                <h2 className="mt-1 text-xl font-bold text-ink">{isAnonymizing ? 'Anonymizing input…' : 'Anonymized input preview'}</h2>
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted">This preview masks detected person-name patterns, entered team names, email addresses, and phone numbers. The backend performs the real Anymize anonymization before analysis.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {anonymizedPreview.map((team) => (
                <article key={team.team} className="rounded-2xl bg-[#f8f7ff] p-5 ring-1 ring-[#e9e4fb]">
                  <h3 className="font-bold text-ink">{team.team}</h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted">{team.description}</p>
                </article>
              ))}
            </div>
          </section>
        )}

        {result && (
          <section className="mt-10 space-y-10" aria-live="polite">
            <div>
              <div className="mb-4"><p className="text-xs font-bold uppercase tracking-[0.2em] text-violet">Results</p><h2 className="mt-2 text-3xl font-extrabold tracking-tight text-ink">Findings</h2></div>
              <div className="grid gap-5 md:grid-cols-2">
                {result.findings.map((finding, index) => (
                  <article key={`${finding.area}-${index}`} className="relative overflow-hidden rounded-[20px] bg-white p-6 shadow-surface">
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet to-coral" />
                    <div className="flex flex-wrap items-center gap-2"><h3 className="font-bold capitalize text-ink">{label(finding.area)}</h3><span className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${severityStyles[finding.severity]}`}>{label(finding.severity)}</span></div>
                    <p className="mt-4 text-sm leading-6 text-muted">{finding.reasoning}</p>
                    <div className="mt-4 flex flex-wrap gap-2">{finding.teams_involved.map((team) => <span key={team} className="rounded-full bg-[#f0edff] px-3 py-1 text-xs font-semibold text-[#5d43c9]">{team}</span>)}</div>
                  </article>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-4"><p className="text-xs font-bold uppercase tracking-[0.2em] text-violet">Next steps</p><h2 className="mt-2 text-3xl font-extrabold tracking-tight text-ink">Recommendations</h2></div>
              <div className="grid gap-5 md:grid-cols-2">
                {result.recommendations.map((recommendation, index) => {
                  const finding = relatedFinding(recommendation, result.findings);
                  return <article key={`${recommendation.finding_reference}-${index}`} className="relative overflow-hidden rounded-[20px] bg-white p-6 shadow-surface">
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky via-violet to-coral" />
                    <div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-ink">{recommendation.fix_type === 'ai' ? 'AI-supported fix' : 'Process or policy fix'}</h3>{finding && <span className="rounded-full bg-[#eaf9fc] px-3 py-1 text-xs font-bold text-[#287d8f]">{label(finding.area)}</span>}</div>
                    {recommendation.recommended_tool && <p className="mt-4 text-sm text-muted"><span className="font-bold text-ink">Tool:</span> {recommendation.recommended_tool}</p>}
                    <ol className="mt-5 space-y-2 text-sm leading-6 text-muted">{recommendation.steps.map((step) => <li key={step}>{step}</li>)}</ol>
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
