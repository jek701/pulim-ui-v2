import type { HomeWidgetSetting } from '../types';
export type HomeWidgetId = HomeWidgetSetting['id'];
export type { HomeWidgetSetting };

export const DEFAULT_HOME_WIDGETS: HomeWidgetSetting[] = [
  { id: 'balance', enabled: true },
  { id: 'askAi', enabled: true },
  { id: 'budget', enabled: true },
  { id: 'forecast', enabled: true },
  { id: 'exchangeRates', enabled: false },
  { id: 'recent', enabled: true },
];

/** Merge stored config with defaults so newly added widgets show up automatically. */
export function resolveHomeWidgets(stored?: HomeWidgetSetting[] | null): HomeWidgetSetting[] {
  if (!stored || stored.length === 0) return DEFAULT_HOME_WIDGETS;
  const seen = new Set<string>();
  const result: HomeWidgetSetting[] = [];
  for (const w of stored) {
    if (DEFAULT_HOME_WIDGETS.some(d => d.id === w.id) && !seen.has(w.id)) {
      result.push({ id: w.id, enabled: w.enabled !== false });
      seen.add(w.id);
    }
  }
  for (const d of DEFAULT_HOME_WIDGETS) {
    if (!seen.has(d.id)) result.push(d);
  }
  return result;
}
