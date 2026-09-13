/** A simple response returned by the backend health endpoint. */
export interface HealthResponse {
  message: string;
}

/**
 * Describes how a team books, approves, and submits expenses, including its
 * controls, timing, and supporting systems.
 */
export interface TeamProcess {
  team: string;
  booking_owner: string;
  booking_channel: string;
  approval_timing: string;
  approval_steps: number;
  policy_check: string;
  expense_submission: string;
  processing_time_days: string;
  systems_used: string[];
}

/**
 * Captures an assessment of one process area, including the affected teams,
 * whether it works or has a gap, and the evidence behind that assessment.
 */
export interface Finding {
  area:
    | 'policy_check'
    | 'approval_redundancy'
    | 'submission_timeliness'
    | 'audit_trail'
    | 'company_consistency';
  teams_involved: string[];
  rating: 'works' | 'gap';
  severity: 'tolerate' | 'todo' | 'possible_showstopper';
  reasoning: string;
  /** Direct excerpts or careful paraphrases from the supplied process description. */
  evidence: string[];
  /** States whether the finding is explicit, inferred, or still needs confirmation. */
  confidence: 'confirmed' | 'inferred' | 'needs_validation';
  /** Specific questions a process owner should answer before acting on uncertainty. */
  open_questions: string[];
}

/**
 * Links a proposed fix to a finding. It explains the outcome, the useful role
 * for AI, and the decisions a process owner must still make. The ordered
 * strings in steps form a practical numbered implementation plan.
 */
export interface Recommendation {
  finding_reference: string;
  title: string;
  fix_type: 'ai' | 'non_ai';
  recommended_tool?: string;
  /** Places the action in a practical Now / Next / Later roadmap. */
  priority: 'now' | 'next' | 'later';
  owner: string;
  dependencies: string[];
  effort: 'low' | 'medium' | 'high';
  success_metric: string;
  ai_optimization: string;
  process_owner_actions: string[];
  steps: string[];
  /** Explains which part of the shared target process this action improves. */
  target_process_contribution: string;
}

/** One stage in the corrected, company-wide target expense process. */
export interface TargetProcessStep {
  name: string;
  purpose: string;
  owner: string;
  automation: string;
}

/** A single target process, built from the root gaps found across all teams. */
export interface TargetProcess {
  title: string;
  summary: string;
  steps: TargetProcessStep[];
}

/** A decision-ready view of baseline evidence, expected value, and missing data. */
export interface BusinessCase {
  reimbursement_baseline: string;
  manual_effort_baseline: string;
  compliance_risk: string;
  expected_value: string[];
  data_needed: string[];
}

/** Recommends whether existing systems should be retained, connected, or reduced. */
export interface ToolFitDecision {
  system: string;
  decision: 'keep' | 'integrate' | 'reduce';
  rationale: string;
}

export interface ToolFitAnalysis {
  existing_systems: string[];
  decisions: ToolFitDecision[];
}

/** A structured, evidence-aware answer from the contextual Decision Assistant. */
export interface AnalysisAssistantAnswer {
  short_answer: string;
  why_it_matters: string;
  evidence: string[];
  validation_note: string;
  recommended_next_action: string;
}

/**
 * Holds the plain-language process description that a user enters for a team
 * before the backend converts it into a structured TeamProcess.
 */
export interface TeamProcessDescription {
  team: string;
  description: string;
}

/**
 * Groups the two result lists returned after the complete process analysis.
 */
export interface ProcessPipelineResult {
  processes: TeamProcess[];
  findings: Finding[];
  recommendations: Recommendation[];
  target_process: TargetProcess;
  business_case: BusinessCase;
  tool_fit: ToolFitAnalysis;
}
