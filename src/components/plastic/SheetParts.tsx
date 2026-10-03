import styles from './Sheet.module.css';

export interface SheetStat {
  label: string;
  value: string;
  tone?: 'positive' | 'negative';
}

/** Two-column grid of small labelled values under the big plastic in a sheet. */
export const SheetStats = ({ items }: { items: SheetStat[] }) => (
  <div className={styles.stats}>
    {items.map(s => (
      <div key={s.label}>
        <span>{s.label}</span>
        <strong className={s.tone ? styles[s.tone] : ''}>{s.value}</strong>
      </div>
    ))}
  </div>
);

export interface SheetAction {
  key: string;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  accent?: boolean;
  danger?: boolean;
}

/** Round icon buttons with captions — every action for the opened item. */
export const SheetActions = ({ actions }: { actions: SheetAction[] }) => (
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
);

export const SheetNote = ({ children }: { children: React.ReactNode }) => (
  <p className={styles.note}>{children}</p>
);
