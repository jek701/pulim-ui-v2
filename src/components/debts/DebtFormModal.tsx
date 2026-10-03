import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Card, CommissionType, Currency, Debt, DebtDirection } from '../../types';
import type { NewDebt } from '../../hooks/useDebts';
import { CURRENCIES } from '../../utils/currencies';
import { formatAmount, toDateInput } from '../../utils/format';
import Modal from '../Modal';
import { Input, Select, Textarea } from '../FormField';
import { NumberInput } from '../NumberInput';
import formStyles from '../plastic/forms.module.css';
import styles from './DebtFormModal.module.css';

interface Props {
  debts: Debt[];
  cards: Card[];
  initialDirection?: DebtDirection;
  onAdd: (data: NewDebt, accountId?: string) => Promise<void>;
  onClose: () => void;
}

/** New debt; the server records it and the initial cash movement atomically. */
const DebtFormModal = ({ debts, cards, initialDirection = 'i_owe', onAdd, onClose }: Props) => {
  const { t, i18n } = useTranslation();
  const [direction, setDirection] = useState<DebtDirection>(initialDirection);
  const [person, setPerson] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [currency, setCurrency] = useState<Currency>('UZS');
  const [hasCommission, setHasCommission] = useState(false);
  const [commType, setCommType] = useState<CommissionType>('percent');
  const [commValue, setCommValue] = useState('');
  const [accountId, setAccountId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const amount = parseFloat(amountStr) || 0;
  const canSave = person.trim() !== '' && amount > 0 && !!accountId && !saving;

  const savedPeople = Array.from(
    debts
      .filter(debt => debt.direction === direction)
      .reduce((people, debt) => {
        const name = debt.person.trim();
        const key = name.toLocaleLowerCase(i18n.language);
        if (name && !people.has(key)) people.set(key, name);
        return people;
      }, new Map<string, string>())
      .values(),
  ).sort((a, b) => a.localeCompare(b, i18n.language));

  const handleAdd = async () => {
    if (!canSave) return;
    setSaving(true);
    setError('');
    try {
      await onAdd({
        direction,
        person: person.trim(),
        amount,
        currency,
        isPaid: false,
        commission: hasCommission && commValue ? { type: commType, value: parseFloat(commValue) } : undefined,
        dueDate: dueDate ? new Date(dueDate).getTime() : undefined,
        comment: comment.trim() || undefined,
      }, accountId || undefined);
      onClose();
    } catch (err: unknown) {
      setError((err as { message?: string }).message ?? t('common.error_save'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={t('debts.modal_add')}
      onClose={onClose}
      footer={
        <>
          {error && <p className={formStyles.errorMsg}>{error}</p>}
          <button
            className={`${formStyles.saveBtn} ${!canSave ? formStyles.disabled : ''}`}
            onClick={handleAdd}
            disabled={!canSave}
          >
            {saving ? t('common.saving') : t('debts.btn_add')}
          </button>
        </>
      }
    >
      <div className={formStyles.segment} role="tablist">
        {(['i_owe', 'owe_me'] as DebtDirection[]).map(d => (
          <button
            key={d}
            type="button"
            role="tab"
            aria-selected={direction === d}
            className={`${formStyles.segmentBtn} ${direction === d ? formStyles.segmentActive : ''}`}
            onClick={() => setDirection(d)}
          >
            {d === 'i_owe' ? t('debts.tab_i_owe') : t('debts.tab_owe_me')}
          </button>
        ))}
      </div>

      <div className={styles.personField}>
        <Input
          label={t(direction === 'i_owe' ? 'debts.creditor_label' : 'debts.debtor_label')}
          placeholder={t('debts.person_placeholder')}
          value={person}
          onChange={e => setPerson(e.target.value)}
          list="saved-debt-people"
          autoComplete="off"
        />
        <datalist id="saved-debt-people">
          {savedPeople.map(p => <option key={p} value={p} />)}
        </datalist>
        {savedPeople.length > 0 && (
          <div className={styles.savedPeopleList} aria-label={t('debts.saved_people_hint')}>
            {savedPeople.map(p => (
              <button
                key={p}
                type="button"
                className={`${styles.savedPersonBtn} ${person === p ? styles.savedPersonActive : ''}`}
                onClick={() => setPerson(p)}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className={formStyles.row2}>
        <div>
          <label className={formStyles.fieldLabel}>{t('common.amount')}</label>
          <NumberInput className={formStyles.numInput} placeholder="0" value={amountStr} onChange={setAmountStr} />
        </div>
        <Select
          label={t('common.currency')}
          value={currency}
          onChange={e => setCurrency(e.target.value as Currency)}
          options={CURRENCIES.map(c => ({ value: c.code, label: c.code }))}
        />
      </div>

      <Select
        label={t(direction === 'i_owe' ? 'debts.deposit_to_card' : 'debts.withdraw_from_card')}
        value={accountId}
        onChange={e => setAccountId(e.target.value)}
        options={[
          { value: '', label: '—' },
          ...cards.map(c => ({ value: c.id, label: `${c.name} (${formatAmount(c.balance, c.currency)})` })),
        ]}
      />

      <label className={formStyles.switchRow}>
        <span>{t('debts.commission_label')}</span>
        <span className={formStyles.switch}>
          <input type="checkbox" checked={hasCommission} onChange={e => setHasCommission(e.target.checked)} />
          <span />
        </span>
      </label>
      {hasCommission && (
        <div className={formStyles.row2}>
          <Select
            value={commType}
            onChange={e => setCommType(e.target.value as CommissionType)}
            options={[
              { value: 'percent', label: t('debts.commission_percent') },
              { value: 'fixed', label: t('debts.commission_fixed') },
            ]}
          />
          <NumberInput
            className={formStyles.numInput}
            placeholder={commType === 'percent' ? '5' : t('common.amount')}
            value={commValue}
            onChange={setCommValue}
          />
        </div>
      )}

      <Input
        label={t('debts.due_date_label')}
        type="date"
        value={dueDate}
        min={toDateInput(Date.now())}
        onChange={e => setDueDate(e.target.value)}
      />
      <Textarea
        label={t('debts.comment_label')}
        placeholder={t('debts.comment_placeholder')}
        value={comment}
        onChange={e => setComment(e.target.value)}
        rows={2}
      />
    </Modal>
  );
};

export default DebtFormModal;
