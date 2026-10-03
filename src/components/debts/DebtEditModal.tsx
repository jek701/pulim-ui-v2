import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Debt } from '../../types';
import type { DebtPatch } from '../../hooks/useDebts';
import { toDateInput } from '../../utils/format';
import Modal from '../Modal';
import { Input, Textarea } from '../FormField';
import formStyles from '../plastic/forms.module.css';

interface Props {
  debt: Debt;
  onUpdate: (id: string, patch: DebtPatch) => Promise<void>;
  onClose: () => void;
}

/** Person, due date and comment. Amounts change only through payments. */
const DebtEditModal = ({ debt, onUpdate, onClose }: Props) => {
  const { t } = useTranslation();
  const [person, setPerson] = useState(debt.person);
  const [dueDate, setDueDate] = useState(debt.dueDate ? toDateInput(debt.dueDate) : '');
  const [comment, setComment] = useState(debt.comment ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canSave = person.trim() !== '' && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError('');
    try {
      await onUpdate(debt.id, {
        person: person.trim(),
        comment: comment.trim(),
        dueDate: dueDate ? new Date(dueDate).getTime() : null,
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
      title={t('debts.modal_edit')}
      onClose={onClose}
      footer={
        <>
          {error && <p className={formStyles.errorMsg}>{error}</p>}
          <button
            className={`${formStyles.saveBtn} ${!canSave ? formStyles.disabled : ''}`}
            onClick={handleSave}
            disabled={!canSave}
          >
            {saving ? t('common.saving') : t('common.save')}
          </button>
        </>
      }
    >
      <Input
        label={t(debt.direction === 'i_owe' ? 'debts.creditor_label' : 'debts.debtor_label')}
        value={person}
        onChange={e => setPerson(e.target.value)}
      />
      <Input label={t('debts.due_date_label')} type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
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

export default DebtEditModal;
