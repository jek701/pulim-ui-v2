import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { qk } from '../api/queryClient';
import type { PlannedExpense } from '../types';

export type NewPlannedExpense = Omit<PlannedExpense, 'id' | 'userId' | 'createdAt'>;

export function usePlannedExpenses(userId: string | null) {
  const uid = userId ?? '';
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: qk.plannedExpenses(uid),
    queryFn: () => api.get<PlannedExpense[]>('/v1/planned-expenses'),
    enabled: !!userId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: qk.plannedExpenses(uid) });

  const add = async (data: NewPlannedExpense) => {
    await api.post('/v1/planned-expenses', data);
    invalidate();
  };
  const update = async (id: string, data: Partial<NewPlannedExpense>) => {
    await api.patch(`/v1/planned-expenses/${id}`, data);
    invalidate();
  };
  const remove = async (id: string) => {
    await api.del(`/v1/planned-expenses/${id}`);
    invalidate();
  };

  return { plannedExpenses: q.data ?? [], loading: q.isLoading, add, update, remove };
}
