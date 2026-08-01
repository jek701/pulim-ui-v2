import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en';
import ru from './ru';
import uz from './uz';
import { setDayjsLocale } from '../utils/dayjs';

const saved = localStorage.getItem('lang') ?? 'en';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ru: { translation: ru },
    uz: { translation: uz }
  },
  lng: saved,
  // English, not Russian: a Russian fallback made missing `uz` keys look like a
  // deliberate mixed-language UI instead of a gap, so they went unnoticed.
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

setDayjsLocale(saved);
i18n.on('languageChanged', (lng) => setDayjsLocale(lng));

export default i18n;
