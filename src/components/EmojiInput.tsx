import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './EmojiInput.module.css';

interface Props {
  value: string;
  onChange: (emoji: string) => void;
  suggestions?: string[];
  label?: string;
  placeholder?: string;
  compactSuggestions?: boolean;
  collapsibleInput?: boolean;
}

const getFirstEmoji = (str: string): string => {
  const seg = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(str)];
  return seg[0]?.segment ?? '';
};

const EmojiInput: React.FC<Props> = ({ value, onChange, suggestions, label, placeholder, compactSuggestions = false, collapsibleInput = false }) => {
  const { t } = useTranslation();
  const resolvedPlaceholder = placeholder ?? t('common.emoji_placeholder');
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
          aria-label={label ?? t('common.emoji_placeholder')}
          aria-expanded={collapsibleInput ? focused : undefined}
          onClick={() => { inputRef.current?.focus(); setFocused(true); }}
        >
          {value}
        </button>
        <input
          ref={inputRef}
          className={`${styles.hiddenInput} ${collapsibleInput && !focused ? styles.collapsedInput : ''}`}
          aria-label={label ?? resolvedPlaceholder}
          placeholder={resolvedPlaceholder}
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
