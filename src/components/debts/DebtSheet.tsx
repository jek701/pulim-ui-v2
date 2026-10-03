import { useTranslation } from 'react-i18next';
import { HiMinus, HiCheck, HiArrowPath, HiPencil, HiTrash } from 'react-icons/hi2';
import type { Debt } from '../../types';
import { formatAmount, formatFullDate } from '../../utils/format';
import { debtTotal } from '../../utils/debtMath';
import Modal from '../Modal';
import { SheetActions, SheetNote, SheetStats, type SheetAction, type SheetStat } from '../plastic/SheetParts';
import DebtPlastic from './DebtPlastic';

interface Props {
  debt: Debt;
  onPayPart: () => void;
  onPayAll: () => void;
  onReopen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}

const DebtSheet = ({ debt, onPayPart, onPayAll, onReopen, onEdit, onDelete, onClose }: Props) => {
  const { t, i18n } = useTranslation();
  const money = (n: number) => formatAmount(Math.round(n * 100) / 100, debt.currency);
  const comm = debt.commission;

  const stats: SheetStat[] = [
    { label: t('debts.label_total'), value: money(debtTotal(debt)) },
    { label: t('debts.label_paid'), value: money(debt.paidAmount || 0), tone: debt.paidAmount ? 'positive' : undefined },
  ];
  if (comm) {
    stats.push({
      label: t('debts.label_commission'),
      value: comm.type === 'percent' ? `+${comm.value}%` : `+${money(comm.value)}`,
    });
  }
  if (debt.dueDate) stats.push({ label: t('debts.due_label'), value: formatFullDate(debt.dueDate, i18n.language) });

  const actions: SheetAction[] = debt.isPaid
    ? [
        { key: 'reopen', icon: <HiArrowPath size={20} />, label: t('debts.action_reopen'), onClick: onReopen },
        { key: 'edit', icon: <HiPencil size={20} />, label: t('common.edit'), onClick: onEdit },
        { key: 'delete', icon: <HiTrash size={20} />, label: t('common.delete'), onClick: onDelete, danger: true },
      ]
    : [
        { key: 'part', icon: <HiMinus size={20} />, label: t('debts.action_pay_part'), onClick: onPayPart, accent: true },
        { key: 'all', icon: <HiCheck size={20} />, label: t('debts.action_pay_all'), onClick: onPayAll },
        { key: 'edit', icon: <HiPencil size={20} />, label: t('common.edit'), onClick: onEdit },
        { key: 'delete', icon: <HiTrash size={20} />, label: t('common.delete'), onClick: onDelete, danger: true },
      ];

  return (
    <Modal title={debt.person} onClose={onClose}>
      <DebtPlastic debt={debt} size="lg" />
      <SheetStats items={stats} />
      {debt.comment && <SheetNote>{debt.comment}</SheetNote>}
      <SheetActions actions={actions} />
    </Modal>
  );
};

export default DebtSheet;
