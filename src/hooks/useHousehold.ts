import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { qk } from '../api/queryClient';
import type { Budget, Card, Category, Currency, Household, HouseholdInvite, HouseholdInviteStatus, SavingsGoal, Transaction } from '../types';
import { telegramApp } from '../utils/telegram';
import type { NewCard } from './useCards';
import type { NewTransaction } from './useTransactions';
import type { NewSavingsGoal, SavingsGoalPatch } from './useSavingsGoals';

export function useHousehold(userId: string | null) {
  const uid = userId ?? '';
  const qc = useQueryClient();
  const householdQ = useQuery({
    queryKey: qk.household(uid),
    queryFn: () => api.get<Household | null>('/v1/households/current'),
    enabled: !!userId,
  });
  const enabled = !!userId && !!householdQ.data;
  const transactionsQ = useQuery({
    queryKey: qk.householdTransactions(uid),
    queryFn: () => api.get<Transaction[]>('/v1/households/current/transactions'),
    enabled,
  });
  const cardsQ = useQuery({
    queryKey: qk.householdCards(uid),
    queryFn: () => api.get<Card[]>('/v1/households/current/cards'),
    enabled,
  });
  const goalsQ = useQuery({
    queryKey: qk.householdGoals(uid),
    queryFn: () => api.get<SavingsGoal[]>('/v1/households/current/goals'),
    enabled,
  });
  const categoriesQ = useQuery({
    queryKey: qk.householdCategories(uid),
    queryFn: () => api.get<Category[]>('/v1/households/current/categories'),
    enabled,
  });
  const budgetsQ = useQuery({
    queryKey: qk.householdBudgets(uid),
    queryFn: () => api.get<Budget[]>('/v1/households/current/budgets'),
    enabled,
  });

  const invalidateHousehold = () => Promise.all([
    qc.invalidateQueries({ queryKey: qk.household(uid) }),
    qc.invalidateQueries({ queryKey: qk.householdCards(uid) }),
    qc.invalidateQueries({ queryKey: qk.householdTransactions(uid) }),
    qc.invalidateQueries({ queryKey: qk.householdGoals(uid) }),
    qc.invalidateQueries({ queryKey: qk.cards(uid) }),
    qc.invalidateQueries({ queryKey: qk.transactions(uid) }),
  ]);

  const create = async (name: string, currency: Currency = 'UZS') => {
    const created = await api.post<Household>('/v1/households', { name, currency });
    qc.setQueryData(qk.household(uid), created);
    await Promise.all([
      qc.invalidateQueries({ queryKey: qk.householdCategories(uid) }),
      qc.invalidateQueries({ queryKey: qk.householdCards(uid) }),
    ]);
    return created;
  };
  const createInvite = () => api.post<HouseholdInvite>('/v1/households/current/invites', {});
  const invitePath = (token: string) => `/v1/households/current/invites/${encodeURIComponent(token)}`;
  // The server binds prepared Telegram buttons/messages to the account in this init data.
  const telegramBody = () => ({ telegramInitData: telegramApp?.initData ?? '' });
  const prepareInvitePick = (token: string) =>
    api.post<{ buttonId: string }>(`${invitePath(token)}/pick`, telegramBody());
  const prepareInviteShare = (token: string) =>
    api.post<{ messageId: string }>(`${invitePath(token)}/share`, telegramBody());
  const getInviteStatus = (token: string) => api.get<HouseholdInviteStatus>(invitePath(token));
  const getInvite = (token: string) => api.get<HouseholdInvite>(`/v1/households/invites/${encodeURIComponent(token)}`);
  const acceptInvite = async (token: string) => {
    const accepted = await api.post<Household>(`/v1/households/invites/${encodeURIComponent(token)}/accept`, {});
    qc.setQueryData(qk.household(uid), accepted);
    await invalidateHousehold();
    return accepted;
  };
  const addTransaction = async (data: NewTransaction) => {
    await api.post('/v1/households/current/transactions', data);
    await invalidateHousehold();
  };
  const updateTransaction = async (id: string, data: NewTransaction) => {
    await api.patch(`/v1/households/current/transactions/${id}`, data);
    await invalidateHousehold();
  };
  const removeTransaction = async (id: string) => {
    await api.del(`/v1/households/current/transactions/${id}`);
    await invalidateHousehold();
  };
  const addGoal = async (data: NewSavingsGoal) => {
    await api.post('/v1/households/current/goals', data);
    await qc.invalidateQueries({ queryKey: qk.householdGoals(uid) });
  };
  const updateGoal = async (id: string, patch: SavingsGoalPatch) => {
    await api.patch(`/v1/households/current/goals/${id}`, patch);
    await qc.invalidateQueries({ queryKey: qk.householdGoals(uid) });
  };
  const contributeGoal = async (id: string, amount: number, accountId: string) => {
    await api.post(`/v1/households/current/goals/${id}/contribute`, { amount, accountId });
    await invalidateHousehold();
  };
  const removeGoal = async (id: string) => {
    await api.del(`/v1/households/current/goals/${id}`);
    await qc.invalidateQueries({ queryKey: qk.householdGoals(uid) });
  };
  const addSharedCard = async (data: NewCard) => {
    await api.post('/v1/households/current/cards', data);
    await invalidateHousehold();
  };
  const setCardAccess = async (id: string, enabledAccess: boolean, showBalance: boolean) => {
    await api.patch(`/v1/households/current/cards/${id}/access`, { enabled: enabledAccess, showBalance });
    await invalidateHousehold();
  };
  const setBudget = async (categoryId: string, amount: number, currency: Currency) => {
    await api.put(`/v1/households/current/budgets/${encodeURIComponent(categoryId)}`, { amount, currency });
    await qc.invalidateQueries({ queryKey: qk.householdBudgets(uid) });
  };

  return {
    household: householdQ.data ?? null,
    householdLoading: householdQ.isLoading,
    transactions: transactionsQ.data ?? [],
    cards: cardsQ.data ?? [],
    goals: goalsQ.data ?? [],
    categories: categoriesQ.data ?? [],
    budgets: budgetsQ.data ?? [],
    spaceLoading: transactionsQ.isLoading || cardsQ.isLoading || goalsQ.isLoading || categoriesQ.isLoading || budgetsQ.isLoading,
    create,
    createInvite,
    getInvite,
    prepareInvitePick,
    prepareInviteShare,
    getInviteStatus,
    acceptInvite,
    addTransaction,
    updateTransaction,
    removeTransaction,
    addGoal,
    updateGoal,
    contributeGoal,
    removeGoal,
    addSharedCard,
    setCardAccess,
    setBudget,
    refresh: invalidateHousehold,
  };
}
