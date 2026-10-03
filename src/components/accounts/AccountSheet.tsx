import { useTranslation } from 'react-i18next';
import { HiArrowsRightLeft, HiArrowDownTray, HiPencil, HiTrash } from 'react-icons/hi2';
import type { Card } from '../../types';
import { formatAmount } from '../../utils/format';
import Modal from '../Modal';
import AccountPlastic, { HIDDEN_AMOUNT } from './AccountPlastic';
import formStyles from './forms.module.css';
import styles from './AccountSheet.module.css';

interface Props {
  card: Card;
  hidden: boolean;
  canTransfer: boolean;
  onTransfer: () => void;
  onRefill: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleInclude: (include: boolean) => void;
  onClose: () => void;
}

/** Details + every action for one account; opened by tapping its plastic. */
const AccountSheet = ({
  card, hidden, canTransfer, onTransfer, onRefill, onEdit, onDelete, onToggleInclude, onClose,
}: Props) => {
  const { t } = useTranslation();
  const isCredit = card.cardType === 'credit';
  const money = (n: number) => (hidden ? HIDDEN_AMOUNT : formatAmount(n, card.currency));

  const actions = [
    canTransfer && { key: 'transfer', icon: <HiArrowsRightLeft size={20} />, label: t('accounts.action_transfer'), onClick: onTransfer },
    isCredit && card.balance > 0 && { key: 'refill', icon: <HiArrowDownTray size={20} />, label: t('cards.refill_btn'), onClick: onRefill, accent: true },
    { key: 'edit', icon: <HiPencil size={20} />, label: t('common.edit'), onClick: onEdit },
    { key: 'delete', icon: <HiTrash size={20} />, label: t('common.delete'), onClick: onDelete, danger: true },
  ].filter(Boolean) as { key: string; icon: React.ReactNode; label: string; onClick: () => void; accent?: boolean; danger?: boolean }[];

  return (
    <Modal title={card.name} onClose={onClose}>
      <AccountPlastic card={card} size="lg" hidden={hidden} />

      {isCredit && (
        <div className={styles.stats}>
          <div>
            <span>{t('cards.label_debt')}</span>
            <strong className={card.balance > 0 ? styles.debt : ''}>{money(Math.max(0, card.balance))}</strong>
          </div>
          <div>
            <span>{t('cards.label_limit')}</span>
            <strong>{money(card.limit ?? 0)}</strong>
          </div>
        </div>
      )}

      <div className={styles.actions}>
        {actions.map(a => (
          <button
            key={a.key}
            type="button"
            className={`${styles.action} ${a.accent ? styles.actionAccent : ''} ${a.danger ? styles.actionDanger : ''}`}
            onClick={a.onClick}
          >
            <span className={styles.actionIcon}>{a.icon}</span>
            <span className={styles.actionLabel}>{a.label}</span>
          </button>
        ))}
      </div>

      {!isCredit && (
        <label className={formStyles.switchRow}>
          <span>
            {t('cards.include_in_total')}
            <small>{t('accounts.include_hint')}</small>
          </span>
          <span className={formStyles.switch}>
            <input
              type="checkbox"
              checked={card.includeInTotalBalance !== false}
              onChange={e => onToggleInclude(e.target.checked)}
            />
            <span />
          </span>
        </label>
      )}
    </Modal>
  );
};

export default AccountSheet;
