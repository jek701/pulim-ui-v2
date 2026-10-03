import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Card, Currency } from '../../types';
import { formatAmount } from '../../utils/format';
import { NumberInput } from '../NumberInput';
import { Select } from '../FormField';
import Modal from '../Modal';
import styles from '../plastic/forms.module.css';

const REFILL_CHIPS: Record<Currency, number[]> = {
  UZS: [100_000, 500_000, 1_000_000],
  USD: [10, 50, 100],
  EUR: [10, 50, 100],
  RUB: [1_000, 5_000, 10_000],
  GBP: [10, 50, 100],
  CNY: [100, 500, 1_000],
  KZT: [10_000, 50_000, 100_000],
  TRY: [100, 500, 1_000],
  AED: [50, 200, 500],
  JPY: [10_000, 50_000, 100_000],
};

const formatChip = (n: number): string => {
  if (n >= 1_000_000) return `${n / 1_000_000}M`;
  if (n >= 1_000) return `${n / 1_000}K`;
  return String(n);
};

interface Props {
  /** The credit card being paid down. */
  card: Card;
  cards: Card[];
  onRefill: (creditCardId: string, sourceCardId: string, amount: number) => Promise<void>;
  onClose: () => void;
}

/** Pay off credit card debt from a debit/cash account in the same currency. */
const RefillModal = ({ card, cards, onRefill, onClose }: Props) => {
  const { t } = useTranslation();
  const sources = cards.filter(c =>
    (c.cardType === 'debit' || c.cardType === 'cash') && c.currency === card.currency,
  );
  const [sourceId, setSourceId] = useState(sources[0]?.id ?? '');
  const [amountStr, setAmountStr] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const source = sources.find(c => c.id === sourceId);
  const debt = Math.max(0, card.balance);
  const max = source ? Math.min(debt, Math.max(0, source.balance)) : debt;
  const amount = parseFloat(amountStr) || 0;
  const canSave = !!source && amount > 0 && amount <= max;

  const handleRefill = async () => {
    if (!canSave || !source) return;
    setSaving(true);
    setError('');
    try {
      // Atomic server-side refill (pays down credit debt from the source account).
      await onRefill(card.id, source.id, amount);
      onClose();
    } catch (err: unknown) {
      setError((err as { message?: string }).message ?? t('common.error_generic'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={t('cards.refill_title', { name: card.name })}
      onClose={onClose}
      footer={
        <>
          {error && <p className={styles.errorMsg}>{error}</p>}
          <button
            className={`${styles.saveBtn} ${!canSave || saving ? styles.disabled : ''}`}
            onClick={handleRefill}
            disabled={!canSave || saving}
          >
            {saving ? t('common.saving') : t('cards.refill_confirm')}
          </button>
        </>
      }
    >
      <div className={styles.refillSummary}>
        <div>
          <p className={styles.summaryLabel}>{t('cards.label_debt')}</p>
          <p className={styles.refillDebt}>{formatAmount(debt, card.currency)}</p>
        </div>
        <div>
          <p className={styles.summaryLabel}>{t('cards.label_left')}</p>
          <p className={styles.refillLeft}>{formatAmount((card.limit ?? 0) - card.balance, card.currency)}</p>
        </div>
      </div>

      {sources.length === 0 ? (
        <p className={styles.fieldHint}>{t('cards.refill_no_source', { currency: card.currency })}</p>
      ) : (
        <>
          <Select
            label={t('cards.refill_from')}
            value={sourceId}
            onChange={e => setSourceId(e.target.value)}
            options={sources.map(c => ({ value: c.id, label: `${c.name} (${formatAmount(c.balance, c.currency)})` }))}
          />
          <div>
            <label className={styles.fieldLabel}>{t('cards.refill_amount', { currency: card.currency })}</label>
            <NumberInput className={styles.numInput} placeholder="0" value={amountStr} onChange={setAmountStr} />
            <div className={styles.amountChips}>
              {(REFILL_CHIPS[card.currency] ?? REFILL_CHIPS.UZS)
                .filter(v => v <= max)
                .map(v => (
                  <button
                    key={v}
                    type="button"
                    className={`${styles.chip} ${amount === v ? styles.chipActive : ''}`}
                    onClick={() => setAmountStr(String(v))}
                  >
                    {formatChip(v)}
                  </button>
                ))}
              {max > 0 && (
                <button
                  type="button"
                  className={`${styles.chip} ${amount === max ? styles.chipActive : ''}`}
                  onClick={() => setAmountStr(String(max))}
                >
                  {t('cards.refill_max')}
                </button>
              )}
            </div>
            <p className={styles.fieldHint}>{t('cards.refill_hint', { max: formatAmount(max, card.currency) })}</p>
          </div>
        </>
      )}
    </Modal>
  );
};

export default RefillModal;
