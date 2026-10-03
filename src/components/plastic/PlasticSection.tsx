import { HiChevronDown } from 'react-icons/hi2';
import styles from './PlasticSection.module.css';

interface Props {
  title: string;
  count: number;
  /** Right-hand summary, e.g. per-currency totals. */
  total?: string;
  /** Makes the header a button with a chevron (collapsible section, breakdown…). */
  toggle?: { open: boolean; onToggle: () => void; label?: string };
  children?: React.ReactNode;
}

/** Uppercase section header + stacked plastics, shared by accounts, goals and debts. */
const PlasticSection = ({ title, count, total, toggle, children }: Props) => {
  const head = (
    <>
      <h2>
        {title}
        <span className={styles.count}>{count}</span>
        {toggle && (
          <HiChevronDown className={`${styles.chevron} ${toggle.open ? styles.chevronOpen : ''}`} size={14} aria-hidden />
        )}
      </h2>
      {total && <span className={styles.total}>{total}</span>}
    </>
  );
  return (
    <section className={styles.section}>
      {toggle ? (
        <button
          type="button"
          className={`${styles.head} ${styles.headBtn}`}
          aria-expanded={toggle.open}
          aria-label={toggle.label}
          onClick={toggle.onToggle}
        >
          {head}
        </button>
      ) : (
        <header className={styles.head}>{head}</header>
      )}
      {children}
    </section>
  );
};

export const PlasticList = ({ children }: { children: React.ReactNode }) => (
  <div className={styles.list}>{children}</div>
);

export const PlasticStack = ({ children }: { children: React.ReactNode }) => (
  <div className={styles.stack}>{children}</div>
);

/**
 * A tappable plastic in a stack: staggered entrance (`index`) and press feedback.
 * Sortable lists build their own wrapper with the `.item` class of this module.
 */
export const PlasticItem = ({ index, label, onOpen, children }: {
  index: number;
  label: string;
  onOpen: () => void;
  children: React.ReactNode;
}) => (
  <div
    className={styles.item}
    style={{ '--i': index } as React.CSSProperties}
    role="button"
    tabIndex={0}
    aria-label={label}
    onClick={onOpen}
    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
  >
    {children}
  </div>
);

export default PlasticSection;
