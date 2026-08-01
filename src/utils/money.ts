import type { Currency } from '../types';
import { formatAmount } from './format';

/**
 * Upper bound for any user-entered amount. Above ~9e15 float64 silently rounds
 * (18 nines used to display as 1,000,000,000,000,000,300), so cap well below that.
 */
export const MAX_AMOUNT = 999_999_999_999;

/** Decimal places accepted by amount inputs. UZS has no subunit in practice. */
export const AMOUNT_DECIMALS = 2;

/**
 * Money with an explicit sign. Negative totals must never rely on colour alone —
 * that is invisible to colour-blind users and reads as a surplus.
 */
export const formatSignedAmount = (value: number, currency: Currency = 'UZS'): string => {
  const rounded = Math.abs(value) < 0.005 ? 0 : value;
  const sign = rounded < 0 ? '−' : rounded > 0 ? '+' : '';
  return `${sign}${formatAmount(Math.abs(rounded), currency)}`;
};

/** Same as `formatSignedAmount` but leaves positive values unprefixed. */
export const formatWithMinus = (value: number, currency: Currency = 'UZS'): string =>
  (value < 0 ? '−' : '') + formatAmount(Math.abs(value), currency);

/** Parses the raw string produced by `NumberInput` (digits + optional `.`). */
export const parseAmountInput = (raw: string): number => {
  const value = parseFloat(raw);
  return Number.isFinite(value) ? value : 0;
};

// U+00A0 — the same grouping character `formatAmount` (uz-Latn-UZ) renders.
const GROUP_SEPARATOR = '\u00A0';

const groupInteger = (digits: string): string =>
  digits.replace(/\B(?=(\d{3})+(?!\d))/g, GROUP_SEPARATOR);

/**
 * Renders a raw amount string for display inside an input.
 *
 * Grouping uses a space, not a comma: `,` is the decimal separator in ru/uz, so a
 * comma-grouped field made "1,5" ambiguous and it was silently read as 15 — a 10×
 * error in a finance app. With space grouping both `,` and `.` unambiguously mean
 * "decimal point".
 */
export const formatAmountInput = (raw: string): string => {
  if (!raw) return '';
  const negative = raw.startsWith('-');
  const unsigned = negative ? raw.slice(1) : raw;
  if (!unsigned) return negative ? '-' : '';
  const [int, dec] = unsigned.split('.');
  const intFormatted = int ? groupInteger(int.replace(/^0+(?=\d)/, '')) : '0';
  // A trailing '.' is preserved so the caret doesn't jump while typing "0.5".
  const formatted = dec !== undefined ? `${intFormatted}.${dec}` : intFormatted;
  return negative ? `-${formatted}` : formatted;
};

/**
 * Turns whatever the field now contains into the canonical raw string, or null when
 * the keystroke should be rejected outright (letters, a second decimal separator,
 * more than `AMOUNT_DECIMALS` decimals, or a value past `MAX_AMOUNT`).
 */
export const normalizeAmountInput = (input: string, allowNegative = false): string | null => {
  const negative = allowNegative && input.trim().startsWith('-');
  const body = input
    .replace(/^-/, '')
    .replace(/[\s\u00A0\u202F]/g, '')
    .replace(/,/g, '.');

  if (body === '') return negative ? '-' : '';
  if (!/^[\d.]*$/.test(body)) return null;

  const parts = body.split('.');
  // A second separator is rejected instead of being swallowed: "12.34" + "." + "56"
  // used to collapse into 12.3456 — a different number, entered silently.
  if (parts.length > 2) return null;

  const [int, dec] = parts;
  if (dec !== undefined && dec.length > AMOUNT_DECIMALS) return null;

  const digits = int.replace(/^0+(?=\d)/, '');
  if (Number(digits || '0') > MAX_AMOUNT) return null;

  const raw = dec !== undefined ? `${digits || '0'}.${dec}` : digits;
  return negative ? `-${raw}` : raw;
};

export type AmountErrorCode = 'required' | 'positive' | 'too_large';

/** Shared validation for every amount field. Returns null when the value is usable. */
export const amountError = (raw: string, { allowZero = false } = {}): AmountErrorCode | null => {
  if (!raw.trim()) return 'required';
  const value = parseFloat(raw);
  if (!Number.isFinite(value)) return 'required';
  if (!allowZero && value <= 0) return 'positive';
  if (Math.abs(value) > MAX_AMOUNT) return 'too_large';
  return null;
};
