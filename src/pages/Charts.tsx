import { useState, useMemo } from 'react';
import { HiChevronLeft, HiChevronRight } from 'react-icons/hi2';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts';
import { useApp } from '../context';
import { useTransactions } from '../hooks/useTransactions';
import { useCategories } from '../hooks/useCategories';
import { useBudgets } from '../hooks/useBudgets';
import { useEntitlements } from '../hooks/useEntitlements';
import { usePremiumGate } from '../components/PremiumLock';
import { HiLockClosed } from 'react-icons/hi2';
import { formatAmount } from '../utils/format';
import dayjs from '../utils/dayjs';
import PageLoader from '../components/PageLoader';
import styles from './Charts.module.css';

type View = 'expense' | 'income' | 'both';
type ChartType = 'pie' | 'line';

const FALLBACK_COLORS = ['#7C3AED','#0A84FF','#30D158','#FF9F0A','#FF375F','#5AC8FA','#BF5AF2','#FFD60A','#636366','#FF453A'];

const Charts = () => {
  const { user } = useApp();
  const { transactions, loading: txLoading } = useTransactions(user?.uid ?? null);
  const { categories, loading: catLoading } = useCategories(user?.uid ?? null);
  const { budgets } = useBudgets(user?.uid ?? null);
  const { isPremium } = useEntitlements();
  const premiumGate = usePremiumGate();

  const now = new Date();
  const [viewDate, setViewDate] = useState({ month: now.getMonth(), year: now.getFullYear() });
  const [view, setView] = useState<View>('expense');
  // Free tier locked to line chart.
  const [chartType, setChartType] = useState<ChartType>(isPremium ? 'pie' : 'line');

  const prevMonth = () => setViewDate(d => {
    const m = d.month === 0 ? 11 : d.month - 1;
    const y = d.month === 0 ? d.year - 1 : d.year;
    return { month: m, year: y };
  });
  const nextMonth = () => setViewDate(d => {
    const m = d.month === 11 ? 0 : d.month + 1;
    const y = d.month === 11 ? d.year + 1 : d.year;
    return { month: m, year: y };
  });

  const monthLabel = dayjs(new Date(viewDate.year, viewDate.month)).format('MMMM YYYY');

  const monthTxs = useMemo(() => transactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === viewDate.month && d.getFullYear() === viewDate.year && t.currency === 'UZS';
  }), [transactions, viewDate]);

  // Totals
  const totalIncome  = useMemo(() => monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0), [monthTxs]);
  const totalExpense = useMemo(() => monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0), [monthTxs]);
  const incomeBudget  = budgets.find(b => b.categoryId === '__income__')?.amount ?? 0;
  const expenseBudget = budgets.filter(b => b.categoryId !== '__income__' && b.categoryId !== '__debts__').reduce((s, b) => s + b.amount, 0);
  const daysInMonth = new Date(viewDate.year, viewDate.month + 1, 0).getDate();
  const daysElapsed = viewDate.month === now.getMonth() && viewDate.year === now.getFullYear()
    ? now.getDate() : daysInMonth;

  // Pie data
  const pieData = useMemo(() => {
    const type = view === 'both' ? null : view;
    const relevant = monthTxs.filter(t => !type || t.type === type);
    const total = relevant.reduce((s, t) => s + t.amount, 0);
    const map: Record<string, number> = {};
    for (const t of relevant) {
      const key = t.source ? (t.sourceLabel ?? t.source) : t.categoryId;
      map[key] = (map[key] ?? 0) + t.amount;
    }
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([key, value]) => {
        const cat = categories.find(c => c.id === key);
        return {
          name: cat?.name ?? key,
          value,
          pct: total > 0 ? (value / total) * 100 : 0,
          color: cat?.color ?? FALLBACK_COLORS[0],
          icon: cat?.icon ?? '📦',
          categoryId: key,
        };
      });
  }, [monthTxs, view, categories]);

  // Line chart data — daily
  const lineData = useMemo(() => {
    const days: Record<number, { income: number; expense: number }> = {};
    for (let d = 1; d <= daysInMonth; d++) days[d] = { income: 0, expense: 0 };
    for (const t of monthTxs) {
      const day = new Date(t.date).getDate();
      if (t.type === 'income') days[day].income += t.amount;
      else days[day].expense += t.amount;
    }
    return Object.entries(days).map(([d, v]) => ({ day: Number(d), ...v }));
  }, [monthTxs, daysInMonth]);

  // Category list
  const catList = useMemo(() => {
    const type = view === 'both' ? null : view;
    return pieData.filter(p => {
      if (!type) return true;
      const cat = categories.find(c => c.id === p.categoryId);
      return !cat || cat.type === type || cat.type === 'both';
    });
  }, [pieData, view, categories]);

  const formatK = (v: number) => v >= 1_000_000 ? `${(v/1_000_000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : String(v);

  const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const formatDayTick = (day: number) => `${day} ${MONTH_SHORT[viewDate.month]}`;

  const RADIAN = Math.PI / 180;
  const renderLabel = ({ cx, cy, midAngle, outerRadius, pct }: {
    cx: number; cy: number; midAngle: number; outerRadius: number; pct: number; name: string;
  }) => {
    if (pct < 4) return null;
    const r = outerRadius + 20;
    const x = cx + r * Math.cos(-midAngle * RADIAN);
    const y = cy + r * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} fill="var(--text)" textAnchor={x > cx ? 'start' : 'end'} fontSize={10}>
        {`${pct.toFixed(1)}%`}
      </text>
    );
  };

  if (txLoading || catLoading) return <PageLoader />;

  return (
    <div className={styles.page}>
      {/* View tabs */}
      <div className={styles.viewTabs}>
        {(['expense', 'both', 'income'] as View[]).map(v => (
          <button
            key={v}
            className={`${styles.viewTab} ${view === v ? styles.viewActive : ''}`}
            onClick={() => setView(v)}
          >
            {v === 'expense' ? 'Expenses' : v === 'income' ? 'Income' : 'Both'}
          </button>
        ))}
      </div>

      {/* Month nav */}
      <div className={styles.monthNav}>
        <button onClick={prevMonth}><HiChevronLeft size={20} /></button>
        <span>{monthLabel}</span>
        <button onClick={nextMonth}><HiChevronRight size={20} /></button>
      </div>

      {/* Chart type toggle — premium only */}
      {isPremium && (
        <div className={styles.chartToggle}>
          <button
            className={`${styles.toggleBtn} ${chartType === 'pie' ? styles.toggleActive : ''}`}
            onClick={() => setChartType('pie')}
          >🥧</button>
          <button
            className={`${styles.toggleBtn} ${chartType === 'line' ? styles.toggleActive : ''}`}
            onClick={() => setChartType('line')}
          >📈</button>
        </div>
      )}

      {/* Chart — premium only; free users see a locked preview banner */}
      {!isPremium ? (
        <button
          type="button"
          onClick={() => premiumGate.open('charts')}
          style={{
            margin: '0 16px 16px',
            padding: 20,
            borderRadius: 16,
            background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.10), rgba(236, 72, 153, 0.06))',
            border: '1px solid rgba(124, 58, 237, 0.18)',
            color: 'var(--text)',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            cursor: 'pointer',
            width: 'calc(100% - 32px)',
            textAlign: 'left',
          }}
        >
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'linear-gradient(135deg, #7C3AED, #EC4899)',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <HiLockClosed size={20} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Charts are Premium</p>
            <p style={{ fontSize: 12, margin: '2px 0 0', color: 'var(--text2)' }}>Unlock pie and line charts. The breakdown below stays free.</p>
          </div>
        </button>
      ) : (
      <div className={styles.chartArea}>
        {chartType === 'pie' ? (
          pieData.length === 0 ? (
            <div className={styles.noData}>No data for this period</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  stroke={"transparent"}
                  innerRadius={65}
                  outerRadius={95}
                  paddingAngle={2}
                  dataKey="value"
                  labelLine={false}
                  label={renderLabel as never}
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v) => typeof v === 'number' ? formatAmount(v) : String(v)}
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }}
                  labelStyle={{ color: 'var(--text)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          )
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={lineData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--text3)' }} interval={4} tickFormatter={formatDayTick} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text3)' }} tickFormatter={formatK} width={40} />
              <Tooltip
                formatter={(v) => typeof v === 'number' ? formatAmount(v) : String(v)}
                labelFormatter={(day) => `${day} ${MONTH_SHORT[viewDate.month]}`}
                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {(view === 'income' || view === 'both') && (
                <Line type="monotone" dataKey="income" stroke="var(--income)" strokeWidth={2} dot={false} name="Income" />
              )}
              {(view === 'expense' || view === 'both') && (
                <Line type="monotone" dataKey="expense" stroke="var(--expense)" strokeWidth={2} dot={false} name="Expenses" />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
      )}

      {/* Summary bar */}
      <div className={styles.summary}>
        {view !== 'expense' && (
          <div className={styles.summaryItem}>
            <p className={styles.summaryLabel}>{incomeBudget > 0 ? 'Budget' : 'Income'}</p>
            <p className={styles.summaryIncome}>{formatAmount(incomeBudget > 0 && view !== 'both' ? incomeBudget : totalIncome)}</p>
            {incomeBudget > 0 && view !== 'both' && <p className={styles.summaryBudget}>{formatAmount(totalIncome)}</p>}
          </div>
        )}
        {view !== 'income' && (
          <div className={styles.summaryItem}>
            <p className={styles.summaryLabel}>{expenseBudget > 0 ? 'Budget' : 'Expenses'}</p>
            <p className={`${styles.summaryExpense} ${expenseBudget > 0 && totalExpense > expenseBudget ? styles.over : ''}`}>
              {formatAmount(expenseBudget > 0 && view !== 'both' ? expenseBudget : totalExpense)}
            </p>
            {expenseBudget > 0 && view !== 'both' && <p className={styles.summaryBudget}>{formatAmount(totalExpense)}</p>}
          </div>
        )}
        <div className={styles.summaryItem}>
          <p className={styles.summaryLabel}>
            {view === 'expense' ? '~ / day' : view === 'income' ? '~ / day' : 'Net'}
          </p>
          <p className={styles.summaryNeutral}>
            {view === 'both'
              ? formatAmount(Math.abs(totalIncome - totalExpense))
              : formatAmount(Math.round((view === 'income' ? totalIncome : totalExpense) / daysElapsed))}
          </p>
        </div>
      </div>

      {/* Category list — free for everyone */}
      <div className={styles.catSection}>
        <p className={styles.catSectionTitle}>
          {view === 'income' ? 'Income' : view === 'expense' ? 'Expenses' : 'All'} breakdown
        </p>
        <div className={styles.catScroll}>
          {catList.map((item, i) => {
            const budget = budgets.find(b => b.categoryId === item.categoryId);
            return (
              <div key={i} className={styles.catItem}>
                <div className={styles.catCircle} style={{ background: item.color + '33', border: `2px solid ${item.color}` }}>
                  <span className={styles.catEmoji}>{item.icon}</span>
                </div>
                <p className={styles.catName}>{item.name}</p>
                <p className={styles.catAmt}>{formatAmount(item.value)}</p>
                {budget && <p className={styles.catBudget}>{formatAmount(budget.amount)}</p>}
              </div>
            );
          })}
        </div>
      </div>
      {premiumGate.node}
    </div>
  );
};

export default Charts;
