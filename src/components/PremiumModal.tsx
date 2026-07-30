import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  HiXMark, HiSparkles, HiCreditCard, HiChartPie, HiCalendar,
  HiBanknotes, HiCurrencyDollar, HiFlag, HiTag, HiFunnel, HiStar,
} from 'react-icons/hi2';
import { useEntitlements } from '../hooks/useEntitlements';
import { paymentApi, type PaymentPlan, type PaymentPlanCode } from '../api/paymentClient';
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
  const { t, i18n } = useTranslation();
  const { aiUsed, isPremium } = useEntitlements();
  const [plans, setPlans] = useState<PaymentPlan[]>([]);
  const [selectedCode, setSelectedCode] = useState<PaymentPlanCode>('premium_12_months');
  const [plansLoading, setPlansLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const idempotencyKey = useRef<string | null>(null);
  const language = (['ru', 'uz', 'en'].includes(i18n.resolvedLanguage ?? '')
    ? i18n.resolvedLanguage
    : 'ru') as 'ru' | 'uz' | 'en';

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setPlansLoading(true);
    setPaymentError(null);
    paymentApi.listPlans(language)
      .then((loaded) => {
        if (!cancelled) setPlans(loaded);
      })
      .catch((error) => {
        console.error('[billing] plans failed:', error);
        if (!cancelled) setPaymentError(t('premium.payment_error'));
      })
      .finally(() => {
        if (!cancelled) setPlansLoading(false);
      });
    return () => { cancelled = true; };
  }, [language, t]);

  const selectedPlan = plans.find((plan) => plan.code === selectedCode) ?? plans[0];
  const formatPrice = (amountMinor: number) => (
    `${new Intl.NumberFormat(language).format(amountMinor / 100)} UZS`
  );

  const selectPlan = (code: PaymentPlanCode) => {
    setSelectedCode(code);
    idempotencyKey.current = null;
    setPaymentError(null);
  };

  const handleUpgrade = async () => {
    if (onUpgrade) {
      onUpgrade();
      onClose();
      return;
    }
    if (!selectedPlan || purchasing) return;
    setPurchasing(true);
    setPaymentError(null);
    try {
      idempotencyKey.current ??= crypto.randomUUID();
      const telegram = (window as unknown as {
        Telegram?: { WebApp?: { initData?: string; openLink?: (url: string) => void } };
      }).Telegram?.WebApp;
      const channel = telegram?.initData ? 'telegram' : 'web';
      const checkout = await paymentApi.createCheckout(
        selectedPlan.code,
        language,
        channel,
        idempotencyKey.current,
      );
      if (!checkout.checkoutUrl) throw new Error('ATMOS checkout URL is missing.');
      if (channel === 'telegram' && telegram?.openLink) {
        telegram.openLink(checkout.checkoutUrl);
      } else {
        window.location.assign(checkout.checkoutUrl);
      }
      onClose();
    } catch (error) {
      console.error('[billing] checkout failed:', error);
      setPaymentError(t('premium.payment_error'));
    } finally {
      setPurchasing(false);
    }
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

        <section className={styles.plans} aria-label={t('premium.choose_plan')}>
          <h3 className={styles.plansTitle}>{t('premium.choose_plan')}</h3>
          {plansLoading ? (
            <div className={styles.plansLoading}>{t('premium.loading_plans')}</div>
          ) : (
            <div className={styles.planGrid}>
              {plans.map((plan) => (
                <button
                  key={plan.code}
                  type="button"
                  className={`${styles.planCard} ${plan.code === selectedPlan?.code ? styles.planCardSelected : ''}`}
                  onClick={() => selectPlan(plan.code)}
                >
                  {plan.code === 'premium_12_months' && (
                    <span className={styles.bestValue}>{t('premium.best_value')}</span>
                  )}
                  <span className={styles.planDuration}>{plan.name}</span>
                  <strong className={styles.planPrice}>{formatPrice(plan.amountMinor)}</strong>
                  <span className={styles.planPerMonth}>
                    {t('premium.per_month', {
                      price: formatPrice(Math.round(plan.amountMinor / plan.durationMonths)),
                    })}
                  </span>
                </button>
              ))}
            </div>
          )}
          {paymentError && <p className={styles.paymentError} role="alert">{paymentError}</p>}
        </section>

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
          <button
            className={styles.ctaBtn}
            onClick={() => void handleUpgrade()}
            disabled={plansLoading || purchasing || !selectedPlan}
          >
            <HiSparkles size={18} />
            {purchasing
              ? t('premium.opening_payment')
              : t('premium.buy_for', { price: selectedPlan ? formatPrice(selectedPlan.amountMinor) : '—' })}
          </button>
        </div>

        <p className={styles.footnote}>{t('premium.footnote')}</p>
      </div>
    </div>
  );
};

export default PremiumModal;
