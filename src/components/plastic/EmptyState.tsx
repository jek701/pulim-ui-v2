import { HiPlus } from 'react-icons/hi2';
import styles from './EmptyState.module.css';

type Gradient = [from: string, to: string];

interface Props {
  title: string;
  hint: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Back, middle and front floating plastics. */
  ghosts: [Gradient, Gradient, Gradient];
  /** Optional emoji on the front plastic. */
  emoji?: string;
}

/** Floating stack of plastics + call to action, used when a list is empty. */
const EmptyState = ({ title, hint, actionLabel, onAction, ghosts, emoji }: Props) => {
  const vars = Object.fromEntries(
    ghosts.flatMap(([from, to], i) => [[`--g${i + 1}-from`, from], [`--g${i + 1}-to`, to]]),
  ) as React.CSSProperties;
  return (
    <div className={styles.empty} style={vars}>
      <div className={styles.emptyArt} aria-hidden>
        <span className={styles.ghost1} />
        <span className={styles.ghost2} />
        <span className={styles.ghost3}>{emoji}</span>
      </div>
      <h2>{title}</h2>
      <p>{hint}</p>
      {actionLabel && onAction && (
        <button className={styles.emptyBtn} onClick={onAction}>
          <HiPlus size={18} /> {actionLabel}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
