import {useState, useMemo} from 'react';
import {
    PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
    LineChart, Line, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts';
import type {Transaction, Category, Budget} from '../types';
import {formatAmount} from '../utils/format';
import styles from './ChartView.module.css';
import type {ActiveFilters} from "../pages/Transactions.tsx";
import {FaChartPie} from "react-icons/fa";
import {LuChartLine} from "react-icons/lu";
import {useTranslation} from "react-i18next";
import {PremiumWall} from "./PremiumLock";

type ChartType = 'pie' | 'line';

const FALLBACK_COLORS = ['#7C3AED', '#0A84FF', '#30D158', '#FF9F0A', '#FF375F', '#5AC8FA', '#BF5AF2', '#FFD60A', '#636366', '#FF453A'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface Props {
    transactions: Transaction[];   // already filtered to the month
    categories: Category[];
    budgets: Budget[];
    viewDate: { month: number; year: number };
    filters: ActiveFilters;
}

const ChartView = ({transactions, categories, budgets, viewDate, filters}: Props) => {
    const now = new Date();
    const [chartType, setChartType] = useState<ChartType>('pie');
    const {t} = useTranslation();

    const monthTxs = useMemo(
        () => transactions.filter(t => t.currency === 'UZS' && t.source !== "transfer"),
        [transactions]
    );

    const totalIncome = useMemo(() => monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0), [monthTxs]);
    const totalExpense = useMemo(() => monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0), [monthTxs]);
    const incomeBudget = budgets.find(b => b.categoryId === '__income__')?.amount ?? 0;
    const expenseBudget = budgets.filter(b => b.categoryId !== '__income__' && b.categoryId !== '__debts__').reduce((s, b) => s + b.amount, 0);
    const daysInMonth = new Date(viewDate.year, viewDate.month + 1, 0).getDate();
    const daysElapsed = viewDate.month === now.getMonth() && viewDate.year === now.getFullYear()
        ? now.getDate() : daysInMonth;
    const view = useMemo(() => {
        if (filters.types) {
            const isIncome = filters.types.find(filter => filter === "income");
            const isExpense = filters.types.find(filter => filter === "expense");
            if (isIncome && !isExpense) return 'income';
            if (!isIncome && isExpense) return 'expense';
            if (isIncome && isExpense) return 'both';
        }
        return 'both';
    }, [filters])

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

    const lineData = useMemo(() => {
        const days: Record<number, { income: number; expense: number }> = {};
        for (let d = 1; d <= daysInMonth; d++) days[d] = {income: 0, expense: 0};
        for (const t of monthTxs) {
            const day = new Date(t.date).getDate();
            if (t.type === 'income') days[day].income += t.amount;
            else days[day].expense += t.amount;
        }
        return Object.entries(days).map(([d, v]) => ({day: Number(d), ...v}));
    }, [monthTxs, daysInMonth]);

    const catList = useMemo(() => {
        const type = view === 'both' ? null : view;
        return pieData.filter(p => {
            if (!type) return true;
            const cat = categories.find(c => c.id === p.categoryId);
            return !cat || cat.type === type || cat.type === 'both';
        });
    }, [pieData, view, categories]);

    const formatK = (v: number) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v);

    const RADIAN = Math.PI / 180;
    const renderLabel = ({cx, cy, midAngle, outerRadius, pct}: {
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

    return (
        <PremiumWall feature="charts">
            <div className={styles.wrap}>
                <div className={styles.viewTabs}>
                    <p className={styles.typeOfChartText}>{t('common.type_of_chart')}</p>
                    <div className={styles.chartToggle}>
                        <button className={`${styles.toggleBtn} ${chartType === 'pie' ? styles.toggleActive : ''}`}
                                onClick={() => setChartType('pie')}>{t("common.pie_chart")} <FaChartPie/></button>
                        <button className={`${styles.toggleBtn} ${chartType === 'line' ? styles.toggleActive : ''}`}
                                onClick={() => setChartType('line')}>{t("common.line_chart")} <LuChartLine/></button>
                    </div>
                </div>

                <div className={styles.chartArea}>
                    {chartType === 'pie' ? (
                        pieData.length === 0 ? (
                            <div className={styles.noData}>No data for this period</div>
                        ) : (
                            <ResponsiveContainer width="100%" height={220}>
                                <PieChart>
                                    <Pie data={pieData} cx="50%" cy="50%" stroke="transparent" innerRadius={60}
                                         outerRadius={88} paddingAngle={2} dataKey="value" labelLine={false}
                                         label={renderLabel as never}>
                                        {pieData.map((entry, i) => <Cell key={i} fill={entry.color}/>)}
                                    </Pie>
                                    <Tooltip formatter={(v) => typeof v === 'number' ? formatAmount(v) : String(v)}
                                             contentStyle={{
                                                 background: 'var(--surface)',
                                                 border: '1px solid var(--border)',
                                                 borderRadius: 10,
                                                 fontSize: 12
                                             }} labelStyle={{color: 'var(--text)'}}/>
                                </PieChart>
                            </ResponsiveContainer>
                        )
                    ) : (
                        <ResponsiveContainer width="100%" height={220}>
                            <LineChart data={lineData} margin={{top: 8, right: 16, left: 0, bottom: 0}}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
                                <XAxis dataKey="day" tick={{fontSize: 10, fill: 'var(--text3)'}} interval={4}
                                       tickFormatter={(d) => `${d} ${MONTH_SHORT[viewDate.month]}`}/>
                                <YAxis tick={{fontSize: 10, fill: 'var(--text3)'}} tickFormatter={formatK} width={40}/>
                                <Tooltip formatter={(v) => typeof v === 'number' ? formatAmount(v) : String(v)}
                                         labelFormatter={(d) => `${d} ${MONTH_SHORT[viewDate.month]}`} contentStyle={{
                                    background: 'var(--surface)',
                                    border: '1px solid var(--border)',
                                    borderRadius: 10,
                                    fontSize: 12
                                }}/>
                                <Legend wrapperStyle={{fontSize: 12}}/>
                                {(view === 'income' || view === 'both') &&
                                    <Line type="monotone" dataKey="income" stroke="var(--income)" strokeWidth={2}
                                          dot={false} name={t("common.income")}/>}
                                {(view === 'expense' || view === 'both') &&
                                    <Line type="monotone" dataKey="expense" stroke="var(--expense)" strokeWidth={2}
                                          dot={false} name={t("common.expenses")}/>}
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* Summary bar */}
                <div className={styles.summary}>
                    {view !== 'expense' && (
                        <div className={styles.summaryItem}>
                            <p className={styles.summaryLabel}>{incomeBudget > 0 ? t("common.budget") : t("common.income")}</p>
                            <p className={styles.summaryIncome}>{formatAmount(incomeBudget > 0 && view !== 'both' ? incomeBudget : totalIncome)}</p>
                            {incomeBudget > 0 && view !== 'both' &&
                                <p className={styles.summaryBudget}>{formatAmount(totalIncome)}</p>}
                        </div>
                    )}
                    {view !== 'income' && (
                        <div className={styles.summaryItem}>
                            <p className={styles.summaryLabel}>{expenseBudget > 0 ? t("common.budget") : t("common.expenses")}</p>
                            <p className={`${styles.summaryExpense} ${expenseBudget > 0 && totalExpense > expenseBudget ? styles.over : ''}`}>
                                {formatAmount(expenseBudget > 0 && view !== 'both' ? expenseBudget : totalExpense)}
                            </p>
                            {expenseBudget > 0 && view !== 'both' &&
                                <p className={styles.summaryBudget}>{formatAmount(totalExpense)}</p>}
                        </div>
                    )}
                    <div className={styles.summaryItem}>
                        <p className={styles.summaryLabel}>{view === 'both' ? t("common.net") : '~ / day'}</p>
                        <p className={styles.summaryNeutral}>
                            {view === 'both'
                                ? formatAmount(Math.abs(totalIncome - totalExpense))
                                : formatAmount(Math.round((view === 'income' ? totalIncome : totalExpense) / daysElapsed))}
                        </p>
                    </div>
                </div>

                {/* Category breakdown */}
                <div className={styles.catSection}>
                    <p className={styles.catSectionTitle}>{t('common.breakdown')}</p>
                    <div className={styles.catScroll}>
                        {catList.map((item, i) => {
                            const budget = budgets.find(b => b.categoryId === item.categoryId);
                            return (
                                <div key={i} className={styles.catItem}>
                                    <div className={styles.catCircle}
                                         style={{background: item.color + '33', border: `2px solid ${item.color}`}}>
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
                {/*{premiumGate.node}*/}
            </div>
        </PremiumWall>
    );
};

export default ChartView;
