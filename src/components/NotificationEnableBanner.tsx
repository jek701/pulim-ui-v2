import {useTranslation} from 'react-i18next';
import {FaTelegramPlane} from 'react-icons/fa';
import {HiXMark} from 'react-icons/hi2';
import {useApp} from '../context';
import styles from './TelegramLinkBanner.module.css';

const NotificationEnableBanner = () => {
  const {t} = useTranslation();
  const {
    activeTab,
    profile,
    saveProfile,
    showTelegramLinkPrompt,
  } = useApp();
  const username = import.meta.env.VITE_TELEGRAM_BOT_USERNAME?.trim();
  const settings = profile?.notifications;
  const visible = activeTab === 'home'
    && Boolean(username)
    && settings?.enabled === true
    && settings.telegram.status !== 'reachable'
    && profile?.notificationsPromptDismissed !== true
    && !showTelegramLinkPrompt;

  if (!visible) return null;
  const href = `https://t.me/${username}?start=notify`;
  const dismiss = () => void saveProfile({notificationsPromptDismissed: true});

  return (
    <div className={styles.banner} role="region" aria-label={t('home.notify_banner_title')}>
      <div className={styles.icon}><FaTelegramPlane size={20}/></div>
      <div className={styles.body}>
        <p className={styles.title}>{t('home.notify_banner_title')}</p>
        <p className={styles.text}>{t('home.notify_banner_body')}</p>
        <div className={styles.actions}>
          <a className={styles.cta} href={href} target="_blank" rel="noreferrer">
            {t('home.notify_banner_cta')}
          </a>
          <button type="button" className={styles.dismiss} onClick={dismiss}>
            {t('home.notify_banner_dismiss')}
          </button>
        </div>
      </div>
      <button type="button" className={styles.close} onClick={dismiss} aria-label={t('home.notify_banner_dismiss')}>
        <HiXMark size={18}/>
      </button>
    </div>
  );
};

export default NotificationEnableBanner;
