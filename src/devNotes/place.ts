import type {DevNote} from '../hooks/useDevNotes';

export const TAB_LABELS: Record<string, string> = {
  home: 'Главная', transactions: 'Операции', cards: 'Счета', subscriptions: 'Подписки',
  charts: 'Графики', calendar: 'Календарь', settings: 'Настройки',
};

export function placeLabel(context: DevNote['context']): string {
  if (!context) return 'Из Telegram, без привязки к месту';
  const parts = [TAB_LABELS[context.tab ?? ''] ?? context.tab, context.modal, context.headings?.[0]]
    .filter((part, index, all): part is string => !!part && all.indexOf(part) === index);
  const element = context.elementText || context.elementLabel;
  if (element) parts.push(`«${element.length > 60 ? `${element.slice(0, 59)}…` : element}»`);
  else if (!context.selector) parts.push('весь экран');
  return parts.join(' · ');
}
