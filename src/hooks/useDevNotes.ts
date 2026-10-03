import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {api} from '../api/client';
import {qk} from '../api/queryClient';

export type DevNoteStatus = 'new' | 'in_progress' | 'done' | 'needs_reply' | 'rejected';

export interface DevNoteContext {
  tab?: string;
  url?: string;
  modal?: string;
  headings?: string[];
  selector?: string;
  elementTag?: string;
  elementText?: string;
  elementLabel?: string;
  rect?: {x: number; y: number; width: number; height: number};
  viewport?: {width: number; height: number; dpr: number};
  theme?: string;
  language?: string;
  userAgent?: string;
}

export interface DevNote {
  id: string;
  source: 'app' | 'telegram';
  comment: string;
  status: DevNoteStatus;
  context: DevNoteContext | null;
  hasScreenshot: boolean;
  thread: {author: 'owner' | 'claude'; text: string; at: number}[];
  commits: string[];
  createdAt: number;
  updatedAt: number;
}

/** Owner-only feedback queue; the server answers `enabled: false` for everyone else. */
export function useDevNotesAccess(uid: string | null) {
  return useQuery({
    queryKey: qk.devNotesAccess(uid ?? '_anon'),
    queryFn: () => api.get<{enabled: boolean}>('/v1/dev-notes/access'),
    enabled: !!uid,
    staleTime: Infinity,
    retry: false,
  });
}

export function useDevNotes(uid: string) {
  const queryClient = useQueryClient();
  const key = qk.devNotes(uid);
  const list = useQuery({
    queryKey: key,
    queryFn: () => api.get<DevNote[]>('/v1/dev-notes'),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
  const upsert = (note: DevNote) => queryClient.setQueryData<DevNote[]>(key, current => [
    note,
    ...(current ?? []).filter(item => item.id !== note.id),
  ].sort((a, b) => b.createdAt - a.createdAt));

  const create = useMutation({
    mutationFn: (body: {comment: string; context?: DevNoteContext; screenshot?: string}) =>
      api.post<DevNote>('/v1/dev-notes', body),
    onSuccess: upsert,
  });
  const reply = useMutation({
    mutationFn: ({id, text}: {id: string; text: string}) => api.post<DevNote>(`/v1/dev-notes/${id}/replies`, {text}),
    onSuccess: upsert,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/v1/dev-notes/${id}`),
    onSuccess: (_result, id) => queryClient.setQueryData<DevNote[]>(key, current => (current ?? []).filter(item => item.id !== id)),
  });

  return {notes: list.data ?? [], loading: list.isLoading, refetch: list.refetch, create, reply, remove};
}

export const fetchDevNoteScreenshot = (id: string) =>
  api.get<{dataUrl: string}>(`/v1/dev-notes/${id}/screenshot`).then(result => result.dataUrl);
