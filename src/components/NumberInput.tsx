import { useState } from 'react';

/**
 * Controlled text input that displays numbers with comma formatting (1,000,000)
 * while exposing the raw numeric string (no commas) via onChange.
 */

type NumberInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: string;
  onChange: (raw: string) => void;
};

const formatDisplay = (raw: string): string => {
  if (!raw) return '';
  const [int, dec] = raw.split('.');
  const intFormatted = Number(int || '0').toLocaleString('en-US');
  return dec !== undefined ? `${intFormatted}.${dec}` : intFormatted;
};

export const NumberInput: React.FC<NumberInputProps> = ({ value, onChange, ...props }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/,/g, '');
    if (raw === '' || /^\d*\.?\d*$/.test(raw)) onChange(raw);
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={formatDisplay(value)}
      onChange={handleChange}
      {...props}
    />
  );
};

/**
 * Uncontrolled budget input for Settings — manages its own raw string state,
 * calls onSave(parsedNumber) on blur. Re-initializes when `resetKey` changes.
 */
type BudgetInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'defaultValue' | 'onBlur' | 'type'> & {
  initialValue?: number;
  onSave: (value: number) => void;
};

export const BudgetInput: React.FC<BudgetInputProps> = ({ initialValue, onSave, ...props }) => {
  const [raw, setRaw] = useState(initialValue ? String(initialValue) : '');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const stripped = e.target.value.replace(/,/g, '');
    if (stripped === '' || /^\d*\.?\d*$/.test(stripped)) setRaw(stripped);
  };

  const handleBlur = () => {
    const v = parseFloat(raw);
    if (v > 0) onSave(v);
    else if (raw === '') onSave(0);
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={formatDisplay(raw)}
      onChange={handleChange}
      onBlur={handleBlur}
      {...props}
    />
  );
};
