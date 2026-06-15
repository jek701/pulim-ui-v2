import type { Currency } from '../types';

export const BASE_CURRENCY: Currency = 'UZS';

export type NbuEntry = {
  Code: string;
  Ccy: string;
  CcyNm_EN?: string;
  Nominal: string;
  Rate: string;
  Diff?: string;
  Date: string; // dd.mm.yyyy
};

const RAW_TODAY_KEY = '__rawToday__';
const RAW_CACHE: Record<string, NbuEntry[]> = {};

/** Returns today's raw NBU entries (with Diff field). */
export async function getTodayRawRates(): Promise<NbuEntry[] | null> {
  if (RAW_CACHE[RAW_TODAY_KEY]) return RAW_CACHE[RAW_TODAY_KEY];
  try {
    const res = await fetch('https://cbu.uz/uz/arkhiv-kursov-valyut/json/');
    if (!res.ok) return null;
    const data = (await res.json()) as NbuEntry[];
    RAW_CACHE[RAW_TODAY_KEY] = data;
    return data;
  } catch {
    return null;
  }
}

type CacheShape = Record<string, Record<string, number>>; // dateKey -> { CCY: ratePerUnit }

const MEM_CACHE: CacheShape = {};
const STORAGE_KEY = 'nbuRatesCache_v1';
const PENDING: Record<string, Promise<Record<string, number> | null>> = {};

const loadStorage = (): CacheShape => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as CacheShape;
  } catch {
    return {};
  }
};

const saveStorage = (data: CacheShape) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch { /* quota — ignore */ }
};

const toDateKey = (date: number): string => {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const isToday = (dateKey: string): boolean => toDateKey(Date.now()) === dateKey;

const fetchRatesForDate = async (dateKey: string): Promise<Record<string, number> | null> => {
  const url = isToday(dateKey)
    ? 'https://cbu.uz/uz/arkhiv-kursov-valyut/json/'
    : `https://cbu.uz/uz/arkhiv-kursov-valyut/json/all/${dateKey}/`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as NbuEntry[];
    const map: Record<string, number> = { UZS: 1 };
    for (const e of data) {
      const rate = parseFloat(e.Rate);
      const nominal = parseFloat(e.Nominal) || 1;
      if (!isFinite(rate) || rate <= 0) continue;
      map[e.Ccy] = rate / nominal;
    }
    return map;
  } catch {
    return null;
  }
};

export async function getRates(date: number = Date.now()): Promise<Record<string, number> | null> {
  const dateKey = toDateKey(date);
  if (MEM_CACHE[dateKey]) return MEM_CACHE[dateKey];

  const stored = loadStorage();
  if (stored[dateKey]) {
    MEM_CACHE[dateKey] = stored[dateKey];
    return stored[dateKey];
  }

  if (!PENDING[dateKey]) {
    PENDING[dateKey] = (async () => {
      const fresh = await fetchRatesForDate(dateKey);
      if (fresh) {
        MEM_CACHE[dateKey] = fresh;
        const all = loadStorage();
        all[dateKey] = fresh;
        saveStorage(all);
      }
      return fresh;
    })().finally(() => { delete PENDING[dateKey]; }) as Promise<Record<string, number> | null>;
  }
  return PENDING[dateKey];
}

/** Returns rate of `currency` expressed in UZS per 1 unit, or null if unavailable. */
export async function getRateToBase(currency: Currency, date: number = Date.now()): Promise<number | null> {
  if (currency === BASE_CURRENCY) return 1;
  const rates = await getRates(date);
  if (!rates) return null;
  return rates[currency] ?? null;
}

/** Convert amount from `from` to `to` using NBU rates for given date. */
export async function convert(
  amount: number,
  from: Currency,
  to: Currency,
  date: number = Date.now(),
): Promise<number | null> {
  if (from === to) return amount;
  const rates = await getRates(date);
  if (!rates) return null;
  const fromRate = rates[from];
  const toRate = rates[to];
  if (!fromRate || !toRate) return null;
  return (amount * fromRate) / toRate;
}
