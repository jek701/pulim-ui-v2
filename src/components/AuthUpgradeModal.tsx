import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from './Modal';
import AuthMethodsPanel from './AuthMethodsPanel';
import { useApp } from '../context';
import type { AuthMethod } from '../types';
import styles from './AuthUpgradeModal.module.css';

const LABELS: Record<AuthMethod, string> = {
  telegram: 'Telegram',
  email: 'Email',
  google: 'Google',
  apple: 'Apple',
  phone: 'Phone',
};

const AuthUpgradeModal = ({ onClose }: { onClose: () => void }) => {
  const { t } = useTranslation();
  const { linkedAuthMethods } = useApp();

  const methods = useMemo(
    () => linkedAuthMethods.map((method) => t(`auth.method_${method}`, LABELS[method])),
    [linkedAuthMethods, t]
  );

  return (
    <Modal title={t('auth.upgrade_title')} onClose={onClose}>
      <div className={styles.copy}>
        <p className={styles.lead}>{t('auth.upgrade_body')}</p>
        {methods.length > 0 && (
          <div className={styles.methodBlock}>
            <p className={styles.methodLabel}>{t('auth.current_methods')}</p>
            <div className={styles.methodList}>
              {methods.map((method) => (
                <span key={method} className={styles.methodChip}>{method}</span>
              ))}
            </div>
          </div>
        )}
        <p className={styles.note}>{t('auth.upgrade_note')}</p>
      </div>

      <AuthMethodsPanel mode="link" onSuccess={onClose} />
    </Modal>
  );
};

export default AuthUpgradeModal;
