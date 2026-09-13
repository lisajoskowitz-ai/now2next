import { FormEvent, useEffect, useRef, useState } from 'react';
import type {
  AnalysisAssistantAnswer,
  Finding,
  ProcessPipelineResult,
  Recommendation,
  TeamProcess,
  TeamProcessDescription,
} from '../../shared/types';

const emptyTeam = (): TeamProcessDescription => ({ team: '', description: '' });
const personNamePattern = /\b([A-ZÄÖÜ][a-zäöüß]+(?:[-'][A-ZÄÖÜ][a-zäöüß]+)?)\s+([A-ZÄÖÜ][a-zäöüß]+(?:[-'][A-ZÄÖÜ][a-zäöüß]+)?)\b/g;

const severityStyles: Record<Finding['severity'], string> = {
  possible_showstopper: 'bg-[#fff0f4] text-[#a52f58] ring-[#ffd2df]',
  todo: 'bg-[#f1edff] text-[#5d43c9] ring-[#ddd4ff]',
  tolerate: 'bg-[#eaf9fc] text-[#287d8f] ring-[#c9eff5]',
};

const confidenceStyles: Record<Finding['confidence'], string> = {
  confirmed: 'bg-[#e8f6f1] text-[#16766e]',
  inferred: 'bg-[#f1edff] text-[#5d43c9]',
  needs_validation: 'bg-[#fff6e8] text-[#936417]',
};

const priorityStyles: Record<Recommendation['priority'], string> = {
  now: 'bg-[#fff0f4] text-[#a52f58] ring-[#ffd2df]',
  next: 'bg-[#f1edff] text-[#5d43c9] ring-[#ddd4ff]',
  later: 'bg-[#eaf9fc] text-[#287d8f] ring-[#c9eff5]',
};

const priorityLabels: Record<Recommendation['priority'], string> = {
  now: 'Now — reduce risk',
  next: 'Next — improve the flow',
  later: 'Later — optimize further',
};

const toolDecisionStyles = {
  keep: 'bg-[#e8f6f1] text-[#16766e]',
  integrate: 'bg-[#f1edff] text-[#5d43c9]',
  reduce: 'bg-[#fff6e8] text-[#936417]',
};

const analysisStages = [
  { id: 'anonymizing', label: 'Anonymizing input', detail: 'Removing identifying information before analysis.' },
  { id: 'structuring', label: 'Extracting process data', detail: 'Converting notes into comparable process data.' },
  { id: 'analyzing', label: 'Analyzing process gaps', detail: 'Identifying risks, duplication, and working practices.' },
  { id: 'planning', label: 'Creating the implementation plan', detail: 'Defining the target process, work packages, and tool decisions.' },
] as const;

const canvasSteps = [
  { id: 'current_state', number: '01', label: 'Current state' },
  { id: 'what_matters', number: '02', label: 'What matters' },
  { id: 'target_process', number: '03', label: 'Target process' },
  { id: 'action_plan', number: '04', label: 'Action plan' },
  { id: 'assistant', number: '05', label: 'Assistant' },
] as const;

type AnalysisStage = typeof analysisStages[number]['id'] | 'complete';
type CanvasStepId = typeof canvasSteps[number]['id'];
type ReviewFieldKey = Exclude<keyof TeamProcess, 'team'>;

type StepperStep<T extends string> = {
  id: T;
  number: string;
  label: string;
};

const reviewFields: Array<{ key: ReviewFieldKey; label: string }> = [
  { key: 'booking_owner', label: 'Booking owner' },
  { key: 'booking_channel', label: 'Booking channel' },
  { key: 'approval_timing', label: 'Approval timing' },
  { key: 'approval_steps', label: 'Approval steps' },
  { key: 'policy_check', label: 'Policy check' },
  { key: 'expense_submission', label: 'Receipt submission' },
  { key: 'processing_time_days', label: 'Processing time' },
  { key: 'systems_used', label: 'Systems used' },
];

const uncertainFieldMap: Record<Finding['area'], ReviewFieldKey[]> = {
  policy_check: ['policy_check'],
  approval_redundancy: ['approval_timing', 'approval_steps'],
  submission_timeliness: ['expense_submission', 'processing_time_days'],
  audit_trail: ['expense_submission', 'systems_used', 'approval_timing'],
  company_consistency: [],
};

function label(value: string) {
  if (value === 'todo') return 'to do';
  return value.replace(/_/g, ' ');
}

function relatedFinding(recommendation: Recommendation, findings: Finding[]) {
  return findings.find((finding) => finding.reasoning === recommendation.finding_reference);
}

function replaceEvery(text: string, search: string, replacement: string) {
  return text.split(search).join(replacement);
}

function PillStepper<T extends string>({
  steps,
  currentStep,
  onStepChange,
}: {
  steps: readonly StepperStep<T>[];
  currentStep: T;
  onStepChange: (step: T) => void;
}) {
  return <nav aria-label="Decision Canvas steps" className="overflow-x-auto rounded-2xl border border-[#dce4ec] bg-white/95 p-2 shadow-[0_8px_20px_rgba(20,52,86,0.10)] backdrop-blur"><div className="flex min-w-max items-center gap-2">{steps.map((step) => {
    const isActive = currentStep === step.id;
    return <button key={step.id} type="button" aria-current={isActive ? 'step' : undefined} onClick={() => onStepChange(step.id)} className={`rounded-full border px-4 py-2 text-sm font-bold transition focus:outline-none focus:ring-4 focus:ring-[#dce8f3] ${isActive ? 'border-[#143456] bg-[#143456] text-white shadow-sm' : 'border-[#c9d6e0] bg-white text-[#294e73] hover:border-[#294e73] hover:bg-[#eef3f7]'}`}><span className={`mr-1.5 text-xs ${isActive ? 'text-[#b7eee1]' : 'text-[#71889d]'}`}>{step.number}</span>{step.label}</button>;
  })}</div></nav>;
}

function RecommendationCard({ recommendation, finding }: { recommendation: Recommendation; finding?: Finding }) {
  return <article className="relative overflow-hidden rounded-[20px] bg-white p-6 shadow-surface">
    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky via-violet to-[#294e73]" />
    <div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-3 py-1 text-xs font-bold ${recommendation.fix_type === 'ai' ? 'bg-[#f1edff] text-[#5d43c9]' : 'bg-[#eaf9fc] text-[#287d8f]'}`}>{recommendation.fix_type === 'ai' ? 'AI-supported' : 'Process foundation'}</span>{finding && <span className="rounded-full bg-[#f8f7fb] px-3 py-1 text-xs font-bold text-muted">{label(finding.area)}</span>}</div>
    <h3 className="mt-4 text-xl font-extrabold tracking-tight text-ink">{recommendation.title}</h3>

    <section className="mt-5 rounded-2xl bg-[#f5f2ff] p-4 ring-1 ring-[#e7dfff]">
      <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#5d43c9]">What AI can optimize</p>
      <p className="mt-2 text-sm leading-6 text-[#45455d]">{recommendation.ai_optimization}</p>
      {recommendation.recommended_tool && <div className="mt-3 rounded-xl bg-white px-3 py-2.5 text-sm ring-1 ring-[#ddd4ff]"><span className="font-bold text-ink">Recommended tools</span><span className="mx-2 text-[#b3a9d8]">•</span><span className="font-semibold text-[#5d43c9]">{recommendation.recommended_tool}</span></div>}
    </section>

    <section className="mt-4 rounded-2xl bg-[#effbfa] p-4 ring-1 ring-[#d3f1ed]">
      <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#16766e]">Process owner actions</p>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-[#3e5b60]">{recommendation.process_owner_actions.map((action) => <li key={action} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#25a99d]" aria-hidden="true" />{action}</li>)}</ul>
    </section>

    <section className="mt-5 border-t border-[#ece9f2] pt-5">
      <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-muted">Next steps</p>
      <ol className="mt-3 space-y-3 text-sm leading-6 text-muted">{recommendation.steps.map((step, stepIndex) => <li key={step} className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1a3152] text-xs font-extrabold text-white">{stepIndex + 1}</span><span>{step.replace(/^\d+\.\s*/, '')}</span></li>)}</ol>
    </section>
    <p className="mt-5 border-t border-[#ece9f2] pt-4 text-xs leading-5 text-muted"><span className="font-bold text-ink">Target-process contribution:</span> {recommendation.target_process_contribution}</p>
  </article>;
}

type AssistantMessage =
  | { role: 'user'; text: string }
  | { role: 'assistant'; answer: AnalysisAssistantAnswer };

function DecisionAssistant({ decisionCanvas }: { decisionCanvas: ProcessPipelineResult }) {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [isAsking, setIsAsking] = useState(false);
  const [assistantError, setAssistantError] = useState<string | null>(null);
  const prompts = ['Why is this a showstopper?', 'Explain the target process simply', 'What should the process owner do first?', 'Create a leadership summary'];

  async function askQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submittedQuestion = question.trim();
    if (!submittedQuestion || isAsking) return;

    setQuestion('');
    setAssistantError(null);
    setMessages((current) => [...current, { role: 'user', text: submittedQuestion }]);
    setIsAsking(true);
    try {
      const response = await fetch('/api/analysis-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: submittedQuestion, decision_canvas: decisionCanvas }),
      });
      const body = (await response.json()) as AnalysisAssistantAnswer & { message?: string };
      if (!response.ok) throw new Error(body.message || 'The Decision Assistant could not answer this question.');
      setMessages((current) => [...current, { role: 'assistant', answer: body }]);
    } catch (requestError) {
      setAssistantError(requestError instanceof Error ? requestError.message : 'The Decision Assistant could not answer this question.');
    } finally {
      setIsAsking(false);
    }
  }

  return <section className="relative overflow-hidden rounded-[20px] bg-white p-5 shadow-surface sm:p-7"><div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#294e73] via-violet to-sky" /><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-violet">05 / 05 · Assistant</p><h2 className="mt-2 text-2xl font-extrabold tracking-tight text-ink">Questions about this analysis?</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Ask about a finding, recommendation, target process, or roadmap. The assistant answers from this Decision Canvas and flags uncertainty where it exists.</p></div><div className="mt-5 flex flex-wrap gap-2">{prompts.map((prompt) => <button key={prompt} type="button" onClick={() => setQuestion(prompt)} className="rounded-full border border-[#dce4ec] bg-[#f7f9fb] px-3 py-1.5 text-xs font-bold text-[#4d6479] transition hover:border-violet hover:bg-[#f5f2ff] focus:outline-none focus:ring-4 focus:ring-[#e4e2f2]">{prompt}</button>)}</div>{messages.length > 0 && <div className="mt-6 space-y-4 border-t border-[#e7edf2] pt-5">{messages.map((message, index) => message.role === 'user' ? <div key={`user-${index}`} className="ml-auto max-w-2xl rounded-2xl bg-[#143456] px-4 py-3 text-sm leading-6 text-white">{message.text}</div> : <article key={`assistant-${index}`} className="max-w-3xl rounded-2xl bg-[#f7f9fb] p-5 ring-1 ring-[#e1e8ef]"><p className="text-sm font-bold text-ink">{message.answer.short_answer}</p><div className="mt-4 grid gap-4 md:grid-cols-2"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">Why it matters</p><p className="mt-1 text-sm leading-6 text-[#4d6479]">{message.answer.why_it_matters}</p></div><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">Recommended next action</p><p className="mt-1 text-sm leading-6 text-[#16766e]">{message.answer.recommended_next_action}</p></div></div>{message.answer.evidence.length > 0 && <div className="mt-4 rounded-xl bg-white p-3"><p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">Evidence from this analysis</p><ul className="mt-2 space-y-1 text-sm leading-5 text-[#4d6479]">{message.answer.evidence.map((item) => <li key={item}>• {item}</li>)}</ul></div>}<div className="mt-4 rounded-xl bg-[#fff9ed] px-3 py-2.5 text-sm leading-5 text-[#7a5a1d]"><span className="font-bold">Validation:</span> {message.answer.validation_note}</div></article>)}</div>}<form onSubmit={askQuestion} className="mt-6"><label className="sr-only" htmlFor="analysis-question">Ask a question about your results</label><div className="flex flex-col gap-3 sm:flex-row"><input id="analysis-question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask a question about your results…" disabled={isAsking} className="min-w-0 flex-1 rounded-xl border border-[#dce4ec] bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-[#909cab] focus:border-violet focus:ring-4 focus:ring-[#e4e2f2] disabled:bg-[#f7f9fb]" /><button type="submit" disabled={!question.trim() || isAsking} className="rounded-full bg-[#214b70] px-5 py-3 text-sm font-bold text-white shadow-button transition hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-[#dce8f3] disabled:cursor-not-allowed disabled:opacity-60">{isAsking ? 'Preparing a privacy-safe answer…' : 'Send'}</button></div><p className="mt-3 text-xs leading-5 text-muted">Your question and the current analysis are anonymized by <a href="https://anymize.ai" target="_blank" rel="noreferrer" className="font-bold text-[#16766e] underline decoration-[#8bded5] underline-offset-2">anymize ↗</a> before the assistant responds. This is not legal, tax, or binding compliance advice.</p></form>{assistantError && <p role="alert" className="mt-4 rounded-xl bg-[#fff0f4] px-4 py-3 text-sm font-medium text-[#a52f58] ring-1 ring-[#ffd2df]">{assistantError}</p>}</section>;
}

/** A visual-only preview; the backend still performs the real anymize protection. */
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

function uncertainFactKeys(findings: Finding[]) {
  const keys = new Set<string>();
  findings.filter((finding) => finding.confidence === 'needs_validation').forEach((finding) => {
    uncertainFieldMap[finding.area].forEach((field) => finding.teams_involved.forEach((team) => keys.add(`${team}:${field}`)));
  });
  return keys;
}

function App() {
  const [teams, setTeams] = useState<TeamProcessDescription[]>([emptyTeam()]);
  const [result, setResult] = useState<ProcessPipelineResult | null>(null);
  const [analysisRunId, setAnalysisRunId] = useState(0);
  const [anonymizedPreview, setAnonymizedPreview] = useState<TeamProcessDescription[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnonymizing, setIsAnonymizing] = useState(false);
  const [analysisStage, setAnalysisStage] = useState<AnalysisStage>('anonymizing');
  const [reviewStates, setReviewStates] = useState<Record<string, 'confirmed' | 'needs_review' | 'rejected'>>({});
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [reviewProcesses, setReviewProcesses] = useState<TeamProcess[] | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [activeCanvasStep, setActiveCanvasStep] = useState<CanvasStepId>('current_state');
  const [isCanvasNavigationPinned, setIsCanvasNavigationPinned] = useState(false);
  const resultsRef = useRef<HTMLElement>(null);
  const canvasNavigationAnchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isSubmitting) return undefined;

    const structuringTimer = window.setTimeout(() => setAnalysisStage('structuring'), 800);
    const analyzingTimer = window.setTimeout(() => setAnalysisStage('analyzing'), 4_000);
    const planningTimer = window.setTimeout(() => setAnalysisStage('planning'), 9_000);

    return () => {
      window.clearTimeout(structuringTimer);
      window.clearTimeout(analyzingTimer);
      window.clearTimeout(planningTimer);
    };
  }, [isSubmitting]);

  useEffect(() => {
    if (!result) {
      setIsCanvasNavigationPinned(false);
      return undefined;
    }

    const updateNavigationPosition = () => {
      const shouldPin = (canvasNavigationAnchorRef.current?.getBoundingClientRect().top ?? Infinity) <= 12;
      setIsCanvasNavigationPinned((current) => current === shouldPin ? current : shouldPin);
    };

    updateNavigationPosition();
    window.addEventListener('scroll', updateNavigationPosition, { passive: true });
    window.addEventListener('resize', updateNavigationPosition);
    return () => {
      window.removeEventListener('scroll', updateNavigationPosition);
      window.removeEventListener('resize', updateNavigationPosition);
    };
  }, [result]);

  function updateTeam(index: number, field: keyof TeamProcessDescription, value: string) {
    setTeams((current) => current.map((team, teamIndex) => teamIndex === index ? { ...team, [field]: value } : team));
  }

  function selectCanvasStep(step: CanvasStepId) {
    setActiveCanvasStep(step);
    window.requestAnimationFrame(() => canvasNavigationAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  function updateReviewedProcess(index: number, field: ReviewFieldKey, value: string) {
    setReviewProcesses((current) => current?.map((process, processIndex) => {
      if (processIndex !== index) return process;
      if (field === 'approval_steps') return { ...process, approval_steps: Number(value) || 0 };
      if (field === 'systems_used') return { ...process, systems_used: value.split(',').map((item) => item.trim()).filter(Boolean) };
      return { ...process, [field]: value };
    }) || null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResult(null);
    setAnonymizedPreview(null);
    setReviewStates({});
    setReviewNotes({});
    setReviewProcesses(null);
    setIsReviewOpen(false);
    setAnalysisStage('anonymizing');

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
      setAnalysisRunId((current) => current + 1);
      setActiveCanvasStep('current_state');
      setReviewProcesses(body.processes);
      setAnalysisStage('complete');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The analysis could not be completed.');
    } finally {
      setIsSubmitting(false);
      setIsAnonymizing(false);
    }
  }

  async function updateDecisionCanvas() {
    if (!reviewProcesses) return;

    setError(null);
    setIsSubmitting(true);
    setAnalysisStage('analyzing');
    try {
      const response = await fetch('/api/reanalyze-processes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ processes: reviewProcesses }),
      });
      const body = (await response.json()) as ProcessPipelineResult & { message?: string };
      if (!response.ok) throw new Error(body.message || 'The updated analysis could not be completed.');
      setResult(body);
      setAnalysisRunId((current) => current + 1);
      setActiveCanvasStep('current_state');
      setReviewProcesses(body.processes);
      setAnalysisStage('complete');
      setIsReviewOpen(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The updated analysis could not be completed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-canvas px-4 py-5 text-ink sm:px-6 sm:py-7 lg:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[330px] bg-gradient-to-br from-[#eef3f8] via-[#f7f8fb] to-[#edf7f5]" />
      <div className="relative mx-auto max-w-6xl">
        <header className="relative mb-4 min-h-[180px] overflow-hidden rounded-[26px] bg-gradient-to-br from-[#c9e3f7] via-[#e5d7fa] to-[#b7eee1] px-5 py-4 shadow-surface sm:mb-5 sm:min-h-[190px] sm:px-7 sm:py-5">
          <div className="relative flex items-center gap-2.5" aria-label="Now2Next">
            <span className="flex h-9 w-11 items-center justify-center rounded-[9px] bg-[#143456] text-xs font-extrabold tracking-tight text-white shadow-sm">
              N<span className="mx-0.5 text-cyan-200">→</span>N
            </span>
            <span className="text-xl font-extrabold tracking-tight text-[#143456]">Now2Next</span>
          </div>

          <div className="relative mx-auto mt-5 max-w-3xl text-center sm:mt-6">
            <h1 className="text-2xl font-extrabold tracking-[-0.04em] text-[#143456] sm:text-3xl">Document current processes and define implementation steps.</h1>
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-[#4d6479] sm:text-base sm:leading-7">
              Compare process data across teams, identify gaps, and create an implementation plan with clear responsibilities.
            </p>
          </div>
        </header>

        <section className="relative overflow-hidden rounded-[20px] bg-white p-5 shadow-surface sm:p-8">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#294e73] via-violet to-sky" />
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-bold tracking-tight text-ink">Team processes</h2>
                {teams.length < 3 && <button type="button" onClick={() => setTeams((current) => [...current, emptyTeam()])} className="shrink-0 rounded-full border border-violet bg-transparent px-4 py-2 text-sm font-semibold text-violet transition hover:bg-[#f1f0f8] focus:outline-none focus:ring-4 focus:ring-[#e3e1f4]">+ Add team</button>}
              </div>
                <p className="mt-1.5 text-sm leading-6 text-muted">Describe how your process actually works today — plain language, no special format needed.</p>
            </div>

            {teams.map((team, index) => (
              <fieldset key={index} className="rounded-2xl bg-[#fbfcfd] p-5 ring-1 ring-[#e4eaf0]">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <legend className="font-bold text-ink">Team {index + 1}</legend>
                  {teams.length > 1 && <button type="button" onClick={() => setTeams((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="text-sm font-semibold text-muted transition hover:text-[#a55b72] focus:outline-none focus:ring-4 focus:ring-[#f4e1e8]">Remove</button>}
                </div>
                <div className="grid gap-4 sm:grid-cols-[minmax(0,0.35fr)_minmax(0,0.65fr)]">
                  <label className="block text-sm font-semibold text-ink">
                    Team name
                    <input value={team.team} onChange={(event) => updateTeam(index, 'team', event.target.value)} placeholder="e.g. Sales" className="mt-2 w-full rounded-xl border border-[#dce4ec] bg-white px-4 py-3 text-ink outline-none transition placeholder:text-[#909cab] focus:border-violet focus:ring-4 focus:ring-[#e4e2f2]" />
                  </label>
                  <label className="block text-sm font-semibold text-ink">
                    Process description
                    <textarea value={team.description} onChange={(event) => updateTeam(index, 'description', event.target.value)} placeholder={'e.g. "Our team books trips through a portal, then submits receipts via an app..."'} rows={4} className="mt-2 w-full resize-y rounded-xl border border-[#dce4ec] bg-white px-4 py-3 leading-6 text-ink outline-none transition placeholder:text-[#909cab] focus:border-violet focus:ring-4 focus:ring-[#e4e2f2]" />
                  </label>
                </div>
              </fieldset>
            ))}

            {error && <p role="alert" className="rounded-xl bg-[#fff0f4] px-4 py-3 text-sm font-medium text-[#a52f58] ring-1 ring-[#ffd2df]">{error}</p>}
            <div>
              <button type="submit" disabled={isSubmitting || isAnonymizing} style={{ backgroundImage: 'linear-gradient(105deg, #214B70 0%, #5C63A6 100%)' }} className="rounded-full border border-[#294e73] bg-[#214b70] px-6 py-3 text-sm font-bold text-white shadow-[0_8px_18px_rgba(31,62,116,0.20)] transition duration-200 hover:-translate-y-0.5 hover:brightness-105 hover:shadow-[0_11px_22px_rgba(31,62,116,0.26)] focus:outline-none focus:ring-4 focus:ring-[#dce8f3] disabled:cursor-not-allowed disabled:transform-none disabled:opacity-60">
                {isAnonymizing ? 'Anonymizing input…' : isSubmitting ? 'Analyzing my process…' : 'Analyze my process'}
              </button>
              <div className="mt-3 flex items-start gap-2 text-xs leading-5 text-muted">
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-[#16766e]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
                <p>Your input is automatically anonymized before analysis. <a href="https://anymize.ai" target="_blank" rel="noreferrer" className="whitespace-nowrap font-bold text-[#16766e] underline decoration-[#8bded5] underline-offset-2 transition hover:text-[#0e5b55] focus:outline-none focus:ring-2 focus:ring-[#bdeee8]">Powered by anymize ↗</a></p>
              </div>
              {result && <button type="button" onClick={() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#bfece6] bg-[#effbfa] px-4 py-2 text-sm font-bold text-[#16766e] transition hover:bg-[#e2f7f3] focus:outline-none focus:ring-4 focus:ring-[#d3f1ed]">View analysis results <span aria-hidden="true">↓</span></button>}
            </div>
          </form>
        </section>

        {anonymizedPreview && (
          <section className="relative mt-7 overflow-hidden rounded-[20px] bg-white p-5 shadow-surface sm:p-7" aria-live="polite">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky via-violet to-[#294e73]" />
            <div className="flex items-center gap-3">
              {isAnonymizing && <span className="h-5 w-5 animate-spin rounded-full border-2 border-violet border-t-transparent" aria-hidden="true" />}
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet">Privacy preview</p>
                <h2 className="mt-1 text-xl font-bold text-ink">{isAnonymizing ? 'Anonymizing input…' : 'Anonymized input preview'}</h2>
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted">This preview masks detected person-name patterns, entered team names, email addresses, and phone numbers. The backend performs <a href="https://anymize.ai" target="_blank" rel="noreferrer" className="font-bold text-[#16766e] underline decoration-[#8bded5] underline-offset-2">anymize</a> anonymization before analysis.</p>
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

        {(isAnonymizing || isSubmitting) && <section className="relative mt-7 overflow-hidden rounded-[20px] bg-white p-5 shadow-surface sm:p-7" aria-live="polite"><div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#294e73] via-violet to-sky" /><div className="flex items-start gap-3"><span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-violet border-t-transparent animate-spin" aria-hidden="true" /><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-violet">Analysis in progress</p><h2 className="mt-1 text-xl font-bold text-ink">Processing the submitted process data</h2><p className="mt-2 text-sm leading-6 text-muted">The current-state comparison, findings, target process, and implementation plan will be shown below.</p></div></div><ol className="mt-6 space-y-3">{analysisStages.map((stage, index) => { const currentIndex = analysisStages.findIndex((item) => item.id === analysisStage); const isComplete = analysisStage === 'complete' || index < currentIndex; const isCurrent = stage.id === analysisStage; return <li key={stage.id} className={`flex items-start gap-3 rounded-xl px-3 py-2.5 ${isCurrent ? 'bg-[#f5f2ff]' : ''}`}><span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${isComplete ? 'bg-[#16766e] text-white' : isCurrent ? 'bg-violet text-white' : 'bg-[#e7edf2] text-[#82909f]'}`}>{isComplete ? '✓' : index + 1}</span><div><p className={`text-sm font-bold ${isCurrent ? 'text-ink' : 'text-[#4d6479]'}`}>{stage.label}</p>{isCurrent && <p className="mt-0.5 text-xs leading-5 text-muted">{stage.detail}</p>}</div></li>; })}</ol><div className="mt-6 grid gap-3 sm:grid-cols-2"><div className="animate-pulse rounded-xl bg-[#f3f6f9] p-4"><div className="h-3 w-28 rounded bg-[#dce4ec]" /><div className="mt-3 h-5 w-4/5 rounded bg-[#e5ebf0]" /></div><div className="animate-pulse rounded-xl bg-[#f3f6f9] p-4"><div className="h-3 w-32 rounded bg-[#dce4ec]" /><div className="mt-3 h-5 w-3/5 rounded bg-[#e5ebf0]" /></div><div className="animate-pulse rounded-xl bg-[#f3f6f9] p-4"><div className="h-3 w-24 rounded bg-[#dce4ec]" /><div className="mt-3 h-5 w-4/5 rounded bg-[#e5ebf0]" /></div><div className="animate-pulse rounded-xl bg-[#f3f6f9] p-4"><div className="h-3 w-28 rounded bg-[#dce4ec]" /><div className="mt-3 h-5 w-2/3 rounded bg-[#e5ebf0]" /></div></div></section>}

        {result && reviewProcesses && <section className="relative mt-7 overflow-hidden rounded-[20px] bg-white p-5 shadow-surface sm:p-7"><div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky via-violet to-[#294e73]" /><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-violet">Extracted process data</p><h2 className="mt-1 text-xl font-bold text-ink">Review the extracted process data</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{reviewProcesses.length * reviewFields.length} process facts extracted · {uncertainFactKeys(result.findings).size} items require validation. Update a value only when the source notes provide better evidence.</p></div><button type="button" onClick={() => setIsReviewOpen((current) => !current)} className="shrink-0 rounded-full border border-violet px-4 py-2 text-sm font-bold text-violet transition hover:bg-[#f1f0f8] focus:outline-none focus:ring-4 focus:ring-[#e3e1f4]">{isReviewOpen ? 'Hide extracted facts' : 'Review extracted facts'}</button></div>{uncertainFactKeys(result.findings).size > 0 && <div className="mt-4 rounded-xl bg-[#fff9ed] px-4 py-3 text-sm leading-6 text-[#7a5a1d]"><span className="font-bold">Needs validation:</span> The highlighted facts are based on incomplete or ambiguous interview notes. Update them only if your notes provide better evidence.</div>}{isReviewOpen && <div className="mt-6 space-y-5 border-t border-[#e7edf2] pt-6">{reviewProcesses.map((process, processIndex) => <article key={process.team} className="rounded-2xl bg-[#f7f9fb] p-5"><h3 className="font-bold text-ink">{process.team}</h3><div className="mt-4 grid gap-4 md:grid-cols-2">{reviewFields.map((field) => { const needsValidation = uncertainFactKeys(result.findings).has(`${process.team}:${field.key}`); const value = field.key === 'systems_used' ? process.systems_used.join(', ') : String(process[field.key]); return <label key={field.key} className={`block rounded-xl p-3 ${needsValidation ? 'bg-[#fff9ed] ring-1 ring-[#f2dca9]' : 'bg-white ring-1 ring-[#e1e8ef]'}`}><span className="text-xs font-bold uppercase tracking-[0.1em] text-muted">{field.label}{needsValidation && <span className="ml-2 text-[#936417]">Needs validation</span>}</span><input type={field.key === 'approval_steps' ? 'number' : 'text'} min={field.key === 'approval_steps' ? 0 : undefined} value={value} onChange={(event) => updateReviewedProcess(processIndex, field.key, event.target.value)} className="mt-2 w-full border-0 bg-transparent p-0 text-sm font-semibold text-ink outline-none placeholder:text-muted focus:ring-0" /></label>; })}</div></article>)}<div className="flex flex-wrap items-center gap-3"><button type="button" disabled={isSubmitting} onClick={updateDecisionCanvas} className="rounded-full bg-[#214b70] px-5 py-2.5 text-sm font-bold text-white shadow-button transition hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-[#dce8f3] disabled:cursor-not-allowed disabled:opacity-60">{isSubmitting ? 'Updating decision canvas…' : 'Update decision canvas'}</button><p className="text-sm text-muted">Updated facts are anonymized again before the analysis runs.</p></div></div>}</section>}

        {result && (
          <section ref={resultsRef} id="decision-canvas" className="mt-10 scroll-mt-6 space-y-10" aria-live="polite">
            <div ref={canvasNavigationAnchorRef} className={isCanvasNavigationPinned ? 'h-[60px]' : undefined}>
              <div className={isCanvasNavigationPinned ? 'fixed left-1/2 top-3 z-50 w-[calc(100%-2rem)] max-w-6xl -translate-x-1/2' : undefined}>
                <PillStepper steps={canvasSteps} currentStep={activeCanvasStep} onStepChange={selectCanvasStep} />
              </div>
            </div>

            <section className={activeCanvasStep === 'current_state' ? 'block' : 'hidden'}>
              <div className="mb-4"><p className="text-xs font-bold uppercase tracking-[0.2em] text-violet">01 / 05 · Current state</p><h2 className="mt-2 text-3xl font-extrabold tracking-tight text-ink">How teams work today</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">The comparison makes inconsistencies visible before deciding what to standardize.</p></div>
              <div className="overflow-x-auto rounded-[20px] bg-white shadow-surface"><table className="min-w-[760px] w-full text-left text-sm"><thead className="bg-[#f3f6f9] text-xs font-bold uppercase tracking-[0.08em] text-muted"><tr><th className="px-5 py-4">Process area</th>{result.processes.map((process) => <th key={process.team} className="px-5 py-4 text-ink">{process.team}</th>)}</tr></thead><tbody className="divide-y divide-[#e7edf2] text-muted">{[
                ['Booking', (process: TeamProcess) => `${process.booking_owner} · ${process.booking_channel}`],
                ['Approval', (process: TeamProcess) => `${process.approval_steps} step${process.approval_steps === 1 ? '' : 's'} · ${process.approval_timing}`],
                ['Policy check', (process: TeamProcess) => process.policy_check],
                ['Receipt submission', (process: TeamProcess) => process.expense_submission],
                ['Processing time', (process: TeamProcess) => process.processing_time_days],
                ['Systems', (process: TeamProcess) => process.systems_used.join(', ')],
              ].map(([area, getValue]) => <tr key={area as string}><th className="whitespace-nowrap px-5 py-4 font-bold text-ink">{area as string}</th>{result.processes.map((process) => <td key={process.team} className="px-5 py-4 leading-6">{(getValue as (item: TeamProcess) => string)(process)}</td>)}</tr>)}</tbody></table></div>
            </section>

            <section className={activeCanvasStep === 'what_matters' ? 'block' : 'hidden'}>
              <div className="mb-4"><p className="text-xs font-bold uppercase tracking-[0.2em] text-violet">02 / 05 · What matters</p><h2 className="mt-2 text-3xl font-extrabold tracking-tight text-ink">Findings to validate and act on</h2></div>
              <div className="grid gap-5 md:grid-cols-2">
                {result.findings.filter((finding) => finding.rating === 'gap').map((finding, index) => (
                  <article key={`${finding.area}-${index}`} className="relative overflow-hidden rounded-[20px] bg-white p-6 shadow-surface">
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#294e73] to-violet" />
                    <div className="flex flex-wrap items-center gap-2"><h3 className="font-bold capitalize text-ink">{label(finding.area)}</h3><span className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${severityStyles[finding.severity]}`}>{label(finding.severity)}</span><span className={`rounded-full px-3 py-1 text-xs font-bold ${confidenceStyles[finding.confidence]}`}>{label(finding.confidence)}</span></div>
                    <p className="mt-4 text-sm leading-6 text-muted">{finding.reasoning}</p>
                    <div className="mt-4 rounded-xl bg-[#f7f9fb] p-3"><p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">Evidence</p><ul className="mt-2 space-y-1 text-sm leading-5 text-[#4d6479]">{finding.evidence.map((item) => <li key={item}>“{item}”</li>)}</ul></div>
                    {finding.open_questions.length > 0 && <div className="mt-3 rounded-xl bg-[#fff9ed] p-3 text-sm leading-5 text-[#7a5a1d]"><span className="font-bold">Validate:</span> {finding.open_questions.join(' · ')}</div>}
                    <div className="mt-4 flex flex-wrap gap-2">{finding.teams_involved.map((team) => <span key={team} className="rounded-full bg-[#f0edff] px-3 py-1 text-xs font-semibold text-[#5d43c9]">{team}</span>)}</div>
                    <div className="mt-5 border-t border-[#e7edf2] pt-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">Stakeholder review</p>{reviewStates[finding.reasoning] && <span className="text-xs font-bold text-[#16766e]">Marked: {label(reviewStates[finding.reasoning])}</span>}</div><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => setReviewStates((current) => ({ ...current, [finding.reasoning]: 'confirmed' }))} className="rounded-full border border-[#bfece6] px-3 py-1.5 text-xs font-bold text-[#16766e] transition hover:bg-[#effbfa]">Confirm</button><button type="button" onClick={() => setReviewStates((current) => ({ ...current, [finding.reasoning]: 'needs_review' }))} className="rounded-full border border-[#e0d9f5] px-3 py-1.5 text-xs font-bold text-[#5d43c9] transition hover:bg-[#f5f2ff]">Needs review</button><button type="button" onClick={() => setReviewStates((current) => ({ ...current, [finding.reasoning]: 'rejected' }))} className="rounded-full border border-[#f2d6df] px-3 py-1.5 text-xs font-bold text-[#a52f58] transition hover:bg-[#fff0f4]">Reject</button></div>{reviewStates[finding.reasoning] && reviewStates[finding.reasoning] !== 'confirmed' && <label className="mt-3 block text-xs font-bold text-muted">Review note<textarea value={reviewNotes[finding.reasoning] || ''} onChange={(event) => setReviewNotes((current) => ({ ...current, [finding.reasoning]: event.target.value }))} placeholder="Add missing evidence, a correction, or an owner question…" rows={2} className="mt-1.5 w-full rounded-xl border border-[#dce4ec] bg-white px-3 py-2 text-sm font-normal text-ink outline-none focus:border-violet focus:ring-4 focus:ring-[#e4e2f2]" /></label>}</div>
                  </article>
                ))}
              </div>
              {result.findings.some((finding) => finding.rating === 'works') && <div className="mt-6"><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#16766e]">Keep & scale</p><div className="mt-3 grid gap-4 md:grid-cols-2">{result.findings.filter((finding) => finding.rating === 'works').map((finding, index) => <article key={`${finding.area}-works-${index}`} className="rounded-2xl bg-[#effbfa] p-5 ring-1 ring-[#d3f1ed]"><div className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#16766e] text-xs font-bold text-white">✓</span><h3 className="font-bold capitalize text-ink">{label(finding.area)}</h3></div><p className="mt-3 text-sm leading-6 text-[#3e5b60]">{finding.reasoning}</p><p className="mt-3 text-xs font-bold text-[#16766e]">Keep this pattern in the target process.</p></article>)}</div></div>}
            </section>

            <section className={activeCanvasStep === 'target_process' ? 'block' : 'hidden'}>
            <div className="flex flex-col items-center text-center" aria-label="Now to Next transition">
              <div className="flex items-center gap-3 text-[#143456]"><span className="h-px w-10 bg-[#b9cad8]" /><span className="rounded-full bg-[#e9eff5] px-4 py-1.5 text-xs font-extrabold tracking-[0.18em]">NOW <span className="mx-1.5 text-violet">→</span> NEXT</span><span className="h-px w-10 bg-[#b9cad8]" /></div>
              <p className="mt-3 text-sm font-semibold text-[#4d6479]">From today’s team processes to one shared target process</p>
            </div>

            <div className="mt-10">
              <div className="mb-4"><p className="text-xs font-bold uppercase tracking-[0.2em] text-violet">03 / 05 · Target process</p><h2 className="mt-2 text-3xl font-extrabold tracking-tight text-ink">{result.target_process.title}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{result.target_process.summary}</p></div>
              <div className="grid gap-3 md:grid-cols-4">{result.target_process.steps.map((step, index) => <article key={step.name} className="relative rounded-2xl bg-white p-5 shadow-surface"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#143456] text-xs font-bold text-white">{index + 1}</span><h3 className="mt-4 font-bold text-ink">{step.name}</h3><p className="mt-2 text-sm leading-6 text-muted">{step.purpose}</p><p className="mt-4 text-xs leading-5 text-[#16766e]"><span className="font-bold">Owner:</span> {step.owner}<br /><span className="font-bold">Automation:</span> {step.automation}</p></article>)}</div>
            </div>
            </section>

            <div className={`grid gap-5 lg:grid-cols-2 ${activeCanvasStep === 'target_process' ? '' : 'hidden'}`}>
              <article className="rounded-[20px] bg-white p-6 shadow-surface"><p className="text-xs font-bold uppercase tracking-[0.2em] text-violet">Business case</p><h2 className="mt-2 text-2xl font-extrabold tracking-tight text-ink">Value grounded in the current evidence</h2><dl className="mt-5 space-y-4 text-sm leading-6"><div><dt className="font-bold text-ink">Reimbursement baseline</dt><dd className="mt-1 text-muted">{result.business_case.reimbursement_baseline}</dd></div><div><dt className="font-bold text-ink">Manual effort</dt><dd className="mt-1 text-muted">{result.business_case.manual_effort_baseline}</dd></div><div><dt className="font-bold text-ink">Compliance risk</dt><dd className="mt-1 text-muted">{result.business_case.compliance_risk}</dd></div></dl><div className="mt-5 rounded-2xl bg-[#effbfa] p-4"><p className="text-xs font-bold uppercase tracking-[0.12em] text-[#16766e]">Expected value</p><ul className="mt-2 space-y-2 text-sm leading-6 text-[#3e5b60]">{result.business_case.expected_value.map((item) => <li key={item}>• {item}</li>)}</ul></div><div className="mt-4"><p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">Capture before committing to savings</p><ul className="mt-2 space-y-1 text-sm leading-6 text-muted">{result.business_case.data_needed.map((item) => <li key={item}>• {item}</li>)}</ul></div></article>
              <article className="rounded-[20px] bg-white p-6 shadow-surface"><p className="text-xs font-bold uppercase tracking-[0.2em] text-violet">Tool-fit analysis</p><h2 className="mt-2 text-2xl font-extrabold tracking-tight text-ink">Keep, integrate, or reduce</h2><p className="mt-2 text-sm leading-6 text-muted">Recommendations start with the current system landscape; tools are not proposed as blanket replacements.</p><div className="mt-5 space-y-3">{result.tool_fit.decisions.map((decision) => <div key={decision.system} className="rounded-xl bg-[#f7f9fb] p-4"><div className="flex items-center justify-between gap-3"><h3 className="font-bold text-ink">{decision.system}</h3><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${toolDecisionStyles[decision.decision]}`}>{decision.decision}</span></div><p className="mt-2 text-sm leading-6 text-muted">{decision.rationale}</p></div>)}</div></article>
            </div>

            <section className={activeCanvasStep === 'action_plan' ? 'block' : 'hidden'}>
              <div className="mb-5"><p className="text-xs font-bold uppercase tracking-[0.2em] text-violet">04 / 05 · Action plan</p><h2 className="mt-2 text-3xl font-extrabold tracking-tight text-ink">Implementation plan and timeline</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted sm:whitespace-nowrap">Each work package lists the owner, dependencies, effort, and success metric.</p></div>
              <div className="grid gap-5 lg:grid-cols-3">{(['now', 'next', 'later'] as Recommendation['priority'][]).map((priority, columnIndex) => { const recommendations = result.recommendations.filter((recommendation) => recommendation.priority === priority); const timeLabel = ['Days 0–30', 'Days 31–60', 'Days 61–90'][columnIndex]; return <section key={priority} className="rounded-[20px] bg-white p-5 shadow-surface"><p className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1 ${priorityStyles[priority]}`}>{timeLabel}</p><h3 className="mt-3 font-extrabold text-ink">{priorityLabels[priority]}</h3><div className="mt-4 space-y-4">{recommendations.length > 0 ? recommendations.map((recommendation) => <article key={recommendation.title} className="rounded-xl bg-[#f7f9fb] p-4"><h4 className="font-bold text-ink">{recommendation.title}</h4><p className="mt-2 text-xs leading-5 text-muted"><span className="font-bold text-ink">Owner:</span> {recommendation.owner}<br /><span className="font-bold text-ink">Effort:</span> {recommendation.effort}<br /><span className="font-bold text-ink">Success:</span> {recommendation.success_metric}</p>{recommendation.dependencies.length > 0 && <p className="mt-2 text-xs leading-5 text-muted"><span className="font-bold text-ink">Depends on:</span> {recommendation.dependencies.join(' · ')}</p>}</article>) : <p className="text-sm leading-6 text-muted">No workstream planned for this period.</p>}</div></section>; })}</div>
            </section>

            <div className={activeCanvasStep === 'action_plan' ? 'block' : 'hidden'}>
              <div className="mb-5"><p className="text-xs font-bold uppercase tracking-[0.2em] text-violet">Prioritized action plan</p><h2 className="mt-2 text-3xl font-extrabold tracking-tight text-ink">Now, next, later</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Address root risks first. Observation-only findings do not create workstreams of their own.</p></div>
              <div className="space-y-8">{(['now', 'next', 'later'] as Recommendation['priority'][]).map((priority) => { const recommendations = result.recommendations.filter((recommendation) => recommendation.priority === priority); if (recommendations.length === 0) return null; return <div key={priority}><h3 className={`mb-4 inline-flex rounded-full px-3 py-1.5 text-sm font-bold ring-1 ${priorityStyles[priority]}`}>{priorityLabels[priority]}</h3><div className="grid gap-5 lg:grid-cols-2">{recommendations.map((recommendation, index) => <RecommendationCard key={`${recommendation.finding_reference}-${index}`} recommendation={recommendation} finding={relatedFinding(recommendation, result.findings)} />)}</div></div>; })}</div>
            </div>

            {activeCanvasStep === 'assistant' && <DecisionAssistant key={analysisRunId} decisionCanvas={result} />}
          </section>
        )}
      </div>
    </main>
  );
}

export default App;
