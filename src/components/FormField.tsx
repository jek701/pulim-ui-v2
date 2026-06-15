import styles from './FormField.module.css';

interface FieldProps {
  label?: string;
  error?: string;
  children: React.ReactNode;
}

export const Field: React.FC<FieldProps> = ({ label, error, children }) => (
  <div className={styles.field}>
    {label && <label className={styles.label}>{label}</label>}
    {children}
    {error && <span className={styles.error}>{error}</span>}
  </div>
);

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { label?: string };

export const Input: React.FC<InputProps> = ({ label, ...props }) => (
  <div className={styles.field}>
    {label && <label className={styles.label}>{label}</label>}
    <input className={styles.input} {...props} />
  </div>
);

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  options: { value: string | number; label: string }[];
};

export const Select: React.FC<SelectProps> = ({ label, options, ...props }) => (
  <div className={styles.field}>
    {label && <label className={styles.label}>{label}</label>}
    <select className={styles.input} {...props}>
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  </div>
);

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string };

export const Textarea: React.FC<TextareaProps> = ({ label, ...props }) => (
  <div className={styles.field}>
    {label && <label className={styles.label}>{label}</label>}
    <textarea className={`${styles.input} ${styles.textarea}`} {...props} />
  </div>
);
