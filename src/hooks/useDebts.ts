import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { qk } from '../api/queryClient';
import type { Debt } from '../types';

export type NewDebt = Omit<Debt, 'id' | 'userId' | 'createdAt' | 'paidAmount'>;

export function useDebts(userId: string | null) {
  const uid = userId ?? '';
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: qk.debts(uid),
    queryFn: () => api.get<Debt[]>('/v1/debts'),
    enabled: !!userId,
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: qk.debts(uid) });
    qc.invalidateQueries({ queryKey: qk.transactions(uid) });
    qc.invalidateQueries({ queryKey: qk.cards(uid) });
  };

  /** Create a debt; pass `accountId` to also record the initial cash movement atomically. */
  const add = async (data: NewDebt, accountId?: string) => {
    await api.post('/v1/debts', { ...data, accountId });
    invalidateAll();
  };

  const togglePaid = async (id: string, isPaid: boolean) => {
    await api.patch(`/v1/debts/${id}`, { isPaid });
    qc.invalidateQueries({ queryKey: qk.debts(uid) });
  };

  /** Record a (partial) payment; auto-completes when fully paid. Optional account moves money. */
  const pay = async (id: string, amount: number, accountId?: string) => {
    await api.post(`/v1/debts/${id}/pay`, { amount, accountId });
    invalidateAll();
  };

  const remove = async (id: string) => {
    await api.del(`/v1/debts/${id}`);
    qc.invalidateQueries({ queryKey: qk.debts(uid) });
  };

  return { debts: q.data ?? [], loading: q.isLoading, add, togglePaid, pay, remove };
}
