import { useMemo, useState } from 'react';
import {
  HiChartPie,
  HiChevronLeft,
  HiChevronRight,
  HiLockClosed,
  HiPresentationChartLine,
} from 'react-icons/hi2';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context';
import { useTransactions } from '../hooks/useTransactions';
import { useCategories } from '../hooks/useCategories';
import { useBudgets } from '../hooks/useBudgets';
import { useEntitlements } from '../hooks/useEntitlements';
import { usePremiumGate } from '../components/PremiumLock';
import InteractiveFinanceChart, {
  type FinanceChartType,
  type FinanceChartView,
} from '../components/InteractiveFinanceChart';
import PageLoader from '../components/PageLoader';
import type { Currency } from '../types';
import { formatAmount } from '../utils/format';
import dayjs from '../utils/dayjs';
import styles from './Charts.module.css';

const FALLBACK_COLORS = ['#7C3AED', '#0A84FF', '#30D158', '#FF9F0A', '#FF375F', '#5AC8FA', '#BF5AF2', '#FFD60A'];

const Charts = () => {
  const { t } = useTranslation();
  const { user } = useApp();
  const { transactions, loading: txLoading } = useTransactions(user?.uid ?? null);
  const { categories, loading: catLoading } = useCategories(user?.uid ?? null);
  const { budgets } = useBudgets(user?.uid ?? null);
  const { isPremium } = useEntitlements();
  const premiumGate = usePremiumGate();
  const now = new Date();
  const [viewDate, setViewDate] = useState({ month: now.getMonth(), year: now.getFullYear() });
  const [view, setView] = useState<FinanceChartView>('expense');
  const [chartType, setChartType] = useState<FinanceChartType>('pie');
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>('UZS');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  const currencies = useMemo(() => Array.from(new Set(transactions.map(item => item.currency))).sort((a, b) => (
    a === 'UZS' ? -1 : b === 'UZS' ? 1 : a.localeCompare(b)
  )), [transactions]);
  const activeCurrency = currencies.includes(selectedCurrency) ? selectedCurrency : (currencies[0] ?? 'UZS');
  const monthLabel = dayjs(new Date(viewDate.year, viewDate.month)).format('MMMM YYYY');
  const monthShort = dayjs(new Date(viewDate.year, viewDate.month)).format('MMM');
  const daysInMonth = new Date(viewDate.year, viewDate.month + 1, 0).getDate();
  const daysElapsed = viewDate.month === now.getMonth() && viewDate.year === now.getFullYear() ? now.getDate() : daysInMonth;

  const monthTxs = useMemo(() => transactions.filter(transaction => {
    const date = new Date(transaction.date);
    return date.getMonth() === viewDate.month
      && date.getFullYear() === viewDate.year
      && transaction.currency === activeCurrency
      && transaction.source !== 'transfer';
  }), [activeCurrency, transactions, viewDate]);

  const totalIncome = monthTxs.filter(item => item.type === 'income').reduce((sum, item) => sum + item.amount, 0);
  const totalExpense = monthTxs.filter(item => item.type === 'expense').reduce((sum, item) => sum + item.amount, 0);
  const currencyBudgets = budgets.filter(budget => budget.currency === activeCurrency);
  const incomeBudget = currencyBudgets.find(budget => budget.categoryId === '__income__')?.amount ?? 0;
  const expenseBudget = currencyBudgets
    .filter(budget => budget.categoryId !== '__income__' && budget.categoryId !== '__debts__')
    .reduce((sum, budget) => sum + budget.amount, 0);

  const pieData = useMemo(() => {
    const relevant = monthTxs.filter(item => view === 'both' || item.type === view);
    const grouped = new Map<string, { value: number; children?: Map<string, number> }>();
    relevant.forEach(item => {
      const isDebtPayment = item.source === 'debt_payment';
      const key = isDebtPayment ? '__debt_payments__' : item.source ? (item.sourceLabel ?? item.source) : item.categoryId;
      const current = grouped.get(key);
      const children = isDebtPayment ? new Map(current?.children) : undefined;
      if (children) {
        const debtName = item.sourceLabel?.trim() || t('charts.unnamed_debt');
        children.set(debtName, (children.get(debtName) ?? 0) + item.amount);
      }
      grouped.set(key, { value: (current?.value ?? 0) + item.amount, children });
    });
    return Array.from(grouped.entries())
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
        };
      });
  }, [categories, monthTxs, t, view]);

  const lineData = useMemo(() => {
    const days = Array.from({ length: daysInMonth }, (_, index) => ({ day: index + 1, income: 0, expense: 0 }));
    monthTxs.forEach(item => {
      const day = new Date(item.date).getDate() - 1;
      if (days[day]) days[day][item.type] += item.amount;
    });
    return days;
  }, [daysInMonth, monthTxs]);

  const changeMonth = (direction: -1 | 1) => {
    setViewDate(current => {
      const date = new Date(current.year, current.month + direction, 1);
      return { month: date.getMonth(), year: date.getFullYear() };
    });
    setSelectedCategoryId(null);
  };

  if (txLoading || catLoading) return <PageLoader />;

  return (
    <div className={styles.page}>
      <div className={styles.filtersCard}>
        <div className={styles.viewTabs}>
          {(['expense', 'both', 'income'] as FinanceChartView[]).map(item => (
            <button
              type="button"
              key={item}
              className={view === item ? styles.viewActive : ''}
              onClick={() => {
                setView(item);
                setSelectedCategoryId(null);
              }}
            >{t(`charts.tab_${item === 'expense' ? 'expenses' : item}`)}</button>
          ))}
        </div>

        <div className={styles.monthNav}>
          <button type="button" onClick={() => changeMonth(-1)}><HiChevronLeft size={19} /></button>
          <strong>{monthLabel}</strong>
          <button type="button" onClick={() => changeMonth(1)}><HiChevronRight size={19} /></button>
        </div>

        {currencies.length > 1 && (
          <div className={styles.currencyTabs}>
            {currencies.map(currency => (
              <button
                type="button"
                key={currency}
                className={activeCurrency === currency ? styles.currencyActive : ''}
                onClick={() => {
                  setSelectedCurrency(currency);
                  setSelectedCategoryId(null);
                }}
              >{currency}</button>
            ))}
          </div>
        )}

        {isPremium && (
          <div className={styles.chartToggle}>
            <button className={chartType === 'pie' ? styles.chartActive : ''} onClick={() => setChartType('pie')}>
              <HiChartPie size={16} /> {t('common.pie_chart')}
            </button>
            <button className={chartType === 'line' ? styles.chartActive : ''} onClick={() => setChartType('line')}>
              <HiPresentationChartLine size={17} /> {t('common.line_chart')}
            </button>
          </div>
        )}
      </div>

      {!isPremium ? (
        <button type="button" className={styles.premiumCard} onClick={() => premiumGate.open('charts')}>
          <span><HiLockClosed size={20} /></span>
          <div><strong>{t('charts.premium_title')}</strong><p>{t('charts.premium_description')}</p></div>
          <HiChevronRight size={18} />
        </button>
      ) : (
        <InteractiveFinanceChart
          type={chartType}
          view={view}
          currency={activeCurrency}
          pieData={pieData}
          lineData={lineData}
          monthShort={monthShort}
          selectedCategoryId={selectedCategoryId}
          onSelectCategory={setSelectedCategoryId}
          emptyLabel={t('charts.empty')}
        />
      )}

      <section className={styles.summarySection}>
        <h2>{t('charts.period_summary')}</h2>
        <div className={styles.summary}>
        {view !== 'expense' && (
          <div><p>{incomeBudget > 0 ? t('charts.label_budget') : t('charts.label_income')}</p><strong className={styles.income}>{formatAmount(view !== 'both' && incomeBudget > 0 ? incomeBudget : totalIncome, activeCurrency)}</strong></div>
        )}
        {view !== 'income' && (
          <div><p>{expenseBudget > 0 ? t('charts.label_budget') : t('charts.label_expenses')}</p><strong className={styles.expense}>{formatAmount(view !== 'both' && expenseBudget > 0 ? expenseBudget : totalExpense, activeCurrency)}</strong></div>
        )}
        <div><p>{view === 'both' ? t('charts.label_net') : t('charts.label_rate')}</p><strong>{formatAmount(view === 'both' ? Math.abs(totalIncome - totalExpense) : Math.round((view === 'income' ? totalIncome : totalExpense) / Math.max(1, daysElapsed)), activeCurrency)}</strong></div>
        </div>
      </section>

      {!isPremium && pieData.length > 0 && (
        <div className={styles.freeBreakdown}>
          <h3>{t(`charts.breakdown_${view === 'expense' ? 'expenses' : view === 'income' ? 'income' : 'all'}`)}</h3>
          {pieData.map(item => (
            <div key={item.categoryId}>
              <span style={{ background: item.color }}>{item.icon}</span>
              <p>{item.name}</p>
              <strong>{formatAmount(item.value, activeCurrency)}</strong>
            </div>
          ))}
        </div>
      )}
      {premiumGate.node}
    </div>
  );
};

export default Charts;
