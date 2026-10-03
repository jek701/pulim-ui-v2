import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Currency, SavingsGoal } from '../../types';
import type { NewSavingsGoal, SavingsGoalPatch } from '../../hooks/useSavingsGoals';
import { CURRENCIES } from '../../utils/currencies';
import { toDateInput } from '../../utils/format';
import { autoColorKeyByText } from '../../utils/accountColors';
import Modal from '../Modal';
import EmojiInput from '../EmojiInput';
import { Input, Select } from '../FormField';
import { NumberInput } from '../NumberInput';
import ColorSwatches from '../plastic/ColorSwatches';
import formStyles from '../plastic/forms.module.css';

const SUGGESTED_ICONS = ['🎯', '🏠', '🚗', '✈️', '💻', '📱', '👗', '🎓', '💍', '🏖️', '🛋️', '🎮', '⌚', '📷', '🏋️', '🐕'];

type Props = { onClose: () => void } & (
  | { goal?: undefined; onAdd: (data: NewSavingsGoal) => Promise<void> }
  | { goal: SavingsGoal; onUpdate: (id: string, patch: SavingsGoalPatch) => Promise<void> }
);

/** Create a goal, or edit everything but the saved amount and currency. */
const GoalFormModal = (props: Props) => {
  const { t } = useTranslation();
  const editing = props.goal;
  const [name, setName] = useState(editing?.name ?? '');
  const [icon, setIcon] = useState(editing?.icon ?? '🎯');
  const [targetStr, setTargetStr] = useState(editing ? String(editing.targetAmount) : '');
  const [currency, setCurrency] = useState<Currency>(editing?.currency ?? 'UZS');
  const [deadline, setDeadline] = useState(editing ? toDateInput(editing.deadline) : '');
  const [color, setColor] = useState<string | undefined>(editing?.color);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const target = parseFloat(targetStr) || 0;
  const selectedColor = color ?? autoColorKeyByText(name);
  const canSave = name.trim() !== '' && target > 0 && deadline !== '' && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError('');
    try {
      const base = {
        name: name.trim(),
        icon,
        targetAmount: target,
        deadline: new Date(deadline).getTime(),
      };
      if (props.goal) {
        await props.onUpdate(props.goal.id, color ? { ...base, color } : base);
      } else {
        await props.onAdd({ ...base, currency, color: selectedColor });
      }
      props.onClose();
    } catch (err: unknown) {
      setError((err as { message?: string }).message ?? t('common.error_save'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={editing ? t('savings.modal_edit') : t('savings.modal_new')}
      onClose={props.onClose}
      footer={
        <>
          {error && <p className={formStyles.errorMsg}>{error}</p>}
          <button
            className={`${formStyles.saveBtn} ${!canSave ? formStyles.disabled : ''}`}
            onClick={handleSave}
            disabled={!canSave}
          >
            {saving ? t('common.saving') : editing ? t('common.save') : t('savings.btn_create')}
          </button>
        </>
      }
    >
      <EmojiInput label={t('savings.icon_label')} value={icon} onChange={setIcon} suggestions={SUGGESTED_ICONS} />

      <Input
        label={t('savings.goal_name_label')}
        placeholder={t('savings.goal_name_placeholder')}
        value={name}
        onChange={e => setName(e.target.value)}
      />

      <div className={editing ? undefined : formStyles.row2}>
        <div>
          <label className={formStyles.fieldLabel}>
            {editing ? `${t('savings.target_label')} (${editing.currency})` : t('savings.target_label')}
          </label>
          <NumberInput className={formStyles.numInput} placeholder="0" value={targetStr} onChange={setTargetStr} />
        </div>
        {!editing && (
          <Select
            label={t('common.currency')}
            value={currency}
            onChange={e => setCurrency(e.target.value as Currency)}
            options={CURRENCIES.map(c => ({ value: c.code, label: c.code }))}
          />
        )}
      </div>

      <Input label={t('savings.deadline_label')} type="date" value={deadline} onChange={e => setDeadline(e.target.value)} />

      <div>
        <label className={formStyles.fieldLabel}>{t('accounts.color_label')}</label>
        <ColorSwatches value={selectedColor} onChange={setColor} label={t('accounts.color_label')} />
      </div>
    </Modal>
  );
};

export default GoalFormModal;
