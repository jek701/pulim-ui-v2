import { useRef, useState } from 'react';
import styles from './EmojiInput.module.css';

interface Props {
  value: string;
  onChange: (emoji: string) => void;
  suggestions?: string[];
  label?: string;
  placeholder?: string;
  compactSuggestions?: boolean;
}

const getFirstEmoji = (str: string): string => {
  const seg = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(str)];
  return seg[0]?.segment ?? '';
};

const EmojiInput: React.FC<Props> = ({ value, onChange, suggestions, label, placeholder = 'Type any emoji…', compactSuggestions = false }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

  const handleChange = (raw: string) => {
    const first = getFirstEmoji(raw);
    if (first) {
      onChange(first);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className={styles.wrap}>
      {label && <p className={styles.label}>{label}</p>}
      <div className={styles.row}>
        <button
          type="button"
          className={`${styles.preview} ${focused ? styles.previewFocused : ''}`}
          onClick={() => { inputRef.current?.focus(); setFocused(true); }}
        >
          {value}
        </button>
        <input
          ref={inputRef}
          className={styles.hiddenInput}
          placeholder={placeholder}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={e => handleChange(e.target.value)}
        />
      </div>
      {suggestions && suggestions.length > 0 && (
        <div className={`${styles.suggestions} ${compactSuggestions ? styles.suggestionsCompact : ''}`}>
          {suggestions.map(s => (
            <button
              key={s}
              type="button"
              className={`${styles.chip} ${value === s ? styles.chipActive : ''}`}
              onClick={() => onChange(s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default EmojiInput;
