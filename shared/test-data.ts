import type { TeamProcess } from './types';

/** Sample team processes used for development and testing. */
export const teamProcessTestData: TeamProcess[] = [
  {
    team_name: 'Sales',
    process_owner: 'Not specified',
    booking_approval_channel: 'Self-booked; auto-approved for expenses under €500',
    approval_steps: 1,
    has_policy_compliance_check: false,
    expense_submission_method: 'Photo receipts submitted through the expense app',
    processing_time: '3-5 days',
    systems_used: ['Expense app'],
  },
  {
    team_name: 'Finance/Controlling',
    process_owner: 'Not specified',
    booking_approval_channel:
      'Advance email approval required; a second approval happens after the fact despite pre-approval',
    approval_steps: 2,
    has_policy_compliance_check: true,
    expense_submission_method: 'Paper receipts manually entered into the ERP',
    processing_time: '14-21 days',
    systems_used: ['Email', 'ERP'],
  },
  {
    team_name: 'Operations',
    process_owner: 'Not specified',
    booking_approval_channel: 'Centrally booked by an assistant; approved in batches weeks later',
    approval_steps: 1,
    has_policy_compliance_check: false,
    expense_submission_method: 'Receipts sent irregularly by email',
    processing_time: '21+ days',
    systems_used: ['Email'],
  },
];
