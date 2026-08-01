import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { HiXMark } from 'react-icons/hi2';
import { useModalClose } from '../hooks/useModalClose';
import { useSwipeDismiss } from '../hooks/useSwipeDismiss';
import styles from './Modal.module.css';

interface Props {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const Modal: React.FC<Props> = ({ title, onClose, children, footer }) => {
  const { isClosing, requestClose } = useModalClose(onClose);
  const { swipeRef, swipeAreaProps, swipeStyle } = useSwipeDismiss(requestClose);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') requestClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [requestClose]);

  return createPortal(
    <div className={`${styles.overlay} ${isClosing ? styles.overlayClosing : ''}`} onClick={requestClose}>
      <div className={styles.swipeLayer} style={swipeStyle}>
        <div
          ref={swipeRef}
          className={`${styles.sheet} ${isClosing ? styles.sheetClosing : ''}`}
          onClick={e => e.stopPropagation()}
          {...swipeAreaProps}
        >
          <div className={styles.swipeArea}>
            <div className={styles.handle} />
            <div className={styles.header}>
              <h2>{title}</h2>
              <button className={styles.close} onClick={requestClose}><HiXMark size={20} /></button>
            </div>
          </div>
          <div className={styles.body}>{children}</div>
          {footer && <div className={styles.footer}>{footer}</div>}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default Modal;
