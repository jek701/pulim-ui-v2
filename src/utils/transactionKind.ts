import type { Transaction } from '../types';

/**
 * `type` is the balance direction of the primary leg, not the business kind.
 * Keep this decision in one place so refunds never silently become income and
 * transfers never silently become expenses in UI code.
 */
export type TransactionKind = 'income' | 'expense' | 'return' | 'transfer';

export const getTransactionKind = (transaction: Pick<Transaction, 'type' | 'source'>): TransactionKind => {
  if (transaction.source === 'return') return 'return';
  if (transaction.source === 'transfer') return 'transfer';
  return transaction.type;
};

export const isRegularTransaction = (transaction: Pick<Transaction, 'source'>): boolean => !transaction.source;

export const isReturnableTransaction = (
  transaction: Pick<Transaction, 'type' | 'source'>,
): boolean => transaction.type === 'expense'
  && (transaction.source == null || transaction.source === 'subscription');
