import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { qk } from '../api/queryClient';
import type { Transaction } from '../types';

export type NewTransaction = Omit<Transaction, 'id' | 'userId' | 'createdAt'>;

export interface TransferInput {
  fromCardId: string;
  toCardId: string;
  amount: number;
  toAmount?: number;
  baseAmount?: number;
  fxRate?: number;
  fxRateSource?: 'NBU' | 'manual';
}

export interface ReturnInput {
  returnAmount: number;
  accountId?: string;
  date?: number;
  /** Free-text note, e.g. who refunded the money. */
  comment?: string;
}

export interface UpdateTransferInput extends TransferInput {
  date: number;
  comment?: string;
}

export interface UpdateReturnInput extends ReturnInput {
  date: number;
}

export function useTransactions(userId: string | null) {
  const uid = userId ?? '';
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: qk.transactions(uid),
    queryFn: () => api.get<Transaction[]>('/v1/transactions'),
    enabled: !!userId,
  });

  // Server returns date-desc, createdAt-desc already.
  const transactions = q.data ?? [];

  // A transaction can move a card balance — refresh both.
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: qk.transactions(uid) });
    qc.invalidateQueries({ queryKey: qk.cards(uid) });
  };

  const add = async (data: NewTransaction) => {
    await api.post('/v1/transactions', data);
    invalidate();
  };
  const update = async (id: string, data: NewTransaction) => {
    await api.patch(`/v1/transactions/${id}`, data);
    invalidate();
  };
  const remove = async (id: string) => {
    await api.del(`/v1/transactions/${id}`);
    invalidate();
  };
  const clearAll = async () => {
    await api.del('/v1/transactions');
    invalidate();
  };

  /** Atomic card-to-card transfer (replaces the old multi-call sequence). */
  const transfer = async (input: TransferInput) => {
    await api.post('/v1/transactions/transfer', input);
    invalidate();
  };

  /** Atomic (partial) refund of an existing transaction. */
  const returnTransaction = async (originalId: string, input: ReturnInput) => {
    await api.post(`/v1/transactions/${originalId}/return`, input);
    invalidate();
  };

  const updateTransfer = async (id: string, input: UpdateTransferInput) => {
    await api.patch(`/v1/transactions/${id}/transfer`, input);
    invalidate();
  };

  const updateReturn = async (id: string, input: UpdateReturnInput) => {
    await api.patch(`/v1/transactions/${id}/return`, input);
    invalidate();
  };

  return {
    transactions,
    loading: q.isLoading,
    add,
    update,
    remove,
    clearAll,
    transfer,
    returnTransaction,
    updateTransfer,
    updateReturn,
  };
}
