import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  HiXMark, HiSparkles, HiCreditCard, HiChartPie, HiCalendar,
  HiBanknotes, HiCurrencyDollar, HiFlag, HiTag, HiFunnel, HiStar,
} from 'react-icons/hi2';
import { useEntitlements } from '../hooks/useEntitlements';
import styles from './PremiumModal.module.css';

export type PremiumFeatureKey =
  | 'ai_chat' | 'cards' | 'credit_cash' | 'categories' | 'budgets'
  | 'debts' | 'deposits' | 'savings' | 'calendar' | 'charts' | 'filters'
  | 'subscriptions' | 'generic';

interface Props {
  feature?: PremiumFeatureKey;
  onClose: () => void;
  onUpgrade?: () => void;
}

const PremiumModal: React.FC<Props> = ({ feature = 'generic', onClose, onUpgrade }) => {
  const { t } = useTranslation();
  const { aiUsed, isPremium } = useEntitlements();

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleUpgrade = () => {
    if (onUpgrade) onUpgrade();
    onClose();
  };

  const headlines: Record<PremiumFeatureKey, { title: string; subtitle: string }> = {
    ai_chat:     { title: t('premium.headline_ai_title'),     subtitle: t('premium.headline_ai_subtitle') },
    cards:       { title: t('premium.headline_cards_title'),  subtitle: t('premium.headline_cards_subtitle') },
    credit_cash: { title: t('premium.headline_cards_title'),  subtitle: t('premium.headline_credit_cash_subtitle') },
    categories:  { title: t('premium.headline_cats_title'),   subtitle: t('premium.headline_cats_subtitle') },
    budgets:     { title: t('premium.headline_budgets_title'),subtitle: t('premium.headline_budgets_subtitle') },
    debts:       { title: t('premium.headline_debts_title'),  subtitle: t('premium.headline_debts_subtitle') },
    deposits:    { title: t('premium.headline_deposits_title'),subtitle: t('premium.headline_deposits_subtitle') },
    savings:     { title: t('premium.headline_savings_title'),subtitle: t('premium.headline_savings_subtitle') },
    calendar:    { title: t('premium.headline_calendar_title'),subtitle: t('premium.headline_calendar_subtitle') },
    charts:      { title: t('premium.headline_charts_title'), subtitle: t('premium.headline_charts_subtitle') },
    filters:     { title: t('premium.headline_filters_title'),subtitle: t('premium.headline_filters_subtitle') },
    subscriptions: { title: t('premium.headline_subs_title'), subtitle: t('premium.headline_subs_subtitle') },
    generic:     { title: t('premium.headline_generic_title'),subtitle: t('premium.headline_generic_subtitle') },
  };

  const head = headlines[feature];

  const features: Array<{ key: PremiumFeatureKey; icon: React.ReactNode; title: string; desc: string }> = [
    { key: 'ai_chat',     icon: <HiSparkles size={20} />,      title: t('premium.f_ai_title'),     desc: t('premium.f_ai_desc') },
    { key: 'cards',       icon: <HiCreditCard size={20} />,    title: t('premium.f_cards_title'),  desc: t('premium.f_cards_desc') },
    { key: 'categories',  icon: <HiTag size={20} />,           title: t('premium.f_cats_title'),   desc: t('premium.f_cats_desc') },
    { key: 'budgets',     icon: <HiCurrencyDollar size={20} />,title: t('premium.f_budgets_title'),desc: t('premium.f_budgets_desc') },
    { key: 'debts',       icon: <HiBanknotes size={20} />,     title: t('premium.f_debts_title'),  desc: t('premium.f_debts_desc') },
    { key: 'deposits',    icon: <HiBanknotes size={20} />,     title: t('premium.f_deposits_title'),desc: t('premium.f_deposits_desc') },
    { key: 'savings',     icon: <HiFlag size={20} />,          title: t('premium.f_savings_title'),desc: t('premium.f_savings_desc') },
    { key: 'calendar',    icon: <HiCalendar size={20} />,      title: t('premium.f_calendar_title'),desc: t('premium.f_calendar_desc') },
    { key: 'charts',      icon: <HiChartPie size={20} />,      title: t('premium.f_charts_title'), desc: t('premium.f_charts_desc') },
    { key: 'filters',     icon: <HiFunnel size={20} />,        title: t('premium.f_filters_title'),desc: t('premium.f_filters_desc') },
  ];

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <button className={styles.close} onClick={onClose} aria-label="Close">
          <HiXMark size={18} />
        </button>

        <div className={styles.hero}>
          <div className={styles.starBadge}>
            <HiStar size={44} />
          </div>
          <h2 className={styles.heroTitle}>{head.title}</h2>
          <p className={styles.heroSubtitle}>{head.subtitle}</p>
          {!isPremium && feature === 'ai_chat' && (
            <div className={styles.trialBanner}>
              {t('premium.ai_usage_banner', { used: aiUsed, limit: 10 })}
            </div>
          )}
        </div>

        <div className={styles.features}>
          {features.map((f) => (
            <div
              key={f.key}
              className={`${styles.feature} ${f.key === feature ? styles.highlight : ''}`}
            >
              <div className={styles.featureIcon}>{f.icon}</div>
              <div className={styles.featureText}>
                <p className={styles.featureTitle}>{f.title}</p>
                <p className={styles.featureDesc}>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.cta}>
          <button className={styles.ctaBtn} onClick={handleUpgrade}>
            <HiSparkles size={18} />
            {t('premium.cta_button')}
          </button>
        </div>

        <p className={styles.footnote}>{t('premium.footnote')}</p>
      </div>
    </div>
  );
};

export default PremiumModal;
