import { useTranslation } from 'react-i18next';
import type { SavingsGoal } from '../../types';
import { colorByKey } from '../../utils/accountColors';
import { goalProgress } from '../../utils/goalMath';
import plastic from '../plastic/Plastic.module.css';
import styles from './GoalPlastic.module.css';

const fmt = (n: number) => Math.round(n).toLocaleString('uz-Latn-UZ');

interface Props {
  goal: Pick<SavingsGoal, 'name' | 'icon' | 'savedAmount' | 'targetAmount' | 'currency' | 'deadline' | 'color'>;
  size?: 'sm' | 'lg';
}

/** Savings goal as a piggy-bank plastic: emoji, saved of target, progress and pace. */
const GoalPlastic = ({ goal, size = 'sm' }: Props) => {
  const { t } = useTranslation();
  const color = colorByKey(goal.color, goal.name);
  const { done, pct, days, months, perDay, overdue } = goalProgress(goal);

  const timeLabel = done
    ? t('savings.status_reached')
    : days <= 0
      ? t('savings.status_overdue')
      : days === 1
        ? t('savings.status_day_left')
        : days < 31
          ? t('savings.status_days_left', { n: days })
          : months <= 1
            ? t('savings.status_month_left')
            : t('savings.status_months_left', { n: months });

  return (
    <div
      className={`${plastic.plastic} ${size === 'lg' ? `${plastic.lg} ${styles.goalLg}` : ''} ${styles.goal}`}
      style={{ '--c-from': color.from, '--c-to': color.to } as React.CSSProperties}
    >
      <span className={plastic.orb1} aria-hidden />
      <span className={plastic.orb2} aria-hidden />

      <div className={plastic.top}>
        <span className={styles.title}>
          <span className={styles.emoji} aria-hidden>{goal.icon}</span>
          <span className={styles.name}>{goal.name}</span>
        </span>
        <span className={styles.pct}>{Math.floor(pct)}%</span>
      </div>

      <div className={plastic.amountWrap}>
        <span className={plastic.amount}>
          {fmt(goal.savedAmount)}
          <span className={plastic.cur}>{goal.currency}</span>
        </span>
        <span className={plastic.amountLabel}>{t('savings.of_target', { amount: fmt(goal.targetAmount) })}</span>
      </div>

      <div className={styles.bar}>
        <i className={done ? styles.barDone : ''} style={{ width: `${pct}%` }} />
      </div>

      <div className={styles.chips}>
        <span className={`${plastic.chip} ${done ? styles.chipDone : ''} ${overdue ? styles.chipOverdue : ''}`}>
          {timeLabel}
        </span>
        {perDay > 0 && (
          <span className={plastic.chip}>{t('savings.per_day', { amount: fmt(Math.ceil(perDay)) })}</span>
        )}
      </div>
    </div>
  );
};

export default GoalPlastic;
