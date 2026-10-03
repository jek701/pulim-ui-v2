import type { Debt } from '../types';

/** Principal plus commission (percent of principal, or a fixed amount). */
export function debtTotal(debt: Pick<Debt, 'amount' | 'commission'>): number {
  const c = debt.commission;
  if (!c) return debt.amount;
  return c.type === 'percent' ? debt.amount + debt.amount * (c.value / 100) : debt.amount + c.value;
}

export function debtRemaining(debt: Pick<Debt, 'amount' | 'commission' | 'paidAmount'>): number {
  return Math.max(0, debtTotal(debt) - (debt.paidAmount || 0));
}

/** Due date already passed (before today) on an unpaid debt. */
export function isDebtOverdue(debt: Pick<Debt, 'dueDate' | 'isPaid'>): boolean {
  if (debt.isPaid || !debt.dueDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return debt.dueDate < today.getTime();
}
