import { useTranslation } from 'react-i18next';
import type { Debt } from '../../types';
import { formatShortDate } from '../../utils/format';
import { debtRemaining, debtTotal, isDebtOverdue } from '../../utils/debtMath';
import plastic from '../plastic/Plastic.module.css';
import styles from './DebtPlastic.module.css';

const fmt = (n: number) => (Math.round(n * 100) / 100).toLocaleString('uz-Latn-UZ');

/** Colour carries meaning here: warm = I owe, green = owed to me, grey = settled. */
const GRADIENT = {
  i_owe: ['#B91C1C', '#F97316'],
  owe_me: ['#047857', '#34D399'],
  paid: ['#374151', '#6B7280'],
} as const;

interface Props {
  debt: Debt;
  size?: 'sm' | 'lg';
}

const DebtPlastic = ({ debt, size = 'sm' }: Props) => {
  const { t, i18n } = useTranslation();
  const total = debtTotal(debt);
  const paid = debt.paidAmount || 0;
  const remaining = debtRemaining(debt);
  const partly = !debt.isPaid && paid > 0;
  const overdue = isDebtOverdue(debt);
  const [from, to] = GRADIENT[debt.isPaid ? 'paid' : debt.direction];
  const comm = debt.commission;

  return (
    <div
      className={`${plastic.plastic} ${size === 'lg' ? plastic.lg : ''} ${styles.debt}`}
      style={{ '--c-from': from, '--c-to': to } as React.CSSProperties}
    >
      <span className={plastic.orb1} aria-hidden />
      <span className={plastic.orb2} aria-hidden />

      <div className={plastic.top}>
        <span className={styles.who}>
          <span className={styles.avatar} aria-hidden>{debt.person.trim().charAt(0).toUpperCase()}</span>
          <span className={styles.person}>{debt.person}</span>
        </span>
        {debt.isPaid ? (
          <span className={plastic.chip}>
            {debt.direction === 'i_owe' ? t('debts.tab_i_owe') : t('debts.tab_owe_me')}
          </span>
        ) : debt.dueDate ? (
          <span className={`${plastic.chip} ${overdue ? styles.chipOverdue : ''}`}>
            {overdue
              ? t('debts.overdue_chip')
              : t('debts.due_chip', { date: formatShortDate(debt.dueDate, i18n.language) })}
          </span>
        ) : null}
      </div>

      {/* The sheet shows the full comment under the large plastic instead. */}
      {debt.comment && size === 'sm' && <p className={styles.comment}>{debt.comment}</p>}

      <div className={plastic.bottom}>
        <div className={plastic.amountWrap}>
          <span className={plastic.amountLabel}>
            {debt.isPaid ? t('debts.label_paid') : partly ? t('debts.label_remaining') : t('debts.label_total')}
          </span>
          <span className={plastic.amount}>
            {fmt(debt.isPaid ? total : remaining)}
            <span className={plastic.cur}>{debt.currency}</span>
          </span>
        </div>
        {comm && (
          <div className={plastic.chips}>
            <span className={plastic.chip}>
              +{comm.type === 'percent' ? `${comm.value}%` : fmt(comm.value)}
            </span>
          </div>
        )}
      </div>

      {partly && (
        <div className={plastic.limitRow}>
          <div className={plastic.bar}>
            <i style={{ width: `${Math.min(100, (paid / total) * 100)}%` }} />
          </div>
          <span className={plastic.limitText}>{t('debts.paid_of', { paid: fmt(paid), total: fmt(total) })}</span>
        </div>
      )}
    </div>
  );
};

export default DebtPlastic;
