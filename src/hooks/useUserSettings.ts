import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { qk } from '../api/queryClient';
import type { PlannedExpenseVisibility, UserSettings } from '../types';

export const DEFAULT_PLANNED_EXPENSE_VISIBILITY: PlannedExpenseVisibility = 'this_month';

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

  return {
    settings,
    loading: q.isLoading,
    updateSettings,
    plannedExpenseVisibility: settings.plannedExpenseVisibility ?? DEFAULT_PLANNED_EXPENSE_VISIBILITY,
    setPlannedExpenseVisibility,
  };
}
