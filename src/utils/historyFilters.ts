/**
 * History filter shape. Lives outside both the page and the context so the two can
 * share it without importing each other. Filters are held in app context because
 * page-local state was wiped whenever the user switched tabs and came back.
 */
export interface HistoryFilters {
  types: ('income' | 'expense' | 'transfer')[];
  categoryIds: string[];
  subcategoryIds: string[];
  cardIds: string[];
  dateFrom: string | null;
  dateTo: string | null;
}

export const EMPTY_HISTORY_FILTERS: HistoryFilters = {
  types: [],
  categoryIds: [],
  subcategoryIds: [],
  cardIds: [],
  dateFrom: null,
  dateTo: null,
};
