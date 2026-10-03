import type { SavingsGoal } from '../types';

const DAY = 86_400_000;

/** Progress numbers shared by the tile and the goal sheet. */
export function goalProgress(goal: Pick<SavingsGoal, 'savedAmount' | 'targetAmount' | 'deadline'>) {
  const done = goal.savedAmount >= goal.targetAmount;
  const pct = goal.targetAmount > 0 ? Math.min(100, (goal.savedAmount / goal.targetAmount) * 100) : 0;
  const days = Math.ceil((goal.deadline - Date.now()) / DAY);
  const now = new Date();
  const end = new Date(goal.deadline);
  const months = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());
  const remaining = Math.max(0, goal.targetAmount - goal.savedAmount);
  const perDay = !done && days > 0 ? remaining / days : 0;
  return { done, pct, days, months, remaining, perDay, overdue: !done && days <= 0 };
}
