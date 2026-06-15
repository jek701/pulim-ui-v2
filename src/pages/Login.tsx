import { useTranslation } from 'react-i18next';
import AuthMethodsPanel from '../components/AuthMethodsPanel';
import styles from './Login.module.css';

const Login = ({ externalError }: { externalError?: string | null }) => {
  const { t } = useTranslation();

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <h1 className={styles.appName}>Pulim</h1>
        <p className={styles.tagline}>{t('login.subtitle')}</p>
      </div>

      <div className={styles.form}>
        <div className={styles.card}>
          <p className={styles.title}>{t('auth.login_title')}</p>
          <p className={styles.subtitle}>{t('auth.login_subtitle')}</p>
          <AuthMethodsPanel mode="signin" externalError={externalError} showLegacyEmail />
        </div>
      </div>
    </div>
  );
};

export default Login;
