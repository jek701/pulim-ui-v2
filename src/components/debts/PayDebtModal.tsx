import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Card, Debt } from '../../types';
import { formatAmount } from '../../utils/format';
import { debtRemaining } from '../../utils/debtMath';
import Modal from '../Modal';
import { Select } from '../FormField';
import { NumberInput } from '../NumberInput';
import formStyles from '../plastic/forms.module.css';

interface Props {
  debt: Debt;
  cards: Card[];
  /** Prefill (the full remainder for "pay all"). */
  initialAmount?: number;
  onPay: (amount: number, cardId?: string) => Promise<void>;
  onClose: () => void;
}

/** Partial or full repayment; auto-completes the debt server-side when fully paid. */
const PayDebtModal = ({ debt, cards, initialAmount, onPay, onClose }: Props) => {
  const { t } = useTranslation();
  const [amount, setAmount] = useState(initialAmount ? String(initialAmount) : '');
  const [cardId, setCardId] = useState(cards[0]?.id ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const remaining = debtRemaining(debt);
  const value = parseFloat(amount) || 0;
  const canSave = value > 0 && !!cardId && !saving;

  const handlePay = async () => {
    if (!canSave) return;
    setSaving(true);
    setError('');
    try {
      await onPay(value, cardId || undefined);
      onClose();
    } catch (err: unknown) {
      setError((err as { message?: string }).message ?? t('common.error_save'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={t('debts.modal_pay')}
      onClose={onClose}
      footer={
        <>
          {error && <p className={formStyles.errorMsg}>{error}</p>}
          <button
            className={`${formStyles.saveBtn} ${!canSave ? formStyles.disabled : ''}`}
            onClick={handlePay}
            disabled={!canSave}
          >
            {saving ? t('common.saving') : t('debts.btn_confirm_payment')}
          </button>
        </>
      }
    >
      <div className={formStyles.refillSummary}>
        <div>
          <p className={formStyles.summaryLabel}>{debt.person}</p>
          <p className={formStyles.summaryValue}>{t('debts.label_remaining')}</p>
        </div>
        <div>
          <p className={formStyles.summaryLabel}>&nbsp;</p>
          <p className={debt.direction === 'i_owe' ? formStyles.refillDebt : formStyles.refillLeft}>
            {formatAmount(Math.round(remaining * 100) / 100, debt.currency)}
          </p>
        </div>
      </div>
      <div>
        <label className={formStyles.fieldLabel}>{t('debts.payment_amount_label', { currency: debt.currency })}</label>
        <NumberInput className={formStyles.numInput} placeholder="0" value={amount} onChange={setAmount} autoFocus />
        {remaining > 0 && (
          <div className={formStyles.amountChips}>
            <button
              type="button"
              className={`${formStyles.chip} ${value === remaining ? formStyles.chipActive : ''}`}
              onClick={() => setAmount(String(Math.round(remaining * 100) / 100))}
            >
              {t('debts.action_pay_all')}
            </button>
          </div>
        )}
      </div>
      {cards.length > 0 && (
        <Select
          label={t(debt.direction === 'owe_me' ? 'debts.deposit_to_card' : 'debts.pay_from_card')}
          value={cardId}
          onChange={e => setCardId(e.target.value)}
          options={cards.map(c => ({ value: c.id, label: `${c.name} (${formatAmount(c.balance, c.currency)})` }))}
        />
      )}
    </Modal>
  );
};

export default PayDebtModal;
