import { useTranslation } from 'react-i18next';
import { FaTelegramPlane } from 'react-icons/fa';
import { HiXMark } from 'react-icons/hi2';
import { useApp } from '../context';
import styles from './TelegramLinkBanner.module.css';

/**
 * One-time nudge shown to a signed-in email user who is inside the Telegram
 * Mini App but hasn't linked Telegram yet (auth option B). Accepting links the
 * account; dismissing records consent so it never shows again.
 */
const TelegramLinkBanner = () => {
  const { t } = useTranslation();
  const {
    showTelegramLinkPrompt,
    telegramLinkPending,
    telegramLinkError,
    linkTelegram,
    dismissTelegramLinkPrompt,
  } = useApp();

  if (!showTelegramLinkPrompt) return null;

  return (
    <div className={styles.banner} role="region" aria-label={t('auth.tg_link_title')}>
      <div className={styles.icon}>
        <FaTelegramPlane size={20} />
      </div>
      <div className={styles.body}>
        <p className={styles.title}>{t('auth.tg_link_title')}</p>
        <p className={styles.text}>{t('auth.tg_link_body')}</p>
        {telegramLinkError && <p className={styles.error}>{telegramLinkError}</p>}
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cta}
            onClick={() => void linkTelegram()}
            disabled={telegramLinkPending}
          >
            {telegramLinkPending ? t('auth.tg_link_pending') : t('auth.tg_link_cta')}
          </button>
          <button
            type="button"
            className={styles.dismiss}
            onClick={dismissTelegramLinkPrompt}
            disabled={telegramLinkPending}
          >
            {t('auth.tg_link_dismiss')}
          </button>
        </div>
      </div>
      <button
        type="button"
        className={styles.close}
        onClick={dismissTelegramLinkPrompt}
        disabled={telegramLinkPending}
        aria-label={t('auth.tg_link_dismiss')}
      >
        <HiXMark size={18} />
      </button>
    </div>
  );
};

export default TelegramLinkBanner;
