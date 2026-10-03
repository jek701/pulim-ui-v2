import { useTranslation } from 'react-i18next';
import { HiPlus, HiPencil, HiTrash } from 'react-icons/hi2';
import type { SavingsGoal } from '../../types';
import { formatAmount, formatFullDate } from '../../utils/format';
import { goalProgress } from '../../utils/goalMath';
import Modal from '../Modal';
import { SheetActions, SheetStats, type SheetAction } from '../plastic/SheetParts';
import GoalPlastic from './GoalPlastic';

interface Props {
  goal: SavingsGoal;
  onContribute: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}

const GoalSheet = ({ goal, onContribute, onEdit, onDelete, onClose }: Props) => {
  const { t, i18n } = useTranslation();
  const { done, remaining } = goalProgress(goal);

  const actions = [
    !done && { key: 'contribute', icon: <HiPlus size={20} />, label: t('savings.btn_contribute'), onClick: onContribute, accent: true },
    { key: 'edit', icon: <HiPencil size={20} />, label: t('common.edit'), onClick: onEdit },
    { key: 'delete', icon: <HiTrash size={20} />, label: t('common.delete'), onClick: onDelete, danger: true },
  ].filter(Boolean) as SheetAction[];

  return (
    <Modal title={goal.name} onClose={onClose}>
      <GoalPlastic goal={goal} size="lg" />
      <SheetStats
        items={[
          { label: t('savings.label_deadline'), value: formatFullDate(goal.deadline, i18n.language) },
          done
            ? { label: t('savings.label_saved'), value: formatAmount(goal.savedAmount, goal.currency), tone: 'positive' }
            : { label: t('savings.needed_label'), value: formatAmount(Math.ceil(remaining), goal.currency) },
        ]}
      />
      <SheetActions actions={actions} />
    </Modal>
  );
};

export default GoalSheet;
