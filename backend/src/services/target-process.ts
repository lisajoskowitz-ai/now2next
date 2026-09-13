import type { Finding, TargetProcess } from '../../../shared/types';

/**
 * Defines the corrected shared process for this T&E prototype. It turns the
 * root gaps into one practical operating model without presenting any team's
 * current, flawed process as the company standard.
 */
export function createTargetProcess(findings: Finding[]): TargetProcess {
  const hasPolicyRisk = findings.some(
    (finding) => finding.area === 'policy_check' && finding.rating === 'gap',
  );

  return {
    title: 'Shared target expense process',
    summary: hasPolicyRisk
      ? 'A single digital flow that checks policy before payout, routes only true exceptions, and retains an auditable record.'
      : 'A single digital flow that standardizes submission, approval, reimbursement, and audit evidence across teams.',
    steps: [
      {
        name: 'Digital submission',
        purpose: 'Employees submit receipts and expense details in one digital channel by a defined deadline.',
        owner: 'Employee',
        automation: 'Receipt capture and reminder workflow',
      },
      {
        name: 'Policy & exception check',
        purpose: 'Every claim is checked against approved policy rules before reimbursement; exceptions are visible.',
        owner: 'Finance & Compliance',
        automation: 'Rule-based check with AI support for receipt interpretation',
      },
      {
        name: 'Conditional approval',
        purpose: 'Only claims outside approved thresholds or with policy flags require an additional human decision.',
        owner: 'Accountable approver',
        automation: 'Workflow routing and threshold-based escalation',
      },
      {
        name: 'Reimburse & retain audit trail',
        purpose: 'Finance pays eligible claims and retains linked receipts, policy results, approvals, and timestamps.',
        owner: 'Finance Operations',
        automation: 'System-of-record update and audit-log export',
      },
    ],
  };
}
