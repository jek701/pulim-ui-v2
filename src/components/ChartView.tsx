import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ActiveFilters } from '../pages/Transactions';
import type { Budget, Category, Currency, Transaction } from '../types';
import dayjs from '../utils/dayjs';
import { PremiumWall } from './PremiumLock';
import InteractiveFinanceChart, {
  type FinanceChartType,
  type FinanceChartView,
  type FinancePieDatum,
} from './InteractiveFinanceChart';
import styles from './ChartView.module.css';
import { getTransactionKind } from '../utils/transactionKind';

const FALLBACK_COLORS = ['#7C3AED', '#0A84FF', '#30D158', '#FF9F0A', '#FF375F', '#5AC8FA', '#BF5AF2', '#FFD60A'];

interface Props {
  chartType: FinanceChartType;
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  viewDate: { month: number; year: number };
  filters: ActiveFilters;
  demoMode?: boolean;
}

const transactionCategoryId = (transaction: Transaction) => (
  transaction.source === 'debt_payment'
    ? '__debt_payments__'
    : transaction.source === 'return'
      ? transaction.categoryId
    : transaction.source
      ? (transaction.sourceLabel ?? transaction.source)
      : transaction.categoryId
);

const ChartView = ({ chartType, transactions, categories, viewDate, filters, demoMode = false }: Props) => {
  const { t } = useTranslation();
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>('UZS');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const currencies = useMemo(() => Array.from(new Set(transactions.map(item => item.currency))).sort((a, b) => (
    a === 'UZS' ? -1 : b === 'UZS' ? 1 : a.localeCompare(b)
  )), [transactions]);
  const activeCurrency = currencies.includes(selectedCurrency) ? selectedCurrency : (currencies[0] ?? 'UZS');

  const forcedView = useMemo<FinanceChartView | null>(() => {
    const hasIncome = filters.types.includes('income');
    const hasExpense = filters.types.includes('expense') || filters.types.includes('return');
    if (hasIncome && hasExpense) return 'both';
    if (hasIncome && !hasExpense) return 'income';
    if (!hasIncome && hasExpense) return 'expense';
    return null;
  }, [filters.types]);

  const monthTxs = useMemo(() => transactions.filter(transaction => (
    transaction.currency === activeCurrency && getTransactionKind(transaction) !== 'transfer'
  )), [activeCurrency, transactions]);
  const hasExpenseData = monthTxs.some(transaction => {
    const kind = getTransactionKind(transaction);
    return kind === 'expense' || kind === 'return';
  });
  const hasIncomeData = monthTxs.some(transaction => getTransactionKind(transaction) === 'income');
  const view: FinanceChartView = forcedView
    ?? (hasExpenseData && hasIncomeData
      ? (chartType === 'pie' ? 'expense' : 'both')
      : hasIncomeData ? 'income' : 'expense');
  const daysInMonth = new Date(viewDate.year, viewDate.month + 1, 0).getDate();

  const rawPieData = useMemo<FinancePieDatum[]>(() => {
    const relevant = monthTxs.filter(item => {
      const financialView = getTransactionKind(item) === 'return' ? 'expense' : item.type;
      return view === 'both' || financialView === view;
    });
    const grouped = new Map<string, { value: number; children?: Map<string, number> }>();
    relevant.forEach(item => {
      const isDebtPayment = item.source === 'debt_payment';
      const key = transactionCategoryId(item);
      const value = getTransactionKind(item) === 'return' ? -item.amount : item.amount;
      const current = grouped.get(key);
      const children = isDebtPayment ? new Map(current?.children) : undefined;
      if (children) {
        const debtName = item.sourceLabel?.trim() || t('charts.unnamed_debt');
        children.set(debtName, (children.get(debtName) ?? 0) + item.amount);
      }
      grouped.set(key, { value: (current?.value ?? 0) + value, children });
    });
    return Array.from(grouped.entries())
      .filter(([, group]) => group.value > 0)
      .sort((left, right) => right[1].value - left[1].value)
      .map(([categoryId, group], index) => {
        const category = categories.find(item => item.id === categoryId);
        const isDebtGroup = categoryId === '__debt_payments__';
        return {
          categoryId,
          value: group.value,
          name: isDebtGroup ? t('charts.debt_payments') : category?.name ?? categoryId,
          icon: isDebtGroup ? '💳' : category?.icon ?? '📦',
          color: isDebtGroup ? '#F97316' : category?.color ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length],
          children: group.children
            ? Array.from(group.children.entries()).sort((left, right) => right[1] - left[1]).map(([name, value]) => ({ id: name, name, value, icon: '💳' }))
            : undefined,
          childrenLabel: isDebtGroup ? t('charts.debt_breakdown_hint') : undefined,
        };
      });
  }, [categories, monthTxs, t, view]);

  const pieData = useMemo<FinancePieDatum[]>(() => {
    if (chartType !== 'pie' || rawPieData.length < 4) return rawPieData;
    const total = rawPieData.reduce((sum, item) => sum + item.value, 0);
    if (total <= 0) return rawPieData;

    const smallItems = rawPieData.filter(item => !item.children?.length && item.value / total < 0.02);
    if (smallItems.length < 2) return rawPieData;
    const smallIds = new Set(smallItems.map(item => item.categoryId));
    const other: FinancePieDatum = {
      categoryId: '__other__',
      name: t('charts.other'),
      icon: '•••',
      color: '#8E8E93',
      value: smallItems.reduce((sum, item) => sum + item.value, 0),
      childrenLabel: t('charts.other_hint'),
      children: smallItems.map(item => ({
        id: item.categoryId,
        name: item.name,
        value: item.value,
        icon: item.icon,
      })),
    };
    return [...rawPieData.filter(item => !smallIds.has(item.categoryId)), other]
      .sort((left, right) => right.value - left.value);
  }, [chartType, rawPieData, t]);

  const lineData = useMemo(() => {
    const days = Array.from({ length: daysInMonth }, (_, index) => ({ day: index + 1, income: 0, expense: 0 }));
    monthTxs.forEach(item => {
      const day = new Date(item.date).getDate() - 1;
      if (!days[day]) return;
      if (getTransactionKind(item) === 'return') days[day].expense -= item.amount;
      else days[day][item.type] += item.amount;
    });
    return days;
  }, [daysInMonth, monthTxs]);

  const content = (
      <div className={styles.wrap}>
        <div className={styles.chartContext}>
          <div className={styles.chartContextLabel}>
            <i className={view === 'income' ? styles.incomeDot : view === 'expense' ? styles.expenseDot : styles.bothDot}/>
            <strong>{t(`charts.tab_${view === 'expense' ? 'expenses' : view}`)}</strong>
          </div>
          {currencies.length > 1 && (
            <label className={styles.currencySelect}>
              <span>{t('common.currency')}</span>
              <select
                value={activeCurrency}
                onChange={event => {
                  setSelectedCurrency(event.target.value as Currency);
                  setSelectedCategoryId(null);
                }}
              >
                {currencies.map(currency => <option key={currency} value={currency}>{currency}</option>)}
              </select>
            </label>
          )}
        </div>

        <InteractiveFinanceChart
          type={chartType}
          view={view}
          currency={activeCurrency}
          pieData={pieData}
          lineData={lineData}
          monthShort={dayjs(new Date(viewDate.year, viewDate.month)).format('MMM')}
          selectedCategoryId={selectedCategoryId}
          onSelectCategory={setSelectedCategoryId}
          emptyLabel={t('charts.empty')}
          tourTarget={demoMode}
        />
      </div>
  );

  return demoMode ? content : <PremiumWall feature="charts">{content}</PremiumWall>;
};

export default ChartView;
