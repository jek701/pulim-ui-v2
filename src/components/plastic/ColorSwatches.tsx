import { HiCheck } from 'react-icons/hi2';
import { ACCOUNT_COLORS } from '../../utils/accountColors';
import styles from './ColorSwatches.module.css';

/** One-row gradient picker over the shared plastic palette. */
const ColorSwatches = ({ value, onChange, label }: {
  value: string;
  onChange: (key: string) => void;
  label: string;
}) => (
  <div className={styles.swatches} role="radiogroup" aria-label={label}>
    {ACCOUNT_COLORS.map(c => (
      <button
        key={c.key}
        type="button"
        role="radio"
        aria-checked={value === c.key}
        aria-label={c.key}
        className={`${styles.swatch} ${value === c.key ? styles.swatchActive : ''}`}
        style={{ background: `linear-gradient(135deg, ${c.from}, ${c.to})` }}
        onClick={() => onChange(c.key)}
      >
        {value === c.key && <HiCheck size={16} />}
      </button>
    ))}
  </div>
);

export default ColorSwatches;
