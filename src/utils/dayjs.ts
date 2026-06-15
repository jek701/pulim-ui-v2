import dayjs from 'dayjs';
import 'dayjs/locale/en';
import 'dayjs/locale/ru';
import localizedFormat from 'dayjs/plugin/localizedFormat';

dayjs.extend(localizedFormat);

const initial = (typeof localStorage !== 'undefined' && localStorage.getItem('lang')) || 'en';
dayjs.locale(initial);

/** Switch dayjs locale at runtime — call when i18n language changes. */
export const setDayjsLocale = (lang: string) => {
  dayjs.locale(lang);
};

export default dayjs;
