import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Card, CardType, Currency } from '../../types';
import { telegramApp } from '../../utils/telegram';
import AccountPlastic, { HIDDEN_AMOUNT } from './AccountPlastic';
import styles from './AccountsList.module.css';

const SECTIONS: { type: CardType; title: string }[] = [
  { type: 'debit', title: 'accounts.section_cards' },
  { type: 'credit', title: 'accounts.section_credit' },
  { type: 'cash', title: 'accounts.section_cash' },
];

/** Per-currency totals, e.g. "12 400 000 UZS · 300 USD". */
function sumByCurrency(cards: Card[], value: (c: Card) => number): string {
  const totals = new Map<Currency, number>();
  for (const c of cards) totals.set(c.currency, (totals.get(c.currency) ?? 0) + value(c));
  return [...totals].map(([cur, n]) => `${n.toLocaleString('uz-Latn-UZ')} ${cur}`).join(' · ');
}

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
      className={`${styles.item} ${isDragging ? styles.dragging : ''}`}
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
}

/** Accounts grouped into Cards / Credit / Cash; long-press drag reorders within a section. */
const AccountsList = ({ cards, hidden, onOpen, onReorder }: Props) => {
  const { t } = useTranslation();
  // Suppresses the click that follows a drop so a reorder doesn't open the sheet.
  const lastDragEnd = useRef(0);
  const wasDragged = () => Date.now() - lastDragEnd.current < 250;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 280, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (section: Card[]) => (event: DragEndEvent) => {
    lastDragEnd.current = Date.now();
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
    <div className={styles.list}>
      {SECTIONS.map(({ type, title }) => {
        const section = cards.filter(c => c.cardType === type);
        if (section.length === 0) return null;
        const total = type === 'credit'
          ? t('accounts.section_debt', { amount: sumByCurrency(section, c => Math.max(0, c.balance)) })
          : sumByCurrency(section.filter(c => c.includeInTotalBalance !== false), c => c.balance);
        return (
          <section key={type} className={styles.section}>
            <header className={styles.sectionHead}>
              <h2>
                {t(title)}
                <span className={styles.count}>{section.length}</span>
              </h2>
              {total && <span className={styles.sectionTotal}>{hidden ? HIDDEN_AMOUNT : total}</span>}
            </header>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={() => telegramApp?.HapticFeedback?.impactOccurred?.('medium')}
              onDragEnd={handleDragEnd(section)}
              onDragCancel={() => { lastDragEnd.current = Date.now(); }}
            >
              <SortableContext items={section.map(c => c.id)} strategy={verticalListSortingStrategy}>
                <div className={styles.stack}>
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
                </div>
              </SortableContext>
            </DndContext>
          </section>
        );
      })}
      {cards.length > 1 && <p className={styles.hint}>{t('accounts.reorder_hint')}</p>}
    </div>
  );
};

export default AccountsList;
