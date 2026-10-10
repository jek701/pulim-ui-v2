import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { qk } from '../api/queryClient';
import type { CommunicationPreferences, InAppMessage } from '../communications/types';

export function useCommunications(uid: string | null) {
  const queryClient = useQueryClient();
  const inboxKey = qk.communicationInbox(uid ?? '_anon');
  const preferencesKey = qk.communicationPreferences(uid ?? '_anon');
  const inbox = useQuery({
    queryKey: inboxKey,
    queryFn: () => api.get<InAppMessage[]>('/v1/communications/inbox'),
    enabled: !!uid,
    refetchInterval: 60_000,
  });
  const preferences = useQuery({
    queryKey: preferencesKey,
    queryFn: () => api.get<CommunicationPreferences>('/v1/communications/preferences'),
    enabled: !!uid,
  });
  const updatePreferences = useMutation({
    mutationFn: (marketing: Partial<CommunicationPreferences['marketing']>) =>
      api.patch<CommunicationPreferences>('/v1/communications/preferences', { marketing }),
    onSuccess: (data) => queryClient.setQueryData(preferencesKey, data),
  });
  const event = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'read' | 'click' | 'dismiss' }) =>
      api.post<InAppMessage>(`/v1/communications/inbox/${id}/${action}`),
    onSuccess: (data) => queryClient.setQueryData<InAppMessage[]>(inboxKey, current =>
      (current ?? []).map(item => item.id === data.id ? data : item)),
  });
  const messages = inbox.data ?? [];
  return {
    messages,
    unread: messages.filter(item => !item.readAt && !item.dismissedAt).length,
    surface: messages.find(item => !item.readAt && !item.dismissedAt && item.presentation !== 'inbox'),
    preferences: preferences.data ?? { marketing: { inApp: true, telegram: false } },
    loading: inbox.isLoading || preferences.isLoading,
    updatePreferences,
    event,
  };
}

export function useCommunicationAdminAccess(uid: string | null) {
  return useQuery({
    queryKey: qk.communicationAdminAccess(uid ?? '_anon'),
    queryFn: () => api.get<{ enabled: boolean }>('/v1/communications/admin/access'),
    enabled: !!uid,
    staleTime: Infinity,
    retry: false,
  });
}
