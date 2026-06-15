import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { qk } from '../api/queryClient';
import type { SavingsGoal, Currency } from '../types';

export type NewSavingsGoal = {
  name: string;
  icon: string;
  targetAmount: number;
  currency: Currency;
  deadline: number;
};

export function useSavingsGoals(userId: string | null) {
  const uid = userId ?? '';
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: qk.savingsGoals(uid),
    queryFn: () => api.get<SavingsGoal[]>('/v1/savings-goals'),
    enabled: !!userId,
  });

  const add = async (data: NewSavingsGoal) => {
    await api.post('/v1/savings-goals', data);
    qc.invalidateQueries({ queryKey: qk.savingsGoals(uid) });
  };

  /** Contribute to a goal; optional account debit + transaction (atomic). */
  const contribute = async (id: string, amount: number, accountId?: string) => {
    await api.post(`/v1/savings-goals/${id}/contribute`, { amount, accountId });
    qc.invalidateQueries({ queryKey: qk.savingsGoals(uid) });
    qc.invalidateQueries({ queryKey: qk.transactions(uid) });
    qc.invalidateQueries({ queryKey: qk.cards(uid) });
  };

  const remove = async (id: string) => {
    await api.del(`/v1/savings-goals/${id}`);
    qc.invalidateQueries({ queryKey: qk.savingsGoals(uid) });
  };

  return { goals: q.data ?? [], loading: q.isLoading, add, contribute, remove };
}
