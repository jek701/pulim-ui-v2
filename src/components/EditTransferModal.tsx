import { useEffect, useMemo, useRef, useState } from 'react';
import { HiCheck } from 'react-icons/hi2';
import { useTranslation } from 'react-i18next';
import type { Card, Transaction } from '../types';
import type { UpdateTransferInput } from '../hooks/useTransactions';
import { formatAmount, toDateInput } from '../utils/format';
import { BASE_CURRENCY, convert, getRateToBase } from '../utils/nbuRates';
import Modal from './Modal';
import { Input, Select } from './FormField';
import { NumberInput } from './NumberInput';
import styles from './SpecialTransactionModal.module.css';

interface Props {
  transaction: Transaction;
  cards: Card[];
  onSave: (input: UpdateTransferInput) => Promise<void>;
  onClose: () => void;
}

const EditTransferModal = ({ transaction, cards, onSave, onClose }: Props) => {
  const { t } = useTranslation();
  const [fromCardId, setFromCardId] = useState(transaction.cardId ?? '');
  const [toCardId, setToCardId] = useState(transaction.toCardId ?? '');
  const [amount, setAmount] = useState(String(transaction.amount));
  const [toAmount, setToAmount] = useState(String(transaction.toAmount ?? transaction.amount));
  const [date, setDate] = useState(toDateInput(transaction.date));
  const [comment, setComment] = useState(transaction.comment ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [manualRate, setManualRate] = useState(transaction.fxRateSource === 'manual');
  const lastAutoValue = useRef('');

  const fromCard = useMemo(() => cards.find(card => card.id === fromCardId), [cards, fromCardId]);
  const toCard = useMemo(() => cards.find(card => card.id === toCardId), [cards, toCardId]);
  const differentCurrencies = !!fromCard && !!toCard && fromCard.currency !== toCard.currency;

  useEffect(() => {
    if (!differentCurrencies || !fromCard || !toCard) return;
    const numericAmount = Number.parseFloat(amount);
    if (!(numericAmount > 0) || !date) return;
    let cancelled = false;
    void convert(numericAmount, fromCard.currency, toCard.currency, new Date(date).getTime()).then(value => {
      if (cancelled || value == null || manualRate) return;
      const formatted = value.toFixed(toCard.currency === 'UZS' ? 0 : 2);
      lastAutoValue.current = formatted;
      setToAmount(formatted);
    });
    return () => { cancelled = true; };
  }, [amount, date, differentCurrencies, fromCard, manualRate, toCard]);

  const numericAmount = Number.parseFloat(amount);
  const numericToAmount = differentCurrencies ? Number.parseFloat(toAmount) : numericAmount;
  const canSave = !!fromCard
    && !!toCard
    && fromCard.id !== toCard.id
    && numericAmount > 0
    && numericToAmount > 0
    && !!date;

  const selectFrom = (id: string) => {
    setFromCardId(id);
    if (id === toCardId) setToCardId(fromCardId);
    setManualRate(false);
  };
  const selectTo = (id: string) => {
    setToCardId(id);
    if (id === fromCardId) setFromCardId(toCardId);
    setManualRate(false);
  };

  const handleSave = async () => {
    if (!canSave || !fromCard || !toCard) return;
    setSaving(true);
    setError('');
    try {
      const txDate = new Date(date).getTime();
      const fxRate = fromCard.currency === BASE_CURRENCY
        ? undefined
        : await getRateToBase(fromCard.currency, txDate) ?? undefined;
      await onSave({
        fromCardId: fromCard.id,
        toCardId: toCard.id,
        amount: numericAmount,
        toAmount: numericToAmount,
        baseAmount: fxRate ? Math.round(numericAmount * fxRate) : undefined,
        fxRate,
        fxRateSource: differentCurrencies ? (manualRate ? 'manual' : 'NBU') : undefined,
        date: txDate,
        comment: comment.trim() || undefined,
      });
      onClose();
    } catch (err: unknown) {
      setError((err as { message?: string }).message ?? t('common.error_save'));
    } finally {
      setSaving(false);
    }
  };

  const cardOptions = cards.map(card => ({
    value: card.id,
    label: `${card.name} · ${formatAmount(card.balance, card.currency)}`,
  }));

  return (
    <Modal
      title={t('cards.modal_edit_transfer')}
      onClose={onClose}
      footer={(
        <>
          {error && <p className={styles.error}>{error}</p>}
          <button
            className={`${styles.saveBtn} ${!canSave || saving ? styles.disabled : ''}`}
            disabled={!canSave || saving}
            onClick={handleSave}
          >
            <HiCheck size={18} />
            {saving ? t('common.saving') : t('cards.btn_update_transfer')}
          </button>
        </>
      )}
    >
      <div className={styles.stack}>
        <Select label={t('cards.from')} value={fromCardId} onChange={event => selectFrom(event.target.value)} options={cardOptions} />
        <Select label={t('cards.to')} value={toCardId} onChange={event => selectTo(event.target.value)} options={cardOptions} />
        <div>
          <label className={styles.fieldLabel}>{t('cards.amount_label', { currency: fromCard?.currency ?? '' })}</label>
          <NumberInput className={styles.numInput} value={amount} onChange={setAmount} placeholder="0" autoFocus />
        </div>
        {differentCurrencies && (
          <div>
            <label className={styles.fieldLabel}>{t('cards.received_label', { currency: toCard?.currency ?? '' })}</label>
            <NumberInput
              className={styles.numInput}
              value={toAmount}
              onChange={value => {
                setToAmount(value);
                setManualRate(value !== lastAutoValue.current);
              }}
              placeholder="0"
            />
            <p className={styles.hint}>{t(manualRate ? 'cards.fx_edit_manual' : 'cards.fx_edit_auto')}</p>
          </div>
        )}
        <Input label={t('common.date')} type="date" value={date} onChange={event => setDate(event.target.value)} />
        <Input label={t('common.comment')} value={comment} onChange={event => setComment(event.target.value)} maxLength={500} />
      </div>
    </Modal>
  );
};

export default EditTransferModal;
