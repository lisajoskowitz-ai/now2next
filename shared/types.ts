/** A simple response returned by the backend health endpoint. */
export interface HealthResponse {
  message: string;
}

/**
 * Describes how one team currently runs a process, from submitting an expense
 * through approval and completion.
 */
export interface TeamProcess {
  team_name: string;
  process_owner: string;
  booking_approval_channel: string;
  approval_steps: number;
  has_policy_compliance_check: boolean;
  expense_submission_method: string;
  processing_time: string;
  systems_used: string[];
}

/**
 * Records whether an observed part of a process works or has a gap, how urgent
 * that gap is, and the teams affected by it.
 */
export interface Finding {
  status: 'working' | 'gap';
  severity: 'tolerate' | 'todo' | 'possible_showstopper';
  description: string;
  teams_involved: string[];
}

/**
 * Represents one numbered action needed to put a recommendation into practice.
 */
export interface ImplementationStep {
  step_number: number;
  description: string;
}

/**
 * Links a proposed solution to a finding. AI recommendations include the tool
 * to use and why; non-AI recommendations leave those optional fields empty.
 */
export interface Recommendation {
  finding_reference: string;
  fix_type: 'ai' | 'non_ai';
  recommended_tool?: string;
  reasoning?: string;
  implementation_steps: ImplementationStep[];
}
