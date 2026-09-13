import type {
  BusinessCase,
  Finding,
  Recommendation,
  TeamProcess,
  ToolFitAnalysis,
  ToolFitDecision,
} from '../../../shared/types';

/** Builds a transparent value snapshot from supplied evidence without inventing savings figures. */
export function createBusinessCase(processes: TeamProcess[], findings: Finding[]): BusinessCase {
  const hasManualWork = processes.some((process) => /paper|manual|email/i.test(`${process.expense_submission} ${process.systems_used.join(' ')}`));
  const showstopper = findings.find((finding) => finding.severity === 'possible_showstopper');

  return {
    reimbursement_baseline: `Current team-reported reimbursement times: ${processes.map((process) => `${process.team}: ${process.processing_time_days} days`).join('; ')}.`,
    manual_effort_baseline: hasManualWork
      ? 'Manual handling is evidenced through paper, email, or manual system entry. Measure minutes per claim before setting a savings target.'
      : 'No manual-handling burden is explicitly evidenced. Validate effort with a short time-and-motion sample.',
    compliance_risk: showstopper
      ? `Critical: ${showstopper.reasoning}`
      : 'No critical compliance risk is confirmed from the supplied descriptions; validate controls with Compliance.',
    expected_value: [
      'Reduce avoidable approval and submission delays by resolving the identified root gaps.',
      'Create an auditable record of receipts, policy outcomes, and approvals in the system of record.',
      'Use automation for routing and reminders while retaining human ownership of policy and exceptions.',
    ],
    data_needed: [
      'Monthly claim volume and average minutes spent per claim',
      'Current exception, rework, and late-submission rates',
      'Average reimbursement cycle time and the cost of delayed reimbursement',
    ],
  };
}

/** Makes system recommendations explicit so workflow tools are not proposed as a blanket replacement. */
export function createToolFitAnalysis(processes: TeamProcess[], recommendations: Recommendation[]): ToolFitAnalysis {
  const systems = [...new Set(processes.flatMap((process) => process.systems_used))];
  const decisions: ToolFitDecision[] = systems.map((system) => {
    if (/email|paper/i.test(system)) {
      return { system, decision: 'reduce', rationale: 'Reduce as a primary submission or approval channel; retain only where a documented exception requires it.' };
    }
    if (/erp/i.test(system)) {
      return { system, decision: 'integrate', rationale: 'Keep the ERP as a financial system of record and connect approved claim data through a controlled workflow.' };
    }
    return { system, decision: 'keep', rationale: 'Retain as a working digital touchpoint and assess whether it can provide the required policy, receipt, and audit data.' };
  });

  if (recommendations.some((recommendation) => recommendation.recommended_tool === 'n8n')) {
    decisions.push({ system: 'n8n', decision: 'integrate', rationale: 'Use as orchestration for approved rules, routing, reminders, and system handoffs; it does not replace policy ownership or the system of record.' });
  }

  return { existing_systems: systems, decisions };
}
