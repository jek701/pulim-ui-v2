import {useQuery, useQueryClient} from '@tanstack/react-query';
import {api} from '../api/client';
import {qk} from '../api/queryClient';

export interface ShortcutTokenStatus {
  active: boolean;
  hint?: string;
  createdAt?: number;
  lastUsedAt?: number | null;
}

/** Personal key for the iPhone Shortcut. The plain key is only returned by `issue`, once. */
export function useShortcutToken(uid: string | null, enabled: boolean) {
  const queryClient = useQueryClient();
  const key = qk.shortcutToken(uid ?? '_anon');
  const status = useQuery({
    queryKey: key,
    queryFn: () => api.get<ShortcutTokenStatus>('/v1/shortcut-token'),
    enabled: !!uid && enabled,
  });

  const issue = async () => {
    const result = await api.post<{token: string; status: ShortcutTokenStatus}>('/v1/shortcut-token');
    queryClient.setQueryData(key, result.status);
    return result.token;
  };

  const revoke = async () => {
    await api.del('/v1/shortcut-token');
    queryClient.setQueryData<ShortcutTokenStatus>(key, {active: false});
  };

  return {status: status.data, loading: status.isLoading, issue, revoke};
}
