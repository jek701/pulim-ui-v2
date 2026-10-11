import type { Tab } from '../types';

const PERSONAL_NAV_TABS: readonly Tab[] = ['home', 'transactions', 'cards', 'subscriptions', 'settings'];
const HOUSEHOLD_NAV_TABS: readonly Tab[] = ['home', 'transactions', 'cards', 'settings'];

export const navTabsForWorkspace = (workspace: 'personal' | 'household'): readonly Tab[] => (
  workspace === 'household' ? HOUSEHOLD_NAV_TABS : PERSONAL_NAV_TABS
);

export const adjacentNavTab = (
  activeTab: Tab,
  workspace: 'personal' | 'household',
  direction: -1 | 1,
): Tab | null => {
  const tabs = navTabsForWorkspace(workspace);
  const index = tabs.indexOf(activeTab);
  if (index < 0) return null;
  return tabs[index + direction] ?? null;
};
