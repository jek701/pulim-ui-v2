import {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {useTranslation} from 'react-i18next';
import {HiOutlineLightBulb} from 'react-icons/hi2';
import {useDevNotes, type DevNoteContext} from '../hooks/useDevNotes';
import {captureScreenshot, describeTarget, DEV_NOTES_ATTR, elementAt} from './capture';
import DevNotesList from './DevNotesList';
import Sheet from './Sheet';
import {placeLabel} from './place';
import styles from './DevNotes.module.css';

// Owner-only tool, so copy is Russian-only and stays out of the locale files.

type Phase =
  | {kind: 'idle'}
  | {kind: 'picking'}
  | {kind: 'capturing'}
  | {kind: 'composing'; context: DevNoteContext; screenshot?: string}
  | {kind: 'list'};

const POSITION_KEY = 'devNotes.fabPosition';
const SEEN_KEY = 'devNotes.seenAt';
const LONG_PRESS_MS = 550;
const FAB = 52;
const EDGE = 8;
const ui = {[DEV_NOTES_ATTR]: ''};

const readNumber = (key: string) => {
  try { return Number(localStorage.getItem(key)) || 0; } catch { return 0; }
};
const write = (key: string, value: string) => {
  try { localStorage.setItem(key, value); } catch { /* storage unavailable */ }
};

function readPosition() {
  try {
    const saved = JSON.parse(localStorage.getItem(POSITION_KEY) ?? 'null') as {x: number; y: number} | null;
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) return saved;
  } catch { /* fall through */ }
  return {x: 1, y: 0.62};
}

const DevNotesRoot = ({uid, activeTab}: {uid: string; activeTab: string}) => {
  const {i18n} = useTranslation();
  const devNotes = useDevNotes(uid);
  const [phase, setPhase] = useState<Phase>({kind: 'idle'});
  const [draft, setDraft] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [seenAt, setSeenAt] = useState(() => readNumber(SEEN_KEY));

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2_500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const attention = devNotes.notes.filter(note => note.status === 'needs_reply'
    || ((note.status === 'done' || note.status === 'rejected') && note.updatedAt > seenAt)).length;

  const pick = async (target: Element | null) => {
    setPhase({kind: 'capturing'});
    const context = describeTarget(target, {tab: activeTab, language: i18n.language});
    // Let the picker overlay unmount before the DOM is cloned.
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const screenshot = await captureScreenshot(context.rect);
    setPhase({kind: 'composing', context, screenshot});
  };

  const openList = () => {
    const now = Date.now();
    write(SEEN_KEY, String(now));
    setSeenAt(now);
    setPhase({kind: 'list'});
    void devNotes.refetch();
  };

  const send = async () => {
    if (phase.kind !== 'composing' || !draft.trim()) return;
    try {
      await devNotes.create.mutateAsync({comment: draft.trim(), context: phase.context, screenshot: phase.screenshot});
      setDraft('');
      setPhase({kind: 'idle'});
      setToast('Заметка отправлена ✓');
    } catch (error) {
      setToast(`Не отправилось: ${error instanceof Error ? error.message : 'ошибка сети'}`);
    }
  };

  return (
    <>
      {phase.kind === 'idle' && (
        <Fab badge={attention} onTap={() => setPhase({kind: 'picking'})} onLongPress={openList} />
      )}
      {phase.kind === 'picking' && (
        <Picker onPick={target => void pick(target)} onCancel={() => setPhase({kind: 'idle'})} onList={openList} />
      )}
      {phase.kind === 'capturing' && createPortal(
        // Also swallows the click that follows the picking pointerup.
        <div {...ui} className={styles.blocker}><div className={styles.spinner} /></div>,
        document.body,
      )}
      {phase.kind === 'composing' && (
        <Composer
          context={phase.context}
          screenshot={phase.screenshot}
          draft={draft}
          sending={devNotes.create.isPending}
          onDraft={setDraft}
          onSend={() => void send()}
          onRepick={() => setPhase({kind: 'picking'})}
          onClose={() => setPhase({kind: 'idle'})}
        />
      )}
      {phase.kind === 'list' && (
        <DevNotesList
          notes={devNotes.notes}
          loading={devNotes.loading}
          onReply={(id, text) => devNotes.reply.mutateAsync({id, text})}
          onDelete={id => devNotes.remove.mutateAsync(id)}
          onNew={() => setPhase({kind: 'picking'})}
          onClose={() => setPhase({kind: 'idle'})}
        />
      )}
      {toast && createPortal(<div {...ui} className={styles.toast}>{toast}</div>, document.body)}
    </>
  );
};

const Fab = ({badge, onTap, onLongPress}: {badge: number; onTap: () => void; onLongPress: () => void}) => {
  const [position, setPosition] = useState(readPosition);
  const gesture = useRef<{startX: number; startY: number; dragged: boolean; longPressed: boolean; timer: number} | null>(null);

  const finish = () => {
    if (gesture.current) window.clearTimeout(gesture.current.timer);
    gesture.current = null;
  };

  return createPortal(
    <button
      {...ui}
      type="button"
      aria-label="Заметка для доработки"
      className={styles.fab}
      style={{
        left: `calc(${EDGE}px + ${position.x} * (100vw - ${FAB + EDGE * 2}px))`,
        top: `calc(${EDGE}px + ${position.y} * (var(--app-height) - ${FAB + EDGE * 2}px))`,
      }}
      onPointerDown={event => {
        event.currentTarget.setPointerCapture(event.pointerId);
        const timer = window.setTimeout(() => {
          if (!gesture.current || gesture.current.dragged) return;
          gesture.current.longPressed = true;
          onLongPress();
        }, LONG_PRESS_MS);
        gesture.current = {startX: event.clientX, startY: event.clientY, dragged: false, longPressed: false, timer};
      }}
      onPointerMove={event => {
        const current = gesture.current;
        if (!current || current.longPressed) return;
        if (!current.dragged && Math.hypot(event.clientX - current.startX, event.clientY - current.startY) < 8) return;
        current.dragged = true;
        setPosition({
          x: Math.min(1, Math.max(0, (event.clientX - FAB / 2 - EDGE) / (innerWidth - FAB - EDGE * 2))),
          y: Math.min(1, Math.max(0, (event.clientY - FAB / 2 - EDGE) / (innerHeight - FAB - EDGE * 2))),
        });
      }}
      onPointerUp={() => {
        const current = gesture.current;
        finish();
        if (!current) return;
        if (current.dragged) write(POSITION_KEY, JSON.stringify(position));
        else if (!current.longPressed) onTap();
      }}
      onPointerCancel={finish}
      onContextMenu={event => event.preventDefault()}
    >
      <HiOutlineLightBulb size={22} />
      {badge > 0 && <span className={styles.badge}>{badge}</span>}
    </button>,
    document.body,
  );
};

const Picker = ({onPick, onCancel, onList}: {onPick: (target: Element | null) => void; onCancel: () => void; onList: () => void}) => {
  const [box, setBox] = useState<DOMRect | null>(null);
  const target = useRef<Element | null>(null);

  const aim = (x: number, y: number) => {
    target.current = elementAt(x, y);
    setBox(target.current?.getBoundingClientRect() ?? null);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return createPortal(
    <div
      {...ui}
      className={styles.pickLayer}
      onPointerMove={event => aim(event.clientX, event.clientY)}
      onPointerDown={event => aim(event.clientX, event.clientY)}
      // pointerup, not click: on touch screens you can drag a finger to aim, then lift.
      onPointerUp={event => { aim(event.clientX, event.clientY); onPick(target.current); }}
    >
      {box && (
        <div className={styles.pickBox} style={{left: box.left, top: box.top, width: box.width, height: box.height}} />
      )}
      <div className={styles.pickBar} onPointerUp={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()}>
        <span>Нажми на место, к которому заметка</span>
        <div className={styles.pickActions}>
          <button type="button" onClick={() => onPick(null)}>Весь экран</button>
          <button type="button" onClick={onList}>Мои заметки</button>
          <button type="button" onClick={onCancel}>Отмена</button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

interface ComposerProps {
  context: DevNoteContext;
  screenshot?: string;
  draft: string;
  sending: boolean;
  onDraft: (value: string) => void;
  onSend: () => void;
  onRepick: () => void;
  onClose: () => void;
}

const Composer = ({context, screenshot, draft, sending, onDraft, onSend, onRepick, onClose}: ComposerProps) => (
  <Sheet title="Новая заметка" onClose={onClose}>
    {screenshot
      ? <img className={styles.preview} src={screenshot} alt="Скриншот экрана" />
      : <p className={styles.muted}>Скриншот не получился — отправлю место и текст.</p>}
    <p className={styles.where}>{placeLabel(context)}</p>
    <textarea
      className={styles.textarea}
      autoFocus
      rows={5}
      maxLength={4_000}
      placeholder="Что улучшить? Например: «сделать сумму крупнее и показывать остаток по карте»"
      value={draft}
      onChange={event => onDraft(event.target.value)}
      onKeyDown={event => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) onSend(); }}
    />
    <div className={styles.row}>
      <button type="button" className={styles.secondary} onClick={onRepick}>Выбрать заново</button>
      <button type="button" className={styles.primary} disabled={sending || !draft.trim()} onClick={onSend}>
        {sending ? 'Отправляю…' : 'Отправить'}
      </button>
    </div>
  </Sheet>
);

export default DevNotesRoot;
