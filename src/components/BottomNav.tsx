import {HiHome, HiArrowsRightLeft, HiCreditCard, HiArrowPath, HiCog6Tooth, HiCalendarDays} from 'react-icons/hi2';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context';
import type { Tab } from '../types';
import styles from './BottomNav.module.css';

const BottomNav = () => {
  const { activeTab, setActiveTab } = useApp();
  const { t } = useTranslation();

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
          onClick={() => setActiveTab(id)}
        >
          <span className={styles.icon}><Icon size={20} /></span>
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
};

export default BottomNav;
