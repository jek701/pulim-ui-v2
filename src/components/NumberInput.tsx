import { useState } from 'react';
import { formatAmountInput, normalizeAmountInput } from '../utils/money';

/**
 * Controlled text input that displays numbers with space-grouped thousands while
 * exposing the raw numeric string (plain digits, `.` decimal point) via onChange.
 * Parsing/formatting rules live in `utils/money.ts`.
 */

type NumberInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: string;
  onChange: (raw: string) => void;
  allowNegative?: boolean;
};

export const NumberInput: React.FC<NumberInputProps> = ({ value, onChange, allowNegative = false, ...props }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = normalizeAmountInput(e.target.value, allowNegative);
    if (raw !== null) onChange(raw);
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={formatAmountInput(value)}
      onChange={handleChange}
      {...props}
    />
  );
};

/**
 * Uncontrolled budget input for Settings — manages its own raw string state,
 * calls onSave(parsedNumber) on blur.
 *
 * `locked` is for premium-gated rows: the field must not pretend to accept input.
 * It used to format typed digits and show them as if saved, so the value looked
 * persisted until a reload silently dropped it.
 */
type BudgetInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'defaultValue' | 'onBlur' | 'type'> & {
  initialValue?: number;
  onSave: (value: number) => void;
  locked?: boolean;
  onLockedActivate?: () => void;
};

export const BudgetInput: React.FC<BudgetInputProps> = ({
  initialValue,
  onSave,
  locked = false,
  onLockedActivate,
  ...props
}) => {
  const [raw, setRaw] = useState(initialValue ? String(initialValue) : '');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (locked) return;
    const next = normalizeAmountInput(e.target.value);
    if (next !== null) setRaw(next);
  };

  const handleBlur = () => {
    if (locked) return;
    const v = parseFloat(raw);
    if (v > 0) onSave(v);
    else if (raw === '') onSave(0);
  };

  const activateLock = () => onLockedActivate?.();

  return (
    <input
      type="text"
      inputMode="decimal"
      value={formatAmountInput(raw)}
      onChange={handleChange}
      onBlur={handleBlur}
      readOnly={locked}
      aria-disabled={locked || undefined}
      onPointerDown={locked ? (event => { event.preventDefault(); activateLock(); }) : undefined}
      onKeyDown={locked ? (event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activateLock(); }
      }) : undefined}
      {...props}
    />
  );
};
