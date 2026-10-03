import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DndContext,
  closestCenter,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Modifier,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Card, CardType } from '../../types';
import { telegramApp, tgAtLeast } from '../../utils/telegram';
import { formatTotalsByCurrency } from '../../utils/format';
import PlasticSection, { PlasticList, PlasticStack } from '../plastic/PlasticSection';
import sectionStyles from '../plastic/PlasticSection.module.css';
import AccountPlastic, { HIDDEN_AMOUNT } from './AccountPlastic';
import styles from './AccountsList.module.css';

const SECTIONS: { type: CardType; title: string }[] = [
  { type: 'debit', title: 'accounts.section_cards' },
  { type: 'credit', title: 'accounts.section_credit' },
  { type: 'cash', title: 'accounts.section_cash' },
];

/**
 * Y-axis only, and never outside the section's stack — a card can't be dragged
 * sideways or into another section.
 */
const restrictToSection: Modifier = ({ transform, draggingNodeRect, containerNodeRect }) => {
  let y = transform.y;
  if (draggingNodeRect && containerNodeRect) {
    const minY = containerNodeRect.top - draggingNodeRect.top;
    const maxY = containerNodeRect.bottom - draggingNodeRect.bottom;
    y = Math.min(Math.max(y, minY), maxY);
  }
  return { ...transform, x: 0, y };
};

/** Telegram's swipe-down-to-minimise would fight a vertical drag. */
const setTelegramVerticalSwipes = (enabled: boolean) => {
  if (!telegramApp || !tgAtLeast('7.7')) return;
  if (enabled) telegramApp.enableVerticalSwipes?.();
  else telegramApp.disableVerticalSwipes?.();
};

function SortablePlastic({ card, index, hidden, onOpen, wasDragged }: {
  card: Card;
  index: number;
  hidden: boolean;
  onOpen: (card: Card) => void;
  wasDragged: () => boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });
  return (
    <div
      ref={setNodeRef}
      className={`${sectionStyles.item} ${isDragging ? styles.dragging : ''}`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        '--i': index,
      } as React.CSSProperties}
      {...attributes}
      {...listeners}
      role="button"
      aria-label={card.name}
      onClick={() => { if (!wasDragged()) onOpen(card); }}
    >
      <AccountPlastic card={card} hidden={hidden} />
    </div>
  );
}

interface Props {
  /** All accounts, already in the user's saved order. */
  cards: Card[];
  hidden: boolean;
  onOpen: (card: Card) => void;
  onReorder: (ids: string[]) => void;
  /** True while a card is being dragged; the page locks its scroll meanwhile. */
  onDraggingChange?: (dragging: boolean) => void;
}

/** Accounts grouped into Cards / Credit / Cash; long-press drag reorders within a section. */
const AccountsList = ({ cards, hidden, onOpen, onReorder, onDraggingChange }: Props) => {
  const { t } = useTranslation();
  // Suppresses the click that follows a drop so a reorder doesn't open the sheet.
  const lastDragEnd = useRef(0);
  const wasDragged = () => Date.now() - lastDragEnd.current < 250;

  // MouseSensor, not PointerSensor: pointer events also fire for touches, so a
  // plain scroll gesture used to start a drag. Touch drags need a still hold.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragStart = () => {
    onDraggingChange?.(true);
    setTelegramVerticalSwipes(false);
    telegramApp?.HapticFeedback?.impactOccurred?.('medium');
  };

  const finishDrag = () => {
    lastDragEnd.current = Date.now();
    onDraggingChange?.(false);
    setTelegramVerticalSwipes(true);
  };

  const handleDragEnd = (section: Card[]) => (event: DragEndEvent) => {
    finishDrag();
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = section.map(c => c.id);
    const moved = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
    // Splice the section's new order back into the global order at the same slots.
    let k = 0;
    const sectionIds = new Set(ids);
    onReorder(cards.map(c => (sectionIds.has(c.id) ? moved[k++] : c.id)));
  };

  let index = 0;
  return (
    <PlasticList>
      {SECTIONS.map(({ type, title }) => {
        const section = cards.filter(c => c.cardType === type);
        if (section.length === 0) return null;
        const total = type === 'credit'
          ? t('accounts.section_debt', { amount: formatTotalsByCurrency(section, c => Math.max(0, c.balance)) })
          : formatTotalsByCurrency(section.filter(c => c.includeInTotalBalance !== false), c => c.balance);
        return (
          <PlasticSection
            key={type}
            title={t(title)}
            count={section.length}
            total={total && (hidden ? HIDDEN_AMOUNT : total)}
          >
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToSection]}
              autoScroll={false}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd(section)}
              onDragCancel={finishDrag}
            >
              <SortableContext items={section.map(c => c.id)} strategy={verticalListSortingStrategy}>
                <PlasticStack>
                  {section.map(card => (
                    <SortablePlastic
                      key={card.id}
                      card={card}
                      index={index++}
                      hidden={hidden}
                      onOpen={onOpen}
                      wasDragged={wasDragged}
                    />
                  ))}
                </PlasticStack>
              </SortableContext>
            </DndContext>
          </PlasticSection>
        );
      })}
      {cards.length > 1 && <p className={styles.hint}>{t('accounts.reorder_hint')}</p>}
    </PlasticList>
  );
};

export default AccountsList;
