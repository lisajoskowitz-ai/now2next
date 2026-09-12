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
}

/**
 * Links a proposed fix to a finding. The ordered strings in steps form a
 * numbered implementation plan; an AI tool is included only when it is needed.
 */
export interface Recommendation {
  finding_reference: string;
  fix_type: 'ai' | 'non_ai';
  recommended_tool?: string;
  steps: string[];
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
  findings: Finding[];
  recommendations: Recommendation[];
}
