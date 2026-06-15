import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getTodayRawRates, type NbuEntry } from '../utils/nbuRates';
import styles from './ExchangeRatesWidget.module.css';

const DISPLAYED = ['USD', 'EUR', 'RUB'] as const;
const FLAGS: Record<string, string> = { USD: '🇺🇸', EUR: '🇪🇺', RUB: '🇷🇺' };

const formatRate = (raw: string, nominalRaw: string): string => {
  const rate = parseFloat(raw);
  const nominal = parseFloat(nominalRaw) || 1;
  const perUnit = rate / nominal;
  return perUnit.toLocaleString('en-US', { maximumFractionDigits: 2 });
};

const ExchangeRatesWidget = () => {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<NbuEntry[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await getTodayRawRates();
      if (cancelled) return;
      if (!data) { setError(true); return; }
      setEntries(data);
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className={styles.card}>
      <p className={styles.title}>{t('home.exchange_rates_title')}</p>
      {error && <p className={styles.muted}>{t('home.exchange_rates_error')}</p>}
      {!error && !entries && <p className={styles.muted}>…</p>}
      {entries && (
        <div className={styles.list}>
          {DISPLAYED.map(code => {
            const e = entries.find(x => x.Ccy === code);
            if (!e) return null;
            const diff = parseFloat(e.Diff ?? '0');
            const diffStr = diff === 0
              ? '—'
              : `${diff > 0 ? '+' : ''}${diff.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
            const diffClass = diff > 0 ? styles.up : diff < 0 ? styles.down : styles.flat;
            return (
              <div key={code} className={styles.row}>
                <span className={styles.flag}>{FLAGS[code]}</span>
                <span className={styles.code}>{code}</span>
                <span className={styles.rate}>{formatRate(e.Rate, e.Nominal)} <span className={styles.unit}>UZS</span></span>
                <span className={`${styles.diff} ${diffClass}`}>{diffStr}</span>
              </div>
            );
          })}
        </div>
      )}
      <p className={styles.source}>{t('home.exchange_rates_source')}</p>
    </div>
  );
};

export default ExchangeRatesWidget;
