import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { Card } from '../../types';
import { formatAmount } from '../../utils/format';
import { convert, getRateToBase, BASE_CURRENCY } from '../../utils/nbuRates';
import { NumberInput } from '../NumberInput';
import { Select } from '../FormField';
import Modal from '../Modal';
import styles from '../plastic/forms.module.css';

interface Props {
  cards: Card[];
  /** Preselected source account (e.g. when opened from an account's sheet). */
  fromId?: string;
  onTransfer: (data: {
    fromCardId: string;
    toCardId: string;
    amount: number;
    toAmount: number;
    baseAmount?: number;
    fxRate?: number;
    fxRateSource?: 'NBU' | 'manual';
  }) => Promise<unknown>;
  onClose: () => void;
}

const TransferModal = ({ cards, fromId, onTransfer, onClose }: Props) => {
  const { t } = useTranslation();
  const initialFrom = fromId ?? cards[0]?.id ?? '';
  const [transferFromId, setTransferFromId] = useState(initialFrom);
  const [transferToId, setTransferToId] = useState(() => cards.find(c => c.id !== initialFrom)?.id ?? '');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferToAmount, setTransferToAmount] = useState('');
  const [transferSaving, setTransferSaving] = useState(false);
  const [transferError, setTransferError] = useState('');
  const [transferAutoFilled, setTransferAutoFilled] = useState(false);
  const [transferRateInfo, setTransferRateInfo] = useState<string>('');
  const lastAutoValueRef = useRef<string>('');

  const transferFrom = cards.find(c => c.id === transferFromId);
  const transferTo   = cards.find(c => c.id === transferToId);
  const differentCurrencies = transferFrom && transferTo && transferFrom.currency !== transferTo.currency;
  const canTransfer = transferFromId && transferToId && transferFromId !== transferToId &&
    parseFloat(transferAmount) > 0 &&
    (!differentCurrencies || parseFloat(transferToAmount) > 0);

  // Auto-prefill received amount from NBU rate when currencies differ.
  useEffect(() => {
    if (!differentCurrencies || !transferFrom || !transferTo) {
      setTransferRateInfo('');
      return;
    }
    const amt = parseFloat(transferAmount);
    if (!isFinite(amt) || amt <= 0) {
      setTransferRateInfo('');
      return;
    }
    let cancelled = false;
    (async () => {
      const converted = await convert(amt, transferFrom.currency, transferTo.currency);
      if (cancelled || converted == null) return;
      const formatted = converted.toFixed(transferTo.currency === 'UZS' ? 0 : 2);
      // Only overwrite if the user hasn't manually edited away from our last auto-value.
      const userEdited = transferToAmount !== '' && transferToAmount !== lastAutoValueRef.current;
      if (!userEdited) {
        lastAutoValueRef.current = formatted;
        setTransferToAmount(formatted);
        setTransferAutoFilled(true);
      }
      const oneUnit = await convert(1, transferFrom.currency, transferTo.currency);
      if (oneUnit != null) {
        setTransferRateInfo(`1 ${transferFrom.currency} ≈ ${oneUnit.toFixed(transferTo.currency === 'UZS' ? 2 : 4)} ${transferTo.currency}`);
      }
    })();
    return () => { cancelled = true; };
  }, [differentCurrencies, transferFrom, transferTo, transferAmount]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTransfer = async () => {
    if (!canTransfer || !transferFrom || !transferTo) return;
    const amt   = parseFloat(transferAmount);
    const toAmt = differentCurrencies ? parseFloat(transferToAmount) : amt;
    setTransferSaving(true);
    setTransferError('');
    try {
      const txDate = Date.now();
      const userEdited = differentCurrencies && transferToAmount !== lastAutoValueRef.current;
      const fxRateSource: 'NBU' | 'manual' | undefined = differentCurrencies
        ? (userEdited ? 'manual' : 'NBU')
        : undefined;
      // Snapshot fxRate of the FROM currency to UZS for the summary calculation.
      let baseAmount: number | undefined;
      let fxRate: number | undefined;
      if (transferFrom.currency !== BASE_CURRENCY) {
        const r = await getRateToBase(transferFrom.currency, txDate);
        if (r && r > 0) {
          fxRate = r;
          baseAmount = Math.round(amt * r);
        }
      }
      // Balance changes happen atomically server-side; FX snapshot stays client-computed.
      await onTransfer({
        fromCardId: transferFrom.id,
        toCardId: transferTo.id,
        amount: amt,
        toAmount: toAmt,
        baseAmount,
        fxRate,
        fxRateSource,
      });
      onClose();
    } catch (err: unknown) {
      setTransferError((err as { message?: string }).message ?? t('common.error_generic'));
    } finally {
      setTransferSaving(false);
    }
  };

  const options = cards.map(c => ({ value: c.id, label: `${c.name} (${formatAmount(c.balance, c.currency)})` }));

  return (
    <Modal
      title={t('cards.modal_transfer')}
      onClose={onClose}
      footer={
        <>
          {transferError && <p className={styles.errorMsg}>{transferError}</p>}
          <button
            className={`${styles.saveBtn} ${!canTransfer || transferSaving ? styles.disabled : ''}`}
            onClick={handleTransfer}
            disabled={!canTransfer || transferSaving}
          >
            {transferSaving ? t('common.transferring') : t('cards.btn_transfer')}
          </button>
        </>
      }
    >
      <Select
        label={t('cards.from')}
        value={transferFromId}
        onChange={e => {
          const id = e.target.value;
          setTransferFromId(id);
          if (id === transferToId) setTransferToId(transferFromId);
        }}
        options={options}
      />
      <Select
        label={t('cards.to')}
        value={transferToId}
        onChange={e => {
          const id = e.target.value;
          setTransferToId(id);
          if (id === transferFromId) setTransferFromId(transferToId);
        }}
        options={options}
      />
      <div>
        <label className={styles.fieldLabel}>
          {t('cards.amount_label', { currency: transferFrom?.currency ?? '' })}
        </label>
        <NumberInput
          className={styles.numInput}
          placeholder="0"
          value={transferAmount}
          onChange={setTransferAmount}
          autoFocus
        />
      </div>
      {differentCurrencies && (
        <div>
          <label className={styles.fieldLabel}>
            {t('cards.received_label', { currency: transferTo?.currency ?? '' })}
          </label>
          <NumberInput
            className={styles.numInput}
            placeholder="0"
            value={transferToAmount}
            onChange={(v) => {
              setTransferToAmount(v);
              if (v !== lastAutoValueRef.current) setTransferAutoFilled(false);
            }}
          />
          {transferRateInfo && (
            <p className={styles.fieldHint}>
              {transferAutoFilled
                ? t('cards.fx_auto_hint', { rate: transferRateInfo })
                : t('cards.fx_manual_hint', { rate: transferRateInfo })}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
};

export default TransferModal;
