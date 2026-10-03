import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Card, SavingsGoal } from '../../types';
import { formatAmount } from '../../utils/format';
import Modal from '../Modal';
import { Select } from '../FormField';
import { NumberInput } from '../NumberInput';
import formStyles from '../plastic/forms.module.css';

const QUICK = [100_000, 500_000, 1_000_000];

interface Props {
  goal: SavingsGoal;
  cards: Card[];
  onContribute: (amount: number, cardId: string) => Promise<void>;
  onClose: () => void;
}

/** Top up a goal from an account (atomic server-side: goal + balance + transaction). */
const ContributeModal = ({ goal, cards, onContribute, onClose }: Props) => {
  const { t } = useTranslation();
  const [amount, setAmount] = useState('');
  const [cardId, setCardId] = useState(cards[0]?.id ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const remaining = Math.max(0, goal.targetAmount - goal.savedAmount);
  const value = parseFloat(amount) || 0;
  const canSave = value > 0 && !!cardId && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError('');
    try {
      await onContribute(value, cardId);
      onClose();
    } catch (err: unknown) {
      setError((err as { message?: string }).message ?? t('common.error_save'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={t('savings.modal_contribute', { name: goal.name })}
      onClose={onClose}
      footer={
        <>
          {error && <p className={formStyles.errorMsg}>{error}</p>}
          <button
            className={`${formStyles.saveBtn} ${!canSave ? formStyles.disabled : ''}`}
            onClick={handleSave}
            disabled={!canSave}
          >
            {saving ? t('common.saving') : t('savings.btn_add_funds')}
          </button>
        </>
      }
    >
      <div className={formStyles.refillSummary}>
        <div>
          <p className={formStyles.summaryLabel}>{t('savings.saved_label')}</p>
          <p className={formStyles.refillLeft}>{formatAmount(goal.savedAmount, goal.currency)}</p>
        </div>
        <div>
          <p className={formStyles.summaryLabel}>{t('savings.needed_label')}</p>
          <p className={formStyles.summaryValue}>{formatAmount(Math.ceil(remaining), goal.currency)}</p>
        </div>
      </div>

      <div>
        <label className={formStyles.fieldLabel}>{t('savings.amount_label', { currency: goal.currency })}</label>
        <NumberInput className={formStyles.numInput} placeholder="0" value={amount} onChange={setAmount} autoFocus />
        <div className={formStyles.amountChips}>
          {QUICK.filter(v => v <= remaining * 2).map(v => (
            <button
              key={v}
              type="button"
              className={`${formStyles.chip} ${value === v ? formStyles.chipActive : ''}`}
              onClick={() => setAmount(String(v))}
            >
              +{v >= 1_000_000 ? `${v / 1_000_000}M` : `${v / 1000}K`}
            </button>
          ))}
          {remaining > 0 && (
            <button
              type="button"
              className={`${formStyles.chip} ${value === Math.ceil(remaining) ? formStyles.chipActive : ''}`}
              onClick={() => setAmount(String(Math.ceil(remaining)))}
            >
              {t('savings.full_amount')}
            </button>
          )}
        </div>
      </div>

      {cards.length > 0 && (
        <Select
          label={t('savings.from_card')}
          value={cardId}
          onChange={e => setCardId(e.target.value)}
          options={cards.map(c => ({ value: c.id, label: `${c.name} (${formatAmount(c.balance, c.currency)})` }))}
        />
      )}
    </Modal>
  );
};

export default ContributeModal;
