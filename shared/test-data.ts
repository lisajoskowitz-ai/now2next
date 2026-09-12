import type { TeamProcess } from './types';

/** Sample team processes used for development and testing. */
export const teamProcessTestData: TeamProcess[] = [
  {
    team: 'Sales',
    booking_owner: 'Employee themselves',
    booking_channel: 'Online booking portal',
    approval_timing:
      'automatic (<€500, no policy check) / after the fact by team lead (>€500)',
    approval_steps: 1,
    policy_check: 'none below €500',
    expense_submission: 'digital, app-based, photo upload',
    processing_time_days: '3-5',
    systems_used: ['Booking portal', 'Expense app'],
  },
  {
    team: 'Finance/Controlling',
    booking_owner: 'Employee themselves, after pre-approval',
    booking_channel: 'no central tool, email approval in advance',
    approval_timing: 'in advance AND after the fact (duplicate)',
    approval_steps: 2,
    policy_check: 'yes, manual, against internal travel policy',
    expense_submission: 'paper form, manual ERP entry',
    processing_time_days: '14-21',
    systems_used: ['Email', 'ERP', 'Paper receipts'],
  },
  {
    team: 'Operations',
    booking_owner: 'Team assistant (centralized)',
    booking_channel: 'centralized booking by a third party',
    approval_timing: 'after the fact, irregular (batch processing)',
    approval_steps: 1,
    policy_check: 'unclear / inconsistent',
    expense_submission: 'email, bundled, no fixed deadline',
    processing_time_days: 'variable, often >21',
    systems_used: ['Email'],
  },
];
