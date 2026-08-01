import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HiExclamationTriangle } from 'react-icons/hi2';
import Modal from './Modal';
import { tgShowConfirm } from '../utils/telegram';
import styles from './ConfirmDialog.module.css';

export interface ConfirmOptions {
  /** Sheet title, e.g. "Delete transaction?" */
  title: string;
  /** What exactly is being acted on, e.g. "Food · −200 000 UZS · 12 Jul". */
  message?: string;
  /** Consequences the user cannot see, e.g. "The card balance will be restored." */
  detail?: string;
  /** Highlighted irreversible-consequence line. */
  warning?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Renders the confirm button in the destructive colour. Defaults to true. */
  danger?: boolean;
}

type Pending = ConfirmOptions & { resolve: (value: boolean) => void };

/**
 * Replacement for `window.confirm`: a themed sheet in the browser/PWA, Telegram's
 * own dialog inside a Mini App. Native `confirm()` only ever said "Delete?" — it
 * could not name the entity or warn that a balance was about to change.
 *
 * Usage mirrors `usePremiumGate()`:
 *   const { confirm, node } = useConfirm();
 *   if (!(await confirm({ title: … }))) return;
 *   … render {node} once in the component tree
 */
export function useConfirm() {
  const { t } = useTranslation();
  const [pending, setPending] = useState<Pending | null>(null);
  // Guards against a stale sheet resolving twice (overlay click + button).
  const pendingRef = useRef<Pending | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    const nativeLines = [options.title, options.message, options.detail, options.warning]
      .filter(Boolean)
      .join('\n\n');
    const native = tgShowConfirm(nativeLines);
    if (native) return native;

    return new Promise<boolean>(resolve => {
      const next: Pending = { ...options, resolve };
      pendingRef.current = next;
      setPending(next);
    });
  }, []);

  const settle = useCallback((value: boolean) => {
    const current = pendingRef.current;
    pendingRef.current = null;
    setPending(null);
    current?.resolve(value);
  }, []);

  const danger = pending?.danger ?? true;

  const node = pending ? (
    <Modal title={pending.title} onClose={() => settle(false)}>
      <div className={styles.body}>
        {pending.message && <p className={styles.message}>{pending.message}</p>}
        {pending.detail && <p className={styles.detail}>{pending.detail}</p>}
        {pending.warning && (
          <p className={styles.warning}>
            <HiExclamationTriangle className={styles.warningIcon} size={16} />
            <span>{pending.warning}</span>
          </p>
        )}
        <div className={styles.actions}>
          <button type="button" className={`${styles.btn} ${styles.cancel}`} onClick={() => settle(false)}>
            {pending.cancelLabel ?? t('common.cancel')}
          </button>
          <button
            type="button"
            className={`${styles.btn} ${danger ? styles.confirmDanger : styles.confirm}`}
            onClick={() => settle(true)}
          >
            {pending.confirmLabel ?? t('common.confirm')}
          </button>
        </div>
      </div>
    </Modal>
  ) : null;

  return { confirm, node };
}
