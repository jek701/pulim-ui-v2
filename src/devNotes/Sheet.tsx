import {createPortal} from 'react-dom';
import {HiXMark} from 'react-icons/hi2';
import {DEV_NOTES_ATTR} from './capture';
import styles from './DevNotes.module.css';

const ui = {[DEV_NOTES_ATTR]: ''};

const Sheet = ({title, onClose, children}: {title: string; onClose: () => void; children: React.ReactNode}) =>
  createPortal(
    <div {...ui} className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={event => event.stopPropagation()}>
        <div className={styles.header}>
          <h2>{title}</h2>
          <button type="button" className={styles.close} aria-label="Закрыть" onClick={onClose}><HiXMark size={20} /></button>
        </div>
        <div className={styles.body}>{children}</div>
      </div>
    </div>,
    document.body,
  );

export default Sheet;
