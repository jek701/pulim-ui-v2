import { useEffect } from 'react';
import { HiXMark } from 'react-icons/hi2';
import { useApp } from '../context';
import { useCommunications } from '../hooks/useCommunications';
import Modal from '../components/Modal';
import styles from './Communications.module.css';
import { followCommunicationLink } from './followLink';

export default function CommunicationSurface() {
  const { user, setActiveTab } = useApp();
  const communications = useCommunications(user?.uid ?? null);
  const message = communications.surface;

  useEffect(() => {
    if (message?.presentation === 'modal' && !message.readAt) {
      communications.event.mutate({ id: message.id, action: 'read' });
    }
  }, [message?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!message) return null;
  const dismiss = () => communications.event.mutate({ id: message.id, action: 'dismiss' });
  const click = () => {
    communications.event.mutate({ id: message.id, action: 'click' });
    followCommunicationLink(message.ctaUrl, setActiveTab);
  };

  if (message.presentation === 'modal') {
    return (
      <Modal title={message.title} onClose={dismiss} footer={message.ctaUrl && (
        <button className={styles.primaryButton} type="button" onClick={click}>{message.ctaLabel || 'Открыть'}</button>
      )}>
        <p className={styles.modalBody}>{message.body}</p>
      </Modal>
    );
  }
  return (
    <aside className={styles.banner} aria-live="polite">
      <div><strong>{message.title}</strong><p>{message.body}</p></div>
      {message.ctaUrl && <button className={styles.bannerAction} type="button" onClick={click}>{message.ctaLabel || 'Открыть'}</button>}
      <button className={styles.iconButton} type="button" aria-label="Закрыть" onClick={dismiss}><HiXMark size={18}/></button>
    </aside>
  );
}
