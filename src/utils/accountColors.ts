import type { Card } from '../types';

/**
 * Gradient palette for account "plastics". The key is what the API stores in
 * `card.color`; an unset colour falls back to a stable pick by bank name, so two
 * untouched cards of the same bank still look alike.
 */
export interface AccountColor {
  key: string;
  from: string;
  to: string;
}

export const ACCOUNT_COLORS: AccountColor[] = [
  { key: 'violet',   from: '#7C3AED', to: '#C026D3' },
  { key: 'indigo',   from: '#3730A3', to: '#6366F1' },
  { key: 'ocean',    from: '#0369A1', to: '#22D3EE' },
  { key: 'teal',     from: '#0F766E', to: '#2DD4BF' },
  { key: 'emerald',  from: '#047857', to: '#84CC16' },
  { key: 'sunset',   from: '#EA580C', to: '#F43F5E' },
  { key: 'rose',     from: '#BE185D', to: '#FB7185' },
  { key: 'gold',     from: '#A16207', to: '#F59E0B' },
  { key: 'graphite', from: '#1F2937', to: '#4B5563' },
];

const BY_KEY = new Map(ACCOUNT_COLORS.map(c => [c.key, c]));

/** Default per type when there is no bank name to hash (cash, or an empty bank). */
const TYPE_DEFAULT: Record<Card['cardType'], string> = {
  debit: 'violet',
  credit: 'graphite',
  cash: 'emerald',
};

const hash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};

export function autoAccountColorKey(card: Pick<Card, 'cardType' | 'bank'>): string {
  const bank = card.bank.trim().toLowerCase();
  if (card.cardType === 'cash' || !bank) return TYPE_DEFAULT[card.cardType];
  return ACCOUNT_COLORS[hash(bank) % ACCOUNT_COLORS.length].key;
}

export function resolveAccountColor(card: Pick<Card, 'cardType' | 'bank' | 'color'>): AccountColor {
  return BY_KEY.get(card.color ?? '') ?? BY_KEY.get(autoAccountColorKey(card))!;
}
