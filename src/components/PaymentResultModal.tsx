import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  HiArrowPath,
  HiCalendarDays,
  HiChartPie,
  HiCheck,
  HiCreditCard,
  HiSparkles,
  HiXMark,
} from 'react-icons/hi2';
import type { PaymentResult } from '../context';
import styles from './PaymentResultModal.module.css';

interface Props {
  result: PaymentResult | null;
  onClose: () => void;
}

const confetti = [
  ['8%', '#fbbf24', -14, 0.05], ['15%', '#fb7185', 18, 0.18],
  ['24%', '#60a5fa', -22, 0.28], ['34%', '#c084fc', 14, 0.1],
  ['44%', '#34d399', -16, 0.34], ['54%', '#f472b6', 22, 0.2],
  ['64%', '#fbbf24', -18, 0.02], ['73%', '#818cf8', 16, 0.3],
  ['84%', '#4ade80', -24, 0.12], ['92%', '#fb7185', 18, 0.24],
] as const;

const PaymentResultModal: React.FC<Props> = ({ result, onClose }) => {
  const { t, i18n } = useTranslation();

  useEffect(() => {
    if (!result) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [result]);

  const order = result?.phase === 'success' ? result.order : null;
  const validUntil = order?.entitlementEndAt
    ? new Intl.DateTimeFormat(
        i18n.resolvedLanguage === 'uz' ? 'uz-UZ'
          : i18n.resolvedLanguage === 'en' ? 'en-GB' : 'ru-RU',
        { day: 'numeric', month: 'long', year: 'numeric' },
      ).format(new Date(order.entitlementEndAt))
    : null;

  const benefits = [
    { icon: <HiSparkles />, text: t('payment_result.benefit_ai') },
    { icon: <HiCreditCard />, text: t('payment_result.benefit_accounts') },
    { icon: <HiChartPie />, text: t('payment_result.benefit_analytics') },
    { icon: <HiCalendarDays />, text: t('payment_result.benefit_planning') },
  ];
  const planName = order
    ? t(`payment_result.plan_${order.durationMonths}`, {
        defaultValue: t('payment_result.plan_name', { months: order.durationMonths }),
      })
    : '';

  return (
    <AnimatePresence>
      {result && (
        <motion.div
          className={styles.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="presentation"
        >
          <motion.section
            className={styles.card}
            initial={{ opacity: 0, y: 42, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 28, scale: 0.96 }}
            transition={{ type: 'spring', damping: 24, stiffness: 260 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-result-title"
          >
            {result.phase !== 'checking' && (
              <button className={styles.close} onClick={onClose} aria-label={t('payment_result.close')}>
                <HiXMark size={20} />
              </button>
            )}

            {result.phase === 'checking' && (
              <div className={styles.checking}>
                <div className={styles.loader}><HiArrowPath size={34} /></div>
                <h2 id="payment-result-title">{t('payment_result.checking_title')}</h2>
                <p>{t('payment_result.checking_desc')}</p>
              </div>
            )}

            {result.phase === 'delayed' && (
              <div className={styles.delayed}>
                <div className={styles.delayedIcon}><HiArrowPath size={32} /></div>
                <h2 id="payment-result-title">{t('payment_result.delayed_title')}</h2>
                <p>{t('payment_result.delayed_desc')}</p>
                <button className={styles.secondaryButton} onClick={onClose}>
                  {t('payment_result.close')}
                </button>
              </div>
            )}

            {result.phase === 'success' && order && (
              <>
                <div className={styles.hero}>
                  <div className={styles.glow} />
                  <div className={styles.confetti} aria-hidden="true">
                    {confetti.map(([left, color, rotate, delay], index) => (
                      <motion.span
                        key={`${left}-${index}`}
                        style={{ left, background: color }}
                        initial={{ y: -70, opacity: 0, rotate: 0 }}
                        animate={{ y: 190, opacity: [0, 1, 1, 0], rotate: rotate * 8 }}
                        transition={{ duration: 1.7, delay, ease: 'easeOut' }}
                      />
                    ))}
                  </div>
                  <motion.div
                    className={styles.checkmark}
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', delay: 0.12, stiffness: 230, damping: 15 }}
                  >
                    <HiCheck size={50} strokeWidth={2.4} />
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.28 }}
                  >
                    <span className={styles.badge}>{t('payment_result.success_badge')}</span>
                    <h2 id="payment-result-title">{t('payment_result.success_title')}</h2>
                    <p>{t('payment_result.success_desc')}</p>
                  </motion.div>
                </div>

                <motion.div
                  className={styles.body}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.38 }}
                >
                  <div className={styles.planCard}>
                    <div>
                      <span>{t('payment_result.your_plan')}</span>
                      <strong>{planName}</strong>
                    </div>
                    {validUntil && (
                      <div className={styles.until}>
                        <HiCalendarDays size={20} />
                        <div>
                          <span>{t('payment_result.active_until')}</span>
                          <strong>{validUntil}</strong>
                        </div>
                      </div>
                    )}
                  </div>

                  <h3>{t('payment_result.benefits_title')}</h3>
                  <div className={styles.benefits}>
                    {benefits.map((benefit, index) => (
                      <motion.div
                        className={styles.benefit}
                        key={benefit.text}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.46 + index * 0.07 }}
                      >
                        <span>{benefit.icon}</span>
                        <p>{benefit.text}</p>
                      </motion.div>
                    ))}
                  </div>

                  <button className={styles.primaryButton} onClick={onClose}>
                    <HiSparkles size={19} />
                    {t('payment_result.continue')}
                  </button>
                </motion.div>
              </>
            )}
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PaymentResultModal;
