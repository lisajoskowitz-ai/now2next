import type { TeamProcess } from './types';

/** Sample team processes used for development and testing. */
export const teamProcessTestData: TeamProcess[] = [
  {
    team_name: 'Sales',
    booking_owner: 'Sales',
    booking_channel: 'Self-booked',
    approval_timing: 'Automatic at submission for expenses under €500',
    approval_steps: 1,
    policy_check: 'none',
    expense_submission: 'Photo receipts submitted through the expense app',
    processing_time_days: '3-5',
    systems_used: ['Expense app'],
  },
  {
    team_name: 'Finance/Controlling',
    booking_owner: 'Finance/Controlling',
    booking_channel: 'Advance approval by email',
    approval_timing: 'Second approval after the expense, despite pre-approval',
    approval_steps: 2,
    policy_check: 'yes, manual',
    expense_submission: 'Paper receipts manually entered into the ERP',
    processing_time_days: '14-21',
    systems_used: ['Email', 'ERP'],
  },
  {
    team_name: 'Operations',
    booking_owner: 'Assistant',
    booking_channel: 'Centrally booked by an assistant',
    approval_timing: 'Approved in batches weeks later',
    approval_steps: 1,
    policy_check: 'none',
    expense_submission: 'Receipts sent irregularly by email',
    processing_time_days: '21+',
    systems_used: ['Email'],
  },
];
