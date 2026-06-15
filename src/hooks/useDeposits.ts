import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { qk } from '../api/queryClient';
import type { Deposit } from '../types';

export type NewDeposit = Omit<
  Deposit,
  'id' | 'userId' | 'createdAt' | 'interestPaidOut' | 'isClosed' | 'closedAt' | 'lastInterestPaidAt'
>;

export function useDeposits(userId: string | null) {
  const uid = userId ?? '';
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: qk.deposits(uid),
    queryFn: () => api.get<Deposit[]>('/v1/deposits'),
    enabled: !!userId,
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: qk.deposits(uid) });
    qc.invalidateQueries({ queryKey: qk.transactions(uid) });
    qc.invalidateQueries({ queryKey: qk.cards(uid) });
  };

  const add = async (data: NewDeposit) => {
    await api.post('/v1/deposits', data);
    qc.invalidateQueries({ queryKey: qk.deposits(uid) });
  };
  const remove = async (id: string) => {
    await api.del(`/v1/deposits/${id}`);
    qc.invalidateQueries({ queryKey: qk.deposits(uid) });
  };

  // The server computes the interest amount and performs the balance + transaction atomically.
  const collectInterest = async (depositId: string) => {
    await api.post(`/v1/deposits/${depositId}/collect-interest`);
    invalidateAll();
  };
  const closeDeposit = async (id: string, accountId: string) => {
    await api.post(`/v1/deposits/${id}/close`, { accountId });
    invalidateAll();
  };
  const replenish = async (id: string, accountId: string, amount: number) => {
    await api.post(`/v1/deposits/${id}/replenish`, { accountId, amount });
    invalidateAll();
  };
  const withdraw = async (id: string, accountId: string, amount: number) => {
    await api.post(`/v1/deposits/${id}/withdraw`, { accountId, amount });
    invalidateAll();
  };

  return { deposits: q.data ?? [], loading: q.isLoading, add, remove, collectInterest, closeDeposit, replenish, withdraw };
}
