import dayjs from 'dayjs';
import 'dayjs/locale/en';
import 'dayjs/locale/ru';
import 'dayjs/locale/uz-latn';
import localizedFormat from 'dayjs/plugin/localizedFormat';

dayjs.extend(localizedFormat);

/**
 * App language → dayjs locale id. Our `uz` is Latin script; dayjs ships that as
 * `uz-latn` (plain `uz` is Cyrillic). Passing an unloaded id to `dayjs.locale()`
 * is a silent no-op, which is why `uz` used to keep whatever locale was active
 * and render Russian month names inside Uzbek labels.
 */
const DAYJS_LOCALE: Record<string, string> = {
  uz: 'uz-latn',
};

export const toDayjsLocale = (lang: string): string => {
  const base = lang.split('-')[0];
  return DAYJS_LOCALE[base] ?? base;
};

const initial = (typeof localStorage !== 'undefined' && localStorage.getItem('lang')) || 'en';
dayjs.locale(toDayjsLocale(initial));

/** Switch dayjs locale at runtime — call when i18n language changes. */
export const setDayjsLocale = (lang: string) => {
  dayjs.locale(toDayjsLocale(lang));
};

export default dayjs;
