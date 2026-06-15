import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { qk } from '../api/queryClient';
import type { Subscription } from '../types';

export type NewSubscription = Omit<Subscription, 'id' | 'userId' | 'createdAt'>;

export function useSubscriptions(userId: string | null) {
  const uid = userId ?? '';
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: qk.subscriptions(uid),
    queryFn: () => api.get<Subscription[]>('/v1/subscriptions'),
    enabled: !!userId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: qk.subscriptions(uid) });

  const add = async (data: NewSubscription) => {
    await api.post('/v1/subscriptions', data);
    invalidate();
  };
  const update = async (id: string, data: Partial<NewSubscription>) => {
    await api.patch(`/v1/subscriptions/${id}`, data);
    invalidate();
  };
  const remove = async (id: string) => {
    await api.del(`/v1/subscriptions/${id}`);
    invalidate();
  };

  /** Record a subscription payment and advance nextBillingDate (atomic). */
  const pay = async (id: string, accountId?: string) => {
    await api.post(`/v1/subscriptions/${id}/pay`, { accountId });
    invalidate();
    qc.invalidateQueries({ queryKey: qk.transactions(uid) });
    qc.invalidateQueries({ queryKey: qk.cards(uid) });
  };

  return { subscriptions: q.data ?? [], loading: q.isLoading, add, update, remove, pay };
}
