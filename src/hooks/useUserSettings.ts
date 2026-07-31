import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { qk } from '../api/queryClient';
import type { PlannedExpenseVisibility, UserSettings } from '../types';

export const DEFAULT_PLANNED_EXPENSE_VISIBILITY: PlannedExpenseVisibility = 'this_month';
export const DEFAULT_OPEN_TRANSACTION_ON_LAUNCH = true;

const launchPreferenceKey = (userId: string) => `pulim:open-transaction-on-launch:${userId}`;

type SettingsDoc = UserSettings & { id?: string };

export function useUserSettings(userId: string | null) {
  const uid = userId ?? '';
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: qk.settings(uid),
    queryFn: () => api.get<SettingsDoc>('/v1/settings'),
    enabled: !!userId,
  });

  const settings: UserSettings = q.data ?? {};

  const updateSettings = async (patch: Partial<UserSettings>) => {
    if (!userId) return;
    const updated = await api.patch<SettingsDoc>('/v1/settings', patch);
    qc.setQueryData(qk.settings(uid), updated);
  };

  const setPlannedExpenseVisibility = async (value: PlannedExpenseVisibility) => {
    await updateSettings({ plannedExpenseVisibility: value });
  };

  const setOpenTransactionOnLaunch = async (value: boolean) => {
    if (!userId) return;
    localStorage.setItem(launchPreferenceKey(userId), value ? 'true' : 'false');
    qc.setQueryData(qk.settings(uid), (previous: SettingsDoc | undefined) => ({
      ...(previous ?? {}),
      openTransactionOnLaunch: value,
    }));
    try {
      const updated = await api.patch<SettingsDoc>('/v1/settings', { openTransactionOnLaunch: value });
      qc.setQueryData(qk.settings(uid), updated);
    } catch {
      // This is a per-device UX preference first; keep the local value if an
      // older backend has not added the new settings field yet.
    }
  };

  const storedLaunchPreference = userId ? localStorage.getItem(launchPreferenceKey(userId)) : null;
  const openTransactionOnLaunch = storedLaunchPreference === 'true'
    ? true
    : storedLaunchPreference === 'false'
      ? false
      : settings.openTransactionOnLaunch ?? DEFAULT_OPEN_TRANSACTION_ON_LAUNCH;

  return {
    settings,
    loading: q.isLoading,
    updateSettings,
    plannedExpenseVisibility: settings.plannedExpenseVisibility ?? DEFAULT_PLANNED_EXPENSE_VISIBILITY,
    setPlannedExpenseVisibility,
    openTransactionOnLaunch,
    setOpenTransactionOnLaunch,
  };
}
