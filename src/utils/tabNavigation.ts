import type { Tab } from '../types';

const PERSONAL_NAV_TABS: readonly Tab[] = ['home', 'transactions', 'cards', 'subscriptions', 'settings'];
const HOUSEHOLD_NAV_TABS: readonly Tab[] = ['home', 'transactions', 'cards', 'settings'];

export const navTabsForWorkspace = (workspace: 'personal' | 'household'): readonly Tab[] => (
  workspace === 'household' ? HOUSEHOLD_NAV_TABS : PERSONAL_NAV_TABS
);
