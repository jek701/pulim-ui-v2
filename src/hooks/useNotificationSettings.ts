import {useCallback, useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {api} from '../api/client';
import {qk} from '../api/queryClient';
import type {NotificationSettings, UserProfile} from '../types';

export function useNotificationSettings(uid: string | null) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setEnabled = useCallback(async (enabled: boolean) => {
    if (!uid || saving) return;
    const key = qk.profile(uid);
    const previous = queryClient.getQueryData<UserProfile & {id: string}>(key);
    setSaving(true);
    setError(null);
    if (previous?.notifications) {
      queryClient.setQueryData(key, {
        ...previous,
        notifications: {...previous.notifications, enabled},
      });
    }
    try {
      const notifications = await api.patch<NotificationSettings>('/v1/profile/notifications', {enabled});
      queryClient.setQueryData<UserProfile & {id: string} | undefined>(key, current => current
        ? {...current, notifications}
        : current);
    } catch (reason) {
      if (previous) queryClient.setQueryData(key, previous);
      setError(reason instanceof Error ? reason.message : 'Failed to update reminders.');
      throw reason;
    } finally {
      setSaving(false);
      void queryClient.invalidateQueries({queryKey: key});
    }
  }, [uid, saving, queryClient]);

  return {setEnabled, saving, error};
}
