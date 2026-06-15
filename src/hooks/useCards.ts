import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { qk } from '../api/queryClient';
import type { Card, UserSettings } from '../types';

export type NewCard = Omit<Card, 'id' | 'userId' | 'createdAt'>;

function applyOrder(cards: Card[], order: string[]): Card[] {
  if (!order.length) return cards;
  return [...cards].sort((a, b) => {
    const ai = order.indexOf(a.id);
    const bi = order.indexOf(b.id);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

export function useCards(userId: string | null) {
  const uid = userId ?? '';
  const qc = useQueryClient();

  const cardsQ = useQuery({
    queryKey: qk.cards(uid),
    queryFn: () => api.get<Card[]>('/v1/cards'),
    enabled: !!userId,
  });
  const settingsQ = useQuery({
    queryKey: qk.settings(uid),
    queryFn: () => api.get<UserSettings & { id?: string }>('/v1/settings'),
    enabled: !!userId,
  });

  const cardOrder = settingsQ.data?.cardOrder ?? [];
  const cards = applyOrder(cardsQ.data ?? [], cardOrder);

  const invalidateCards = () => qc.invalidateQueries({ queryKey: qk.cards(uid) });

  const saveCardOrder = async (ids: string[]) => {
    if (!userId) return;
    qc.setQueryData(qk.settings(uid), (prev: (UserSettings & { id?: string }) | undefined) => ({
      ...(prev ?? {}),
      cardOrder: ids,
    }));
    await api.patch('/v1/settings', { cardOrder: ids });
  };

  const add = async (data: NewCard) => {
    await api.post('/v1/cards', data);
    await invalidateCards();
  };
  const update = async (id: string, data: Partial<NewCard>) => {
    await api.patch(`/v1/cards/${id}`, data);
    await invalidateCards();
  };
  const remove = async (id: string) => {
    await api.del(`/v1/cards/${id}`);
    await invalidateCards();
  };

  /** Pay down a credit card's debt from a debit/cash card (atomic, server-side). */
  const refill = async (creditCardId: string, sourceCardId: string, amount: number) => {
    await api.post('/v1/cards/refill', { creditCardId, sourceCardId, amount });
    qc.invalidateQueries({ queryKey: qk.cards(uid) });
    qc.invalidateQueries({ queryKey: qk.transactions(uid) });
  };

  return { cards, cardOrder, loading: cardsQ.isLoading, saveCardOrder, add, update, remove, refill };
}
