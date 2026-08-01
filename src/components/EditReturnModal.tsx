import { useMemo, useState } from 'react';
import { HiCheck } from 'react-icons/hi2';
import { useTranslation } from 'react-i18next';
import type { Card, Category, Transaction } from '../types';
import type { UpdateReturnInput } from '../hooks/useTransactions';
import { formatAmount, toDateInput } from '../utils/format';
import { useCategoryName } from '../utils/categoryName';
import Modal from './Modal';
import { Input, Select } from './FormField';
import { NumberInput } from './NumberInput';
import styles from './SpecialTransactionModal.module.css';

interface Props {
  transaction: Transaction;
  original?: Transaction;
  categories: Category[];
  cards: Card[];
  onSave: (input: UpdateReturnInput) => Promise<void>;
  onClose: () => void;
}

const EditReturnModal = ({ transaction, original, categories, cards, onSave, onClose }: Props) => {
  const { t } = useTranslation();
  const categoryName = useCategoryName();
  const compatibleCards = useMemo(
    () => cards.filter(card => card.currency === transaction.currency),
    [cards, transaction.currency],
  );
  const initialAccountId = compatibleCards.some(card => card.id === transaction.cardId)
    ? transaction.cardId!
    : compatibleCards[0]?.id ?? '';
  const [amount, setAmount] = useState(String(transaction.amount));
  const [accountId, setAccountId] = useState(initialAccountId);
  const [date, setDate] = useState(toDateInput(transaction.date));
  const [comment, setComment] = useState(transaction.comment ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const otherReturned = original
    ? Math.max(0, (original.returnedAmount ?? 0) - transaction.amount)
    : 0;
  const maxReturn = original ? original.amount - otherReturned : 0;
  const numericAmount = Number.parseFloat(amount);
  const canSave = !!original
    && Number.isFinite(numericAmount)
    && numericAmount > 0
    && numericAmount <= maxReturn
    && !!accountId
    && !!date;
  const originalCategory = original
    ? categories.find(category => category.id === original.categoryId)
    : undefined;
  const originalLabel = original?.sourceLabel
    || categoryName(originalCategory)
    || t('common.transaction');

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError('');
    try {
      await onSave({
        returnAmount: numericAmount,
        accountId,
        date: new Date(date).getTime(),
        comment: comment.trim() || undefined,
      });
      onClose();
    } catch (err: unknown) {
      setError((err as { message?: string }).message ?? t('common.error_save'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={t('return.edit_title')}
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
            {saving ? t('common.saving') : t('return.btn_update')}
          </button>
        </>
      )}
    >
      <div className={styles.stack}>
        <div className={styles.summary}>
          <span>{t('return.label_original')}</span>
          <strong>{original ? `${originalLabel} · ${formatAmount(original.amount, original.currency)}` : '—'}</strong>
        </div>

        <div>
          <label className={styles.fieldLabel}>{t('return.amount_label', { currency: transaction.currency })}</label>
          <NumberInput className={styles.numInput} value={amount} onChange={setAmount} placeholder="0" autoFocus />
          <p className={styles.hint}>{t('return.edit_max', { amount: formatAmount(maxReturn, transaction.currency) })}</p>
        </div>

        <Select
          label={t('return.pick_account')}
          value={accountId}
          onChange={event => setAccountId(event.target.value)}
          options={compatibleCards.map(card => ({
            value: card.id,
            label: `${card.name} · ${formatAmount(card.balance, card.currency)}`,
          }))}
        />
        <Input label={t('return.date_label')} type="date" value={date} onChange={event => setDate(event.target.value)} />
        <Input
          label={t('return.comment_label')}
          value={comment}
          onChange={event => setComment(event.target.value)}
          placeholder={t('return.comment_placeholder')}
          maxLength={500}
        />
      </div>
    </Modal>
  );
};

export default EditReturnModal;
