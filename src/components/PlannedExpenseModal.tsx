import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from './Modal';
import EmojiInput from './EmojiInput';
import { Input, Select } from './FormField';
import { NumberInput } from './NumberInput';
import type { PlannedExpense, RecurrenceType, CustomUnit, Currency } from '../types';
import type { NewPlannedExpense } from '../hooks/usePlannedExpenses';
import styles from './PlannedExpenseModal.module.css';

const CURRENCIES: Currency[] = ['UZS', 'USD', 'EUR', 'RUB', 'GBP'];
const DOW_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const ICON_SUGGESTIONS = ['💳', '🏠', '⚡', '💊', '🚗', '🛒', '📱', '🎓', '🍔', '✈️', '💼', '🏋️'];

interface Props {
  initial?: PlannedExpense;
  onSave: (data: NewPlannedExpense) => Promise<void>;
  onClose: () => void;
}

const tsToDateInput = (ts: number) => new Date(ts).toISOString().split('T')[0];
const dateInputToTs = (s: string) => new Date(s).getTime();

const PlannedExpenseModal: React.FC<Props> = ({ initial, onSave, onClose }) => {
  const { t } = useTranslation();
  const [kind, setKind] = useState<'income' | 'expense'>(initial?.kind ?? 'expense');
  const [icon, setIcon] = useState(initial?.icon ?? '💳');
  const [name, setName] = useState(initial?.name ?? '');
  const [amountStr, setAmountStr] = useState(initial ? String(initial.amount) : '');
  const [currency, setCurrency] = useState<Currency>(initial?.currency ?? 'UZS');
  const [recurrence, setRecurrence] = useState<RecurrenceType>(initial?.recurrence ?? 'monthly');
  const [dayOfMonth, setDayOfMonth] = useState(initial?.dayOfMonth ?? 1);
  const [dayOfWeek, setDayOfWeek] = useState<number[]>(initial?.dayOfWeek ?? [1]);
  const [date, setDate] = useState(initial?.date ? tsToDateInput(initial.date) : tsToDateInput(Date.now()));
  const [customInterval, setCustomInterval] = useState(initial?.customInterval ?? 1);
  const [customUnit, setCustomUnit] = useState<CustomUnit>(initial?.customUnit ?? 'week');
  const [hasEndDate, setHasEndDate] = useState(initial?.endDate != null);
  const [endDate, setEndDate] = useState(initial?.endDate ? tsToDateInput(initial.endDate) : tsToDateInput(Date.now()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggleDow = (d: number) => {
    setDayOfWeek(prev =>
      prev.includes(d) ? (prev.length > 1 ? prev.filter(x => x !== d) : prev) : [...prev, d]
    );
  };

  const handleSave = async () => {
    const amount = parseFloat(amountStr);
    if (!name.trim()) { setError('Name is required'); return; }
    if (!amount || amount <= 0) { setError('Amount must be positive'); return; }
    setSaving(true);
    try {
      const needsAnchor = recurrence === 'once' || recurrence === 'yearly' || recurrence === 'custom';
      const data: NewPlannedExpense = {
        kind, icon, name: name.trim(), amount, currency, recurrence,
        ...(recurrence === 'monthly' && { dayOfMonth }),
        ...(recurrence === 'weekly' && { dayOfWeek }),
        ...(recurrence === 'custom' && customUnit === 'week' && { dayOfWeek }),
        ...(recurrence === 'custom' && customUnit === 'month' && { dayOfMonth }),
        ...(recurrence === 'custom' && { customInterval: Math.max(1, customInterval), customUnit }),
        ...(needsAnchor && { date: dateInputToTs(date) }),
        ...(hasEndDate && recurrence !== 'once' && { endDate: dateInputToTs(endDate) }),
      };
      await onSave(data);
      onClose();
    } catch {
      setError('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const recurrenceOptions: { value: RecurrenceType; label: string }[] = [
    { value: 'once',     label: t('calendar.once') },
    { value: 'daily',    label: t('calendar.daily') },
    { value: 'weekly',   label: t('calendar.weekly') },
    { value: 'monthly',  label: t('calendar.monthly') },
    { value: 'yearly',   label: t('calendar.yearly') },
    { value: 'weekdays', label: t('calendar.weekdays') },
    { value: 'weekends', label: t('calendar.weekends') },
    { value: 'custom',   label: t('calendar.custom') },
  ];

  const unitOptions: { value: CustomUnit; label: string }[] = [
    { value: 'day',   label: t('calendar.custom_unit_day') },
    { value: 'week',  label: t('calendar.custom_unit_week') },
    { value: 'month', label: t('calendar.custom_unit_month') },
    { value: 'year',  label: t('calendar.custom_unit_year') },
  ];

  return (
    <Modal
      title={initial ? t('calendar.edit_planned') : t('calendar.new_planned')}
      onClose={onClose}
      footer={
        <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
          {saving ? t('common.saving') : t('common.save')}
        </button>
      }
    >
      <div className={styles.form}>
        <div className={styles.kindRow}>
          <button
            type="button"
            className={`${styles.kindBtn} ${kind === 'expense' ? styles.kindBtnActive : ''}`}
            onClick={() => setKind('expense')}
          >
            {t('calendar.kind_expense')}
          </button>
          <button
            type="button"
            className={`${styles.kindBtn} ${kind === 'income' ? styles.kindBtnIncomeActive : ''}`}
            onClick={() => setKind('income')}
          >
            {t('calendar.kind_income')}
          </button>
        </div>

        <EmojiInput value={icon} onChange={setIcon} suggestions={ICON_SUGGESTIONS} label="Icon" />

        <Input
          label={t('common.name')}
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={t('calendar.planned_name_placeholder')}
        />

        <div className={styles.amountRow}>
          <div className={styles.amountInput}>
            <label className={styles.fieldLabel}>{t('common.amount')}</label>
            <NumberInput
              className={styles.input}
              value={amountStr}
              onChange={setAmountStr}
              placeholder="0"
            />
          </div>
          <Select
            label={t('common.currency')}
            value={currency}
            onChange={e => setCurrency(e.target.value as Currency)}
            options={CURRENCIES.map(c => ({ value: c, label: c }))}
          />
        </div>

        <Select
          label={t('calendar.recurrence')}
          value={recurrence}
          onChange={e => setRecurrence(e.target.value as RecurrenceType)}
          options={recurrenceOptions}
        />

        {recurrence === 'monthly' && (
          <div className={styles.fieldWrap}>
            <label className={styles.fieldLabel}>{t('calendar.day_of_month')}</label>
            <input
              type="number"
              min={1}
              max={31}
              value={dayOfMonth}
              onChange={e => setDayOfMonth(Math.min(31, Math.max(1, Number(e.target.value))))}
              className={styles.input}
            />
          </div>
        )}

        {recurrence === 'weekly' && (
          <div className={styles.fieldWrap}>
            <label className={styles.fieldLabel}>{t('calendar.days_of_week')}</label>
            <div className={styles.dowRow}>
              {DOW_LABELS.map((label, i) => (
                <button
                  key={i}
                  type="button"
                  className={`${styles.dowBtn} ${dayOfWeek.includes(i) ? styles.dowActive : ''}`}
                  onClick={() => toggleDow(i)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {recurrence === 'custom' && (
          <>
            <div className={styles.fieldWrap}>
              <label className={styles.fieldLabel}>{t('calendar.custom_every')}</label>
              <div className={styles.customRow}>
                <input
                  type="number"
                  min={1}
                  value={customInterval}
                  onChange={e => setCustomInterval(Math.max(1, Number(e.target.value) || 1))}
                  className={styles.input}
                />
                <select
                  value={customUnit}
                  onChange={e => setCustomUnit(e.target.value as CustomUnit)}
                  className={styles.input}
                >
                  {unitOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>

            {customUnit === 'week' && (
              <div className={styles.fieldWrap}>
                <label className={styles.fieldLabel}>{t('calendar.days_of_week')}</label>
                <div className={styles.dowRow}>
                  {DOW_LABELS.map((label, i) => (
                    <button
                      key={i}
                      type="button"
                      className={`${styles.dowBtn} ${dayOfWeek.includes(i) ? styles.dowActive : ''}`}
                      onClick={() => toggleDow(i)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {customUnit === 'month' && (
              <div className={styles.fieldWrap}>
                <label className={styles.fieldLabel}>{t('calendar.day_of_month')}</label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={dayOfMonth}
                  onChange={e => setDayOfMonth(Math.min(31, Math.max(1, Number(e.target.value))))}
                  className={styles.input}
                />
              </div>
            )}
          </>
        )}

        {(recurrence === 'once' || recurrence === 'yearly' || recurrence === 'custom') && (
          <div className={styles.fieldWrap}>
            <label className={styles.fieldLabel}>
              {recurrence === 'once' ? t('calendar.specific_date') : t('calendar.starts_on')}
            </label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className={styles.input}
            />
          </div>
        )}

        {recurrence !== 'once' && (
          <div className={styles.fieldWrap}>
            <label className={styles.fieldLabel}>{t('calendar.ends_label')}</label>
            <div className={styles.endsRow}>
              <button
                type="button"
                className={`${styles.endsBtn} ${!hasEndDate ? styles.endsBtnActive : ''}`}
                onClick={() => setHasEndDate(false)}
              >
                {t('calendar.ends_never')}
              </button>
              <button
                type="button"
                className={`${styles.endsBtn} ${hasEndDate ? styles.endsBtnActive : ''}`}
                onClick={() => setHasEndDate(true)}
              >
                {t('calendar.ends_on_date')}
              </button>
            </div>
            {hasEndDate && (
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className={styles.input}
              />
            )}
          </div>
        )}

        {error && <p className={styles.error}>{error}</p>}
      </div>
    </Modal>
  );
};

export default PlannedExpenseModal;
