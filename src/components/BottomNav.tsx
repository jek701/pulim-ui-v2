import {HiHome, HiArrowsRightLeft, HiCreditCard, HiArrowPath, HiCog6Tooth, HiCalendarDays} from 'react-icons/hi2';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useApp } from '../context';
import { api } from '../api/client';
import { qk } from '../api/queryClient';
import type { Tab } from '../types';
import styles from './BottomNav.module.css';

/**
 * Collections each tab renders on mount. Warming them on press means the target
 * screen usually has data by the time it renders, instead of flashing a full-page
 * spinner on every first visit.
 */
const TAB_PREFETCH: Record<Tab, { key: (uid: string) => readonly unknown[]; path: string }[]> = {
  home:          [{ key: qk.transactions, path: '/v1/transactions' }, { key: qk.cards, path: '/v1/cards' }, { key: qk.budgets, path: '/v1/budgets' }],
  transactions:  [{ key: qk.transactions, path: '/v1/transactions' }, { key: qk.categories, path: '/v1/categories' }, { key: qk.cards, path: '/v1/cards' }],
  cards:         [{ key: qk.cards, path: '/v1/cards' }, { key: qk.savingsGoals, path: '/v1/savings-goals' }, { key: qk.debts, path: '/v1/debts' }],
  subscriptions: [{ key: qk.subscriptions, path: '/v1/subscriptions' }, { key: qk.cards, path: '/v1/cards' }],
  charts:        [{ key: qk.transactions, path: '/v1/transactions' }, { key: qk.categories, path: '/v1/categories' }],
  calendar:      [{ key: qk.transactions, path: '/v1/transactions' }, { key: qk.plannedExpenses, path: '/v1/planned-expenses' }, { key: qk.subscriptions, path: '/v1/subscriptions' }],
  settings:      [{ key: qk.categories, path: '/v1/categories' }, { key: qk.budgets, path: '/v1/budgets' }],
};

const BottomNav = () => {
  const { activeTab, setActiveTab, user, requestTabReset } = useApp();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const prefetch = (tab: Tab) => {
    const uid = user?.uid;
    if (!uid || tab === activeTab) return;
    for (const { key, path } of TAB_PREFETCH[tab]) {
      queryClient.prefetchQuery({ queryKey: key(uid), queryFn: () => api.get(path) });
    }
  };

  const TABS: { id: Tab; label: string; Icon: React.ComponentType<{ size?: number }> }[] = [
    { id: 'home',          label: t('nav.home'),     Icon: HiHome },
    { id: 'transactions',  label: t('nav.history'),  Icon: HiArrowsRightLeft },
    { id: 'cards',         label: t('nav.accounts'), Icon: HiCreditCard },
    { id: 'subscriptions', label: t('nav.subs'),      Icon: HiArrowPath },
    { id: 'calendar',      label: t('nav.calendar'),  Icon: HiCalendarDays },
    { id: 'settings',      label: t('nav.settings'),  Icon: HiCog6Tooth },
  ];

  return (
    <nav className={styles.nav}>
      {TABS.map(({ id, label, Icon }) => (
        <button
          key={id}
          className={`${styles.tab} ${activeTab === id ? styles.active : ''}`}
          aria-current={activeTab === id ? 'page' : undefined}
          onPointerDown={() => prefetch(id)}
          onFocus={() => prefetch(id)}
          onClick={() => (id === activeTab ? requestTabReset() : setActiveTab(id))}
        >
          <span className={styles.icon}><Icon size={20} /></span>
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
};

export default BottomNav;
