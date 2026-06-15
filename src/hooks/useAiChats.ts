import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { qk } from '../api/queryClient';
import type { AiChat } from '../types';

export function useAiChats(userId: string | null) {
  const uid = userId ?? '';
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: qk.aiChats(uid),
    queryFn: () => api.get<AiChat[]>('/v1/ai-chats'),
    enabled: !!userId,
  });

  // Creation + message appends happen server-side inside /v1/ai/chat; this hook
  // covers listing and managing existing chats.
  const rename = async (chatId: string, title: string) => {
    await api.patch(`/v1/ai-chats/${chatId}`, { title });
    qc.invalidateQueries({ queryKey: qk.aiChats(uid) });
  };
  const remove = async (chatId: string) => {
    await api.del(`/v1/ai-chats/${chatId}`);
    qc.invalidateQueries({ queryKey: qk.aiChats(uid) });
  };

  return { chats: q.data ?? [], loading: q.isLoading, rename, remove };
}
