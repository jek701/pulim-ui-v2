import { useTranslation } from 'react-i18next';
import styles from './AuthLanguageSelector.module.css';

const LANGS = ['uz', 'en', 'ru'] as const;

const AuthLanguageSelector = () => {
  const { t, i18n } = useTranslation();

  const switchLanguage = (lang: typeof LANGS[number]) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('lang', lang);
  };

  return (
    <div className={styles.wrap}>
      <select
        className={styles.select}
        aria-label={t('settings.section_language')}
        value={LANGS.includes(i18n.language as typeof LANGS[number]) ? i18n.language : 'en'}
        onChange={(e) => switchLanguage(e.target.value as typeof LANGS[number])}
      >
        {LANGS.map((lang) => (
          <option key={lang} value={lang}>
            {t(`settings.lang_${lang}`)}
          </option>
        ))}
      </select>
    </div>
  );
};

export default AuthLanguageSelector;
