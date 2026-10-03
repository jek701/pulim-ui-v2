import type { Currency } from '../types';
import dayjs from './dayjs';

/**
 * BCP-47 tag (or i18n language) → dayjs locale id. `uz` used to fall through to
 * English, so Uzbek screens showed English month and day names.
 */
const localeOf = (l: string) => {
  if (!l) return 'uz-latn';
  if (l.startsWith('ru')) return 'ru';
  if (l.startsWith('uz')) return 'uz-latn';
  return 'uz-latn';
};

type FormatMoneyOptions = {
  withCurrency?: boolean;
  currency?: string;
};

export function formatMoney(
    value: number,
    options: FormatMoneyOptions = {}
): string {
  const { withCurrency = false, currency = "" } = options;

  if (value < 1000) {
    return withCurrency ? `${value} ${currency}` : `${value}`;
  }

  const thousands = Math.floor(value / 1000);

  const formatted = thousands.toLocaleString("en-US");

  const result = `${formatted}K`;

  return withCurrency && currency ? `${result} ${currency}` : result;
}

export const formatAmount = (amount: number, currency: Currency = 'UZS'): string =>
  amount.toLocaleString('uz-Latn-UZ') + ' ' + currency;

export const formatDate = (
  ts: number,
  locale = 'en-US',
  todayStr = 'Today',
  yesterdayStr = 'Yesterday',
): string => {
  const d = dayjs(ts).locale(localeOf(locale));
  const now = dayjs().locale(localeOf(locale));
  if (d.isSame(now, 'day')) return todayStr;
  if (d.isSame(now.subtract(1, 'day'), 'day')) return yesterdayStr;
  return d.year() === now.year() ? d.format('D MMM') : d.format('D MMM YYYY');
};

/** "15 окт", or "15 окт 2027" outside the current year. */
export const formatShortDate = (ts: number, locale = 'en-US'): string => {
  const d = dayjs(ts).locale(localeOf(locale));
  return d.year() === dayjs().year() ? d.format('D MMM') : d.format('D MMM YYYY');
};

export const formatFullDate = (ts: number, locale = 'en-US'): string =>
  dayjs(ts).locale(localeOf(locale)).format('D MMM YYYY');

export const formatMonth = (d: Date | number, locale = 'en-US'): string =>
  dayjs(d).locale(localeOf(locale)).format('MMMM YYYY');

export const formatTime = (ts: number, locale = 'en-US'): string =>
  dayjs(ts).locale(localeOf(locale)).format('HH:mm');

export const toDateInput = (ts: number): string =>
  dayjs(ts).format('YYYY-MM-DD');

export const fromDateInput = (s: string): number =>
  dayjs(s).valueOf();

export const ordinal = (n: number): string => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

/** Per-currency totals in one line, e.g. "12 400 000 UZS · 300 USD". Empty when no items. */
export function formatTotalsByCurrency<T extends { currency: Currency }>(items: T[], value: (item: T) => number): string {
  const totals = new Map<Currency, number>();
  for (const item of items) totals.set(item.currency, (totals.get(item.currency) ?? 0) + value(item));
  return [...totals].map(([cur, n]) => formatAmount(Math.round(n * 100) / 100, cur)).join(' · ');
}
