import { useState } from 'react';
import { updateProfile } from 'firebase/auth';
import { useTranslation } from 'react-i18next';
import { HiUser } from 'react-icons/hi2';
import { useApp } from '../context';
import styles from './PhoneNameSetup.module.css';

const PhoneNameSetup = () => {
  const { t } = useTranslation();
  const { user, saveProfile } = useApp();
  const [name, setName] = useState(user?.displayName ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const normalizedName = name.trim().replace(/\s+/g, ' ');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || normalizedName.length < 2) return;

    setSaving(true);
    setError('');
    try {
      await saveProfile({ name: normalizedName });
      await updateProfile(user, { displayName: normalizedName }).catch((err) => {
        console.warn('[auth:phone-name] Firebase Auth profile update failed:', err);
      });
    } catch (err) {
      console.error('[auth:phone-name]', err);
      setError(t('auth.name_error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className={styles.page}>
      <div className={styles.hero}>
        <h1 className={styles.appName}>Pulim</h1>
        <p className={styles.tagline}>{t('login.subtitle')}</p>
      </div>

      <form className={styles.card} onSubmit={handleSubmit}>
        <span className={styles.icon}>
          <HiUser size={24} />
        </span>
        <div className={styles.copy}>
          <h2 className={styles.title}>{t('auth.name_title')}</h2>
          <p className={styles.subtitle}>{t('auth.name_subtitle')}</p>
        </div>
        <label className={styles.label} htmlFor="phone-user-name">
          {t('auth.name_label')}
        </label>
        <input
          id="phone-user-name"
          className={styles.input}
          value={name}
          onChange={(event) => setName(event.target.value.slice(0, 60))}
          placeholder={t('auth.name_placeholder')}
          autoComplete="name"
          autoFocus
          minLength={2}
          maxLength={60}
          required
        />
        <button className={styles.button} disabled={normalizedName.length < 2 || saving} type="submit">
          {saving ? t('auth.name_saving') : t('auth.name_continue')}
        </button>
        {error && <p className={styles.error} role="alert">{error}</p>}
      </form>
    </main>
  );
};

export default PhoneNameSetup;
