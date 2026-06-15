import {useState, useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {HiChevronLeft, HiChevronRight, HiPlus, HiTrash, HiPencil, HiXMark} from 'react-icons/hi2';
import {useApp} from '../context';
import {useTransactions} from '../hooks/useTransactions';
import {useCategories} from '../hooks/useCategories';
import {usePlannedExpenses} from '../hooks/usePlannedExpenses';
import {useSubscriptions} from '../hooks/useSubscriptions';
import {useDebts} from '../hooks/useDebts';
import {useCards} from '../hooks/useCards';
import {useEntitlements} from '../hooks/useEntitlements';
import {DEFAULT_PLANNED_EXPENSE_VISIBILITY, useUserSettings} from '../hooks/useUserSettings';
import {usePremiumGate, PremiumWall} from '../components/PremiumLock';
import type {NewPlannedExpense} from '../hooks/usePlannedExpenses';
import PlannedExpenseModal from '../components/PlannedExpenseModal';
import {formatAmount, formatMoney} from '../utils/format';
import {plannedAppliesToDay} from '../utils/recurrence';
import dayjs from '../utils/dayjs';
import type {PlannedExpense, PlannedExpenseVisibility, Subscription, Debt, Transaction} from '../types';
import styles from './Calendar.module.css';
import i18n from "i18next";

// ── helpers ─────────────────────────────────────────────────────────────────

const appliesToDay = plannedAppliesToDay;

function getDaysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate();
}

function startOfDay(ts: number) {
    const d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
}

function endOfDay(ts: number) {
    const d = new Date(ts);
    d.setHours(23, 59, 59, 999);
    return d.getTime();
}

function getPlannedVisibilityRange(mode: PlannedExpenseVisibility) {
    if (mode === 'hidden') return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = today.getTime();
    const endDate = new Date(today);

    if (mode === '7d') {
        endDate.setDate(endDate.getDate() + 6);
    } else if (mode === '14d') {
        endDate.setDate(endDate.getDate() + 13);
    } else if (mode === 'this_month') {
        endDate.setMonth(endDate.getMonth() + 1, 0);
    } else {
        endDate.setMonth(endDate.getMonth() + 2, 0);
    }

    return { start, end: endOfDay(endDate.getTime()) };
}

function nextOccurrenceInRange(pe: PlannedExpense, range: { start: number; end: number } | null) {
    if (!range) return null;
    const cursor = new Date(range.start);
    cursor.setHours(0, 0, 0, 0);
    const end = new Date(range.end);
    end.setHours(0, 0, 0, 0);

    while (cursor.getTime() <= end.getTime()) {
        if (appliesToDay(pe, cursor)) return new Date(cursor);
        cursor.setDate(cursor.getDate() + 1);
    }
    return null;
}

function subscriptionOccursOn(sub: Subscription, year: number, month: number, day: number): boolean {
    if (!sub.isActive) return false;
    const target = new Date(year, month, day).getTime();
    const next = startOfDay(sub.nextBillingDate);
    if (target < next) return false;
    const nextDate = new Date(next);
    if (sub.cycle === 'weekly') {
        const diffDays = Math.round((target - next) / 86400000);
        return diffDays >= 0 && diffDays % 7 === 0;
    }
    if (sub.cycle === 'monthly') {
        return day === nextDate.getDate();
    }
    if (sub.cycle === 'yearly') {
        return month === nextDate.getMonth() && day === nextDate.getDate();
    }
    return false;
}

function getFirstDayOfWeek(year: number, month: number) {
    // 0=Sun→6, shift so Monday=0
    const d = new Date(year, month, 1).getDay();
    return (d + 6) % 7;
}

const DAY_HEADERS = {
    ru: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
    en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
};

const fmtDayDetail = (ts: number) => dayjs(ts).format('dddd, MMMM D');

// ── component ────────────────────────────────────────────────────────────────

const Calendar = () => {
    const {t} = useTranslation();
    const {user} = useApp();
    const {transactions} = useTransactions(user?.uid ?? null);
    const {categories} = useCategories(user?.uid ?? null);
    const {plannedExpenses, add, update, remove} = usePlannedExpenses(user?.uid ?? null);
    const { plannedExpenseVisibility } = useUserSettings(user?.uid ?? null);
    const {subscriptions} = useSubscriptions(user?.uid ?? null);
    const {debts} = useDebts(user?.uid ?? null);
    const {cards} = useCards(user?.uid ?? null);
    const {isPremium} = useEntitlements();
    const premiumGate = usePremiumGate();

    const requestAddPlanned = (pe?: PlannedExpense) => {
        if (!isPremium) { premiumGate.open('calendar'); return; }
        setEditingPe(pe ?? null);
        setShowModal(true);
    };

    const now = new Date();
    const [viewDate, setViewDate] = useState({month: now.getMonth(), year: now.getFullYear()});
    const [selectedDay, setSelectedDay] = useState<number | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [editingPe, setEditingPe] = useState<PlannedExpense | null>(null);
    const plannedVisibilityRange = useMemo(
        () => getPlannedVisibilityRange(plannedExpenseVisibility),
        [plannedExpenseVisibility]
    );

    const prevMonth = () => setViewDate(d => {
        const m = d.month === 0 ? 11 : d.month - 1;
        const y = d.month === 0 ? d.year - 1 : d.year;
        return {month: m, year: y};
    });

    const nextMonth = () => setViewDate(d => {
        const m = d.month === 11 ? 0 : d.month + 1;
        const y = d.month === 11 ? d.year + 1 : d.year;
        return {month: m, year: y};
    });

    const monthLabel = dayjs(new Date(viewDate.year, viewDate.month)).format('MMMM YYYY');

    // expenses per day (UZS, no transfers)
    const expensesByDay = useMemo(() => {
        const map: Record<number, number> = {};
        transactions
            .filter(t =>
                t.type === 'expense' &&
                t.currency === 'UZS' &&
                t.source !== 'transfer' &&
                new Date(t.date).getMonth() === viewDate.month &&
                new Date(t.date).getFullYear() === viewDate.year
            )
            .forEach(t => {
                const day = new Date(t.date).getDate();
                map[day] = (map[day] ?? 0) + t.amount;
            });
        return map;
    }, [transactions, viewDate]);

    const maxDayExpense = useMemo(() =>
            Math.max(0, ...Object.values(expensesByDay)),
        [expensesByDay]
    );

    // transactions grouped by day
    const txByDay = useMemo(() => {
        const map: Record<number, Transaction[]> = {};
        transactions
            .filter(t =>
                new Date(t.date).getMonth() === viewDate.month &&
                new Date(t.date).getFullYear() === viewDate.year
            )
            .forEach(t => {
                const day = new Date(t.date).getDate();
                if (!map[day]) map[day] = [];
                map[day].push(t);
            });
        return map;
    }, [transactions, viewDate]);

    // planned expenses per day
    const plannedByDay = useMemo(() => {
        const map: Record<number, PlannedExpense[]> = {};
        if (!plannedVisibilityRange) return map;
        const daysInMonth = getDaysInMonth(viewDate.year, viewDate.month);
        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(viewDate.year, viewDate.month, d);
            const ts = startOfDay(date.getTime());
            if (ts < plannedVisibilityRange.start || ts > plannedVisibilityRange.end) continue;
            const applies = plannedExpenses.filter(pe => appliesToDay(pe, date));
            if (applies.length > 0) map[d] = applies;
        }
        return map;
    }, [plannedExpenses, plannedVisibilityRange, viewDate]);

    // subscriptions per day
    const subsByDay = useMemo(() => {
        const map: Record<number, Subscription[]> = {};
        const daysInMonth = getDaysInMonth(viewDate.year, viewDate.month);
        for (let d = 1; d <= daysInMonth; d++) {
            const applies = subscriptions.filter(s => subscriptionOccursOn(s, viewDate.year, viewDate.month, d));
            if (applies.length > 0) map[d] = applies;
        }
        return map;
    }, [subscriptions, viewDate]);

    // debt due dates per day (only unpaid)
    const debtsByDay = useMemo(() => {
        const map: Record<number, Debt[]> = {};
        debts.forEach(debt => {
            if (debt.isPaid || !debt.dueDate) return;
            const due = new Date(debt.dueDate);
            if (due.getFullYear() !== viewDate.year || due.getMonth() !== viewDate.month) return;
            const day = due.getDate();
            if (!map[day]) map[day] = [];
            map[day].push(debt);
        });
        return map;
    }, [debts, viewDate]);

    const daysInMonth = getDaysInMonth(viewDate.year, viewDate.month);
    const firstDow = getFirstDayOfWeek(viewDate.year, viewDate.month); // 0=Mon

    // Projected balance trajectory (UZS only)
    const startingBalanceUZS = useMemo(() =>
            cards
                .filter(c => (c.cardType === 'debit' || c.cardType === 'cash') && c.includeInTotalBalance !== false && c.currency === 'UZS')
                .reduce((sum, c) => sum + c.balance, 0),
        [cards]
    );

    const projection = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const monthEndDate = new Date(viewDate.year, viewDate.month, daysInMonth);
        monthEndDate.setHours(0, 0, 0, 0);
        if (monthEndDate.getTime() < today.getTime()) return null;

        // Projection runs from today through end of viewing month, applying deltas day by day.
        const dayDelta = (date: Date): number => {
            let delta = 0;
            const y = date.getFullYear(), m = date.getMonth(), d = date.getDate();
            plannedExpenses.forEach(pe => {
                if (pe.currency !== 'UZS') return;
                if (!appliesToDay(pe, date)) return;
                delta += pe.kind === 'income' ? pe.amount : -pe.amount;
            });
            subscriptions.forEach(s => {
                if (s.currency !== 'UZS') return;
                if (subscriptionOccursOn(s, y, m, d)) delta -= s.amount;
            });
            debts.forEach(debt => {
                if (debt.currency !== 'UZS' || debt.isPaid || !debt.dueDate) return;
                const due = new Date(debt.dueDate);
                if (due.getFullYear() !== y || due.getMonth() !== m || due.getDate() !== d) return;
                const remaining = Math.max(0, debt.amount - (debt.paidAmount || 0));
                delta += debt.direction === 'i_owe' ? -remaining : remaining;
            });
            return delta;
        };

        // Walk forward from today to monthEnd to compute monthEnd balance + perDay balance for viewing month days.
        let balance = startingBalanceUZS;
        const cursor = new Date(today);
        const perDay: Record<number, number> = {}; // day-of-month → projected balance at end of that day
        while (cursor.getTime() <= monthEndDate.getTime()) {
            balance += dayDelta(cursor);
            if (cursor.getFullYear() === viewDate.year && cursor.getMonth() === viewDate.month) {
                perDay[cursor.getDate()] = balance;
            }
            cursor.setDate(cursor.getDate() + 1);
        }
        return {endOfMonth: balance, perDay};
    }, [startingBalanceUZS, plannedExpenses, subscriptions, debts, viewDate, daysInMonth]);

    const today = now.getDate();
    const isCurrentMonth = now.getMonth() === viewDate.month && now.getFullYear() === viewDate.year;

    // selected day detail
    const selectedTxs = selectedDay !== null ? (txByDay[selectedDay] ?? []) : [];
    const selectedPlannedAll = selectedDay !== null ? (plannedByDay[selectedDay] ?? []) : [];
    const selectedPlanned = selectedPlannedAll.filter(p => (p.kind ?? 'expense') === 'expense');
    const selectedPlannedIncome = selectedPlannedAll.filter(p => p.kind === 'income');
    const selectedSubs = selectedDay !== null ? (subsByDay[selectedDay] ?? []) : [];
    const selectedDebts = selectedDay !== null ? (debtsByDay[selectedDay] ?? []) : [];
    const selectedDate = selectedDay !== null
        ? new Date(viewDate.year, viewDate.month, selectedDay)
        : null;

    const getCategory = (id: string) => categories.find(c => c.id === id);

    const visiblePlannedExpenses = useMemo(() => {
        if (!plannedVisibilityRange) return [];
        return plannedExpenses
            .map(pe => ({ pe, next: nextOccurrenceInRange(pe, plannedVisibilityRange) }))
            .filter((item): item is { pe: PlannedExpense; next: Date } => item.next !== null)
            .sort((a, b) => a.next.getTime() - b.next.getTime())
            .map(item => item.pe);
    }, [plannedExpenses, plannedVisibilityRange]);

    const handleSave = async (data: NewPlannedExpense) => {
        if (editingPe) {
            await update(editingPe.id, data);
        } else {
            await add(data);
        }
    };

    return (
        <PremiumWall feature="calendar">
        <div className={styles.page}>
            {/* Header */}
            <div className={styles.header}>
                <div className={styles.monthNav}>
                    <button onClick={prevMonth}><HiChevronLeft size={20}/></button>
                    <span>{monthLabel}</span>
                    <button onClick={nextMonth}><HiChevronRight size={20}/></button>
                </div>
                <button className={styles.addBtn} onClick={() => requestAddPlanned()}>
                    <HiPlus size={16}/>
                    {t('calendar.add_planned')}
                </button>
            </div>

            {/* Day-of-week headers */}
            <div className={styles.grid}>
                {DAY_HEADERS[i18n.language as keyof typeof DAY_HEADERS].map((d, i) => (
                    <div key={i} className={styles.dayHeader}>{d}</div>))
                }

                {/* Empty cells before first day */}
                {Array.from({length: firstDow}).map((_, i) => (
                    <div key={`e${i}`} className={styles.empty}/>
                ))}

                {/* Day cells */}
                {Array.from({length: daysInMonth}, (_, i) => i + 1).map(day => {
                    const expense = expensesByDay[day] ?? 0;
                    // sqrt scale so mid-range days are clearly visible even when one day dominates
                    const rawRatio = maxDayExpense > 0 ? expense / maxDayExpense : 0;
                    const intensity = rawRatio > 0 ? Math.sqrt(rawRatio) : 0;
                    const planned = plannedByDay[day] ?? [];
                    const plannedExp = planned.filter(p => (p.kind ?? 'expense') === 'expense');
                    const plannedInc = planned.filter(p => p.kind === 'income');
                    const subs = subsByDay[day] ?? [];
                    const dueDebts = debtsByDay[day] ?? [];
                    const isToday = isCurrentMonth && day === today;
                    const isSelected = selectedDay === day;
                    const markers: Array<'planned' | 'income' | 'sub' | 'debt'> = [
                        ...plannedExp.map(() => 'planned' as const),
                        ...plannedInc.map(() => 'income' as const),
                        ...subs.map(() => 'sub' as const),
                        ...dueDebts.map(() => 'debt' as const),
                    ];

                    const bgAlpha = intensity > 0 ? 0.1 + intensity * 0.72 : 0;
                    const bgStyle = bgAlpha > 0
                        ? {background: `rgba(255, 69, 58, ${bgAlpha.toFixed(2)})`}
                        : undefined;

                    return (
                        <button
                            key={day}
                            className={`${styles.day} ${isToday ? styles.today : ''} ${isSelected ? styles.selected : ''}`}
                            style={bgStyle}
                            onClick={() => setSelectedDay(prev => prev === day ? null : day)}
                        >
                            <span className={styles.dayNum}>{day}</span>
                            {markers.length > 0 && (
                                <div className={styles.dots}>
                                    {markers.slice(0, 3).map((kind, i) => (
                                        <span key={i}
                                              className={`${styles.dot} ${kind === 'sub' ? styles.dotSub : kind === 'debt' ? styles.dotDebt : kind === 'income' ? styles.dotIncome : ''}`}/>
                                    ))}
                                    {markers.length > 3 &&
                                        <span className={styles.dotMore}>+{markers.length - 3}</span>}
                                </div>
                            )}
                            {expense > 0 && (
                                <span className={styles.dayAmt}>{formatMoney(expense)}</span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Day detail panel */}
            {selectedDay !== null && (
                <div className={styles.detail}>
                    <div className={styles.detailHeader}>
                        <span>{selectedDate ? fmtDayDetail(selectedDate.getTime()) : ''}</span>
                        <button className={styles.closeDetail} onClick={() => setSelectedDay(null)}>
                            <HiXMark size={18}/>
                        </button>
                    </div>

                    {projection && selectedDay !== null && projection.perDay[selectedDay] !== undefined && (
                        <div className={styles.dayBalance}>
                            <span className={styles.forecastLabel}>{t('calendar.projected_balance')}</span>
                            <span
                                className={`${styles.forecastVal} ${projection.perDay[selectedDay] < 0 ? styles.exp : ''}`}>
                {formatAmount(projection.perDay[selectedDay], 'UZS')}
              </span>
                        </div>
                    )}

                    {selectedDebts.length > 0 && (
                        <div className={styles.section}>
                            <p className={styles.sectionLabel}>{t('calendar.debts_due_title')}</p>
                            {selectedDebts.map(debt => {
                                const remaining = Math.max(0, debt.amount - (debt.paidAmount || 0));
                                return (
                                    <div key={debt.id} className={styles.peRow}>
                                        <span className={styles.peIcon}>{debt.direction === 'i_owe' ? '💸' : '🤝'}</span>
                                        <div className={styles.peMid}>
                                            <p className={styles.peName}>
                                                {t(debt.direction === 'i_owe' ? 'calendar.debt_due_i_owe' : 'calendar.debt_due_owe_me', {person: debt.person})}
                                            </p>
                                            <p className={styles.peAmt}>{formatAmount(remaining, debt.currency)}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {selectedSubs.length > 0 && (
                        <div className={styles.section}>
                            <p className={styles.sectionLabel}>{t('calendar.subs_title')}</p>
                            {selectedSubs.map(sub => (
                                <div key={sub.id} className={styles.peRow}>
                                    <span className={styles.peIcon}>{sub.icon}</span>
                                    <div className={styles.peMid}>
                                        <p className={styles.peName}>{sub.name}</p>
                                        <p className={styles.peAmt}>{formatAmount(sub.amount, sub.currency)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {selectedPlannedIncome.length > 0 && (
                        <div className={styles.section}>
                            <p className={styles.sectionLabel}>{t('calendar.planned_income_title')}</p>
                            {selectedPlannedIncome.map(pe => (
                                <div key={pe.id} className={styles.peRow}>
                                    <span className={styles.peIcon}>{pe.icon}</span>
                                    <div className={styles.peMid}>
                                        <p className={styles.peName}>{pe.name}</p>
                                        <p className={`${styles.peAmt} ${styles.inc}`}>+{formatAmount(pe.amount, pe.currency)}</p>
                                    </div>
                                    <div className={styles.peActions}>
                                        <button onClick={() => {
                                            setEditingPe(pe);
                                            setShowModal(true);
                                        }}>
                                            <HiPencil size={14}/>
                                        </button>
                                        <button onClick={() => remove(pe.id)}>
                                            <HiTrash size={14}/>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {selectedPlanned.length > 0 && (
                        <div className={styles.section}>
                            <p className={styles.sectionLabel}>{t('calendar.planned_title')}</p>
                            {selectedPlanned.map(pe => (
                                <div key={pe.id} className={styles.peRow}>
                                    <span className={styles.peIcon}>{pe.icon}</span>
                                    <div className={styles.peMid}>
                                        <p className={styles.peName}>{pe.name}</p>
                                        <p className={styles.peAmt}>{formatAmount(pe.amount, pe.currency)}</p>
                                    </div>
                                    <div className={styles.peActions}>
                                        <button onClick={() => {
                                            setEditingPe(pe);
                                            setShowModal(true);
                                        }}>
                                            <HiPencil size={14}/>
                                        </button>
                                        <button onClick={() => remove(pe.id)}>
                                            <HiTrash size={14}/>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {selectedTxs.length > 0 && (
                        <div className={styles.section}>
                            <p className={styles.sectionLabel}>{t('calendar.transactions')}</p>
                            {selectedTxs.map(tx => {
                                const cat = getCategory(tx.categoryId);
                                const isTransfer = tx.source === 'transfer';
                                const icon = isTransfer ? '🔄' : tx.source === 'debt_payment' ? '💳' : tx.source === 'savings' ? '🐷' : cat?.icon ?? '📦';
                                const name = tx.sourceLabel ?? cat?.name ?? 'Unknown';
                                return (
                                    <div key={tx.id} className={styles.txRow}>
                                        <span className={styles.txIcon}>{icon}</span>
                                        <p className={styles.txName}>{name}</p>
                                        <p className={`${styles.txAmt} ${isTransfer ? styles.neutral : tx.type === 'income' ? styles.inc : styles.exp}`}>
                                            {isTransfer ? '' : tx.type === 'income' ? '+' : '−'}{formatAmount(tx.amount, tx.currency)}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {selectedPlanned.length === 0 && selectedPlannedIncome.length === 0 && selectedTxs.length === 0 && selectedSubs.length === 0 && selectedDebts.length === 0 && (
                        <p className={styles.emptyDetail}>{t('calendar.no_events')}</p>
                    )}
                </div>
            )}

            {/* Projected balance summary */}
            {projection && (
                <div className={styles.forecast}>
                    <div className={styles.forecastRow}>
                        <span className={styles.forecastLabel}>{t('calendar.current_balance')}</span>
                        <span className={styles.forecastVal}>{formatAmount(startingBalanceUZS, 'UZS')}</span>
                    </div>
                    <div className={styles.forecastRow}>
                        <span className={styles.forecastLabel}>{t('calendar.projected_eom')}</span>
                        <span
                            className={`${styles.forecastVal} ${projection.endOfMonth < 0 ? styles.exp : projection.endOfMonth >= startingBalanceUZS ? styles.inc : ''}`}>
              {formatAmount(projection.endOfMonth, 'UZS')}
            </span>
                    </div>
                    <div className={styles.forecastRow}>
                        <span className={styles.forecastLabel}>{t('calendar.net_change')}</span>
                        <span
                            className={`${styles.forecastVal} ${projection.endOfMonth - startingBalanceUZS < 0 ? styles.exp : styles.inc}`}>
              {projection.endOfMonth - startingBalanceUZS >= 0 ? '+' : '−'}{formatAmount(Math.abs(projection.endOfMonth - startingBalanceUZS), 'UZS')}
            </span>
                    </div>
                </div>
            )}

            {/* Planned expenses list */}
            {visiblePlannedExpenses.length > 0 && (
                <div className={styles.plannedList}>
                    <p className={styles.plannedListTitle}>
                        {t('calendar.planned_title')}
                        {plannedExpenseVisibility !== DEFAULT_PLANNED_EXPENSE_VISIBILITY && (
                            <span className={styles.plannedListRange}> · {t(`settings.planned_visibility_${plannedExpenseVisibility}`)}</span>
                        )}
                    </p>
                    {visiblePlannedExpenses.map(pe => (
                        <div key={pe.id} className={styles.peListRow}>
                            <span className={styles.peIcon}>{pe.icon}</span>
                            <div className={styles.peMid}>
                                <p className={styles.peName}>{pe.name}</p>
                                <p className={styles.peRecurrence}>
                                    {pe.recurrence === 'monthly' ? `${t('calendar.monthly')} · ${t('calendar.day_of_month')} ${pe.dayOfMonth}` :
                                        pe.recurrence === 'weekly' ? `${t('calendar.weekly')} · ${(pe.dayOfWeek ?? []).map(d => ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][d]).join(', ')}` :
                                            pe.recurrence === 'weekends' ? t('calendar.weekends') :
                                                pe.recurrence === 'weekdays' ? t('calendar.weekdays') :
                                                    pe.recurrence === 'daily' ? t('calendar.daily') :
                                                        pe.recurrence === 'yearly' ? t('calendar.yearly') :
                                                            pe.recurrence === 'custom' ? `${t('calendar.custom_every')} ${pe.customInterval ?? 1} ${t('calendar.custom_unit_' + (pe.customUnit ?? 'day'))}` :
                                                                t('calendar.once')}
                                </p>
                            </div>
                            <div className={styles.peMeta}>
                                <p className={`${styles.peAmt} ${pe.kind === 'income' ? styles.inc : ''}`}>
                                    {pe.kind === 'income' ? '+' : ''}{formatAmount(pe.amount, pe.currency)}
                                </p>
                                <div className={styles.peActions}>
                                    <button onClick={() => {
                                        setEditingPe(pe);
                                        setShowModal(true);
                                    }}>
                                        <HiPencil size={14}/>
                                    </button>
                                    <button onClick={() => remove(pe.id)}>
                                        <HiTrash size={14}/>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {plannedExpenses.length === 0 && selectedDay === null && (
                <div className={styles.emptyState}>
                    <p>📅</p>
                    <p>{t('calendar.no_planned')}</p>
                    <button className={styles.emptyAddBtn} onClick={() => requestAddPlanned()}>
                        <HiPlus size={14}/> {t('calendar.add_planned')}
                    </button>
                </div>
            )}

            {showModal && (
                <PlannedExpenseModal
                    initial={editingPe ?? undefined}
                    onSave={handleSave}
                    onClose={() => {
                        setShowModal(false);
                        setEditingPe(null);
                    }}
                />
            )}
            {premiumGate.node}
        </div>
        </PremiumWall>
    );
};

export default Calendar;
