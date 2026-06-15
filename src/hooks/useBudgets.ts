import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { qk } from '../api/queryClient';
import type { Budget, Currency } from '../types';

export function useBudgets(userId: string | null) {
  const uid = userId ?? '';
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: qk.budgets(uid),
    queryFn: () => api.get<Budget[]>('/v1/budgets'),
    enabled: !!userId,
  });
  const budgets = q.data ?? [];

  // Upsert — one budget per category per user.
  const setBudget = async (categoryId: string, amount: number, currency: Currency) => {
    if (!userId) return;
    await api.put(`/v1/budgets/${encodeURIComponent(categoryId)}`, { amount, currency });
    qc.invalidateQueries({ queryKey: qk.budgets(uid) });
  };

  const getBudget = (categoryId: string) => budgets.find((b) => b.categoryId === categoryId);

  return { budgets, loading: q.isLoading, setBudget, getBudget };
}
