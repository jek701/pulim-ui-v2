import {useState} from 'react';
import dayjs from 'dayjs';
import {fetchDevNoteScreenshot, type DevNote, type DevNoteStatus} from '../hooks/useDevNotes';
import Sheet from './Sheet';
import {placeLabel} from './place';
import styles from './DevNotes.module.css';

const STATUS: Record<DevNoteStatus, {label: string; className: string}> = {
  new: {label: 'Новая', className: styles.statusNew},
  in_progress: {label: 'В работе', className: styles.statusProgress},
  needs_reply: {label: 'Нужен ответ', className: styles.statusReply},
  done: {label: 'Сделано', className: styles.statusDone},
  rejected: {label: 'Отклонено', className: styles.statusRejected},
};

// Notes waiting on the owner float to the top; the rest stay newest first.
const rank = (note: DevNote) => (note.status === 'needs_reply' ? 0 : 1);

interface Props {
  notes: DevNote[];
  loading: boolean;
  onReply: (id: string, text: string) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
  onNew: () => void;
  onClose: () => void;
}

const DevNotesList = ({notes, loading, onReply, onDelete, onNew, onClose}: Props) => {
  const [openId, setOpenId] = useState<string | null>(null);
  const sorted = [...notes].sort((a, b) => rank(a) - rank(b) || b.createdAt - a.createdAt);

  return (
    <Sheet title="Мои заметки" onClose={onClose}>
      <button type="button" className={styles.primary} onClick={onNew}>+ Новая заметка</button>
      {loading && <p className={styles.muted}>Загружаю…</p>}
      {!loading && notes.length === 0 && (
        <p className={styles.muted}>Пока пусто. Нажми на лампочку и выбери место на экране, или напиши боту /idea.</p>
      )}
      <ul className={styles.list}>
        {sorted.map(note => (
          <NoteItem
            key={note.id}
            note={note}
            open={openId === note.id}
            onToggle={() => setOpenId(current => (current === note.id ? null : note.id))}
            onReply={text => onReply(note.id, text)}
            onDelete={() => onDelete(note.id)}
          />
        ))}
      </ul>
    </Sheet>
  );
};

interface ItemProps {
  note: DevNote;
  open: boolean;
  onToggle: () => void;
  onReply: (text: string) => Promise<unknown>;
  onDelete: () => Promise<unknown>;
}

const NoteItem = ({note, open, onToggle, onReply, onDelete}: ItemProps) => {
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const status = STATUS[note.status];
  const lastClaude = [...note.thread].reverse().find(message => message.author === 'claude');

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Ошибка сети');
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className={styles.item}>
      <button type="button" className={styles.itemHead} onClick={onToggle}>
        <span className={`${styles.status} ${status.className}`}>{status.label}</span>
        <span className={styles.date}>
          {note.source === 'telegram' ? 'Telegram · ' : ''}{dayjs(note.createdAt).format('DD.MM HH:mm')}
        </span>
        <span className={`${styles.comment} ${open ? '' : styles.clamp}`}>{note.comment}</span>
        {!open && lastClaude && <span className={styles.lastReply}>Claude: {lastClaude.text}</span>}
      </button>

      {open && (
        <div className={styles.itemBody}>
          <p className={styles.where}>{placeLabel(note.context)}</p>
          {note.hasScreenshot && !screenshot && (
            <button
              type="button"
              className={styles.link}
              disabled={busy}
              onClick={() => void run(async () => setScreenshot(await fetchDevNoteScreenshot(note.id)))}
            >
              Показать скриншот
            </button>
          )}
          {screenshot && <img className={styles.preview} src={screenshot} alt="Скриншот экрана" />}

          {note.thread.length > 0 && (
            <div className={styles.thread}>
              {note.thread.map((message, index) => (
                <div key={`${message.at}-${index}`} className={message.author === 'claude' ? styles.fromClaude : styles.fromOwner}>
                  <span className={styles.author}>{message.author === 'claude' ? 'Claude' : 'Ты'}</span>
                  {message.text}
                </div>
              ))}
            </div>
          )}
          {note.commits.length > 0 && <p className={styles.muted}>Коммиты: {note.commits.join(', ')}</p>}

          <textarea
            className={styles.textarea}
            rows={2}
            maxLength={4_000}
            placeholder={note.status === 'needs_reply' ? 'Ответ на вопрос…'
              : note.status === 'done' || note.status === 'rejected' ? 'Что-то не так? Напиши — заметка вернётся в работу'
                : 'Дополнение к заметке…'}
            value={reply}
            onChange={event => setReply(event.target.value)}
          />
          <div className={styles.row}>
            <button
              type="button"
              className={styles.danger}
              disabled={busy}
              onClick={() => { if (window.confirm('Удалить заметку?')) void run(onDelete); }}
            >
              Удалить
            </button>
            <button
              type="button"
              className={styles.primary}
              disabled={busy || !reply.trim()}
              onClick={() => void run(() => onReply(reply.trim())).then(ok => ok && setReply(''))}
            >
              Ответить
            </button>
          </div>
          {error && <p className={styles.error}>{error}</p>}
        </div>
      )}
    </li>
  );
};

export default DevNotesList;
