import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { qk } from '../api/queryClient';
import type { CampaignDraft, CommunicationCampaign } from '../communications/types';

export function useCommunicationAdmin(uid: string) {
  const queryClient = useQueryClient();
  const key = qk.communicationCampaigns(uid);
  const list = useQuery({ queryKey: key, queryFn: () => api.get<CommunicationCampaign[]>('/v1/communications/admin/campaigns'), refetchInterval: 30_000 });
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });
  const create = useMutation({ mutationFn: (draft: CampaignDraft) => api.post<CommunicationCampaign>('/v1/communications/admin/campaigns', draft), onSuccess: refresh });
  const send = useMutation({ mutationFn: ({ id, scheduledAt }: { id: string; scheduledAt?: number | null }) => api.post<CommunicationCampaign>(`/v1/communications/admin/campaigns/${id}/send`, { scheduledAt }), onSuccess: refresh });
  const pause = useMutation({ mutationFn: (id: string) => api.post<CommunicationCampaign>(`/v1/communications/admin/campaigns/${id}/pause`), onSuccess: refresh });
  return { campaigns: list.data ?? [], loading: list.isLoading, create, send, pause };
}
