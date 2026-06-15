import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { HiBars3 } from 'react-icons/hi2';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { resolveHomeWidgets, type HomeWidgetSetting, type HomeWidgetId } from '../utils/homeWidgets';
import styles from './HomeWidgetsSettings.module.css';

interface Props {
  value?: HomeWidgetSetting[] | null;
  onChange: (next: HomeWidgetSetting[]) => Promise<void> | void;
}

const ICON: Record<HomeWidgetId, string> = {
  balance: '💰',
  askAi: '✨',
  budget: '📊',
  forecast: '🔮',
  exchangeRates: '💱',
  recent: '📜',
};

function SortableRow({
  widget, label, onToggle,
}: { widget: HomeWidgetSetting; label: string; onToggle: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: widget.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style} className={styles.row}>
      <button className={styles.handle} {...attributes} {...listeners} type="button" aria-label="Drag">
        <HiBars3 size={18} />
      </button>
      <span className={styles.icon}>{ICON[widget.id]}</span>
      <span className={styles.label}>{label}</span>
      <label className={styles.switch}>
        <input
          type="checkbox"
          checked={widget.enabled}
          onChange={onToggle}
        />
        <span className={styles.slider} />
      </label>
    </div>
  );
}

const HomeWidgetsSettings = ({ value, onChange }: Props) => {
  const { t } = useTranslation();
  const [items, setItems] = useState<HomeWidgetSetting[]>(() => resolveHomeWidgets(value));

  useEffect(() => { setItems(resolveHomeWidgets(value)); }, [value]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  const labels: Record<HomeWidgetId, string> = {
    balance: t('settings.widget_balance'),
    askAi: t('settings.widget_ask_ai'),
    budget: t('settings.widget_budget'),
    forecast: t('settings.widget_forecast'),
    exchangeRates: t('settings.widget_exchange_rates'),
    recent: t('settings.widget_recent'),
  };

  const persist = (next: HomeWidgetSetting[]) => {
    setItems(next);
    void onChange(next);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex(i => i.id === active.id);
    const newIndex = items.findIndex(i => i.id === over.id);
    persist(arrayMove(items, oldIndex, newIndex));
  };

  const toggle = (id: HomeWidgetId) =>
    persist(items.map(i => i.id === id ? { ...i, enabled: !i.enabled } : i));

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
        <div className={styles.list}>
          {items.map(w => (
            <SortableRow
              key={w.id}
              widget={w}
              label={labels[w.id]}
              onToggle={() => toggle(w.id)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};

export default HomeWidgetsSettings;
