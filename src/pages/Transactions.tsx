import {useState, useMemo, useEffect} from 'react';
import {
    HiTrash,
    HiPencil,
    HiChevronLeft,
    HiChevronRight,
    HiChartPie,
    HiQueueList,
    HiArrowUturnLeft,
    HiAdjustmentsHorizontal,
    HiXMark
} from 'react-icons/hi2';
import {useApp} from '../context';
import {useTransactions} from '../hooks/useTransactions';
import {useCategories} from '../hooks/useCategories';
import {useCards} from '../hooks/useCards';
import {useBudgets} from '../hooks/useBudgets';
import {useEntitlements} from '../hooks/useEntitlements';
import {usePremiumGate, PremiumBadge} from '../components/PremiumLock';
import {formatAmount, formatDate, formatTime, formatMonth} from '../utils/format';
import dayjs from '../utils/dayjs';
import AddTransactionModal from '../components/AddTransactionModal';
import ReturnModal from '../components/ReturnModal';
import ChartView from '../components/ChartView';
import PageLoader from '../components/PageLoader';
import type {Currency, Transaction} from '../types';
import {BASE_CURRENCY} from '../utils/nbuRates';
import type {NewTransaction} from '../hooks/useTransactions';
import styles from './Transactions.module.css';
import {useTranslation} from 'react-i18next';
import {Input} from "../components/FormField.tsx";

export interface ActiveFilters {
    types: ('income' | 'expense' | 'transfer')[];
    categoryIds: string[];
    subcategoryIds: string[];
    cardIds: string[];
    dateFrom: string | null;
    dateTo: string | null;
}

const defaultFilters: ActiveFilters = {
    types: [],
    categoryIds: [],
    subcategoryIds: [],
    cardIds: [],
    dateFrom: null,
    dateTo: null,
};

const Transactions = () => {
    const {user, categoryFilter, setCategoryFilter} = useApp();
    const {transactions, add, update, remove, returnTransaction, loading: txLoading} = useTransactions(user?.uid ?? null);
    const {categories, subcategories, loading: catLoading} = useCategories(user?.uid ?? null);
    const {cards, cardOrder, saveCardOrder} = useCards(user?.uid ?? null);
    const {budgets} = useBudgets(user?.uid ?? null);
    const {isPremium} = useEntitlements();
    const premiumGate = usePremiumGate();
    const [filters, setFilters] = useState<ActiveFilters>(defaultFilters);
    const [showFilterPanel, setShowFilterPanel] = useState(false);
    const [showAdd, setShowAdd] = useState(false);
    const [editingTx, setEditingTx] = useState<Transaction | null>(null);
    const [returnTx, setReturnTx] = useState<Transaction | null>(null);
    const [showReturn, setShowReturn] = useState(false);
    const [viewMode, setViewMode] = useState<'list' | 'chart'>('list');
    const [summaryMode, setSummaryMode] = useState<'total' | 'byCurrency'>(() => {
        const stored = localStorage.getItem('txSummaryMode');
        return stored === 'byCurrency' ? 'byCurrency' : 'total';
    });
    useEffect(() => { localStorage.setItem('txSummaryMode', summaryMode); }, [summaryMode]);
    const now = new Date();
    const [viewDate, setViewDate] = useState({month: now.getMonth(), year: now.getFullYear()});
    const {t, i18n} = useTranslation();
    const locale = i18n.language === 'ru' ? 'ru-RU' : 'en-US';

    useEffect(() => {
        if (categoryFilter) {
            setFilters(f => ({...f, categoryIds: [categoryFilter]}));
            setCategoryFilter(null);
        }
    }, [categoryFilter, setCategoryFilter]);

    const monthLabel = formatMonth(new Date(viewDate.year, viewDate.month), locale);

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

    const filteredTxs = useMemo(() => {
        return transactions.filter(t => {
            const d = new Date(t.date);

            if (filters.dateFrom || filters.dateTo) {
                if (filters.dateFrom && d < new Date(filters.dateFrom + 'T00:00:00')) return false;
                if (filters.dateTo && d > new Date(filters.dateTo + 'T23:59:59')) return false;
            } else {
                if (d.getMonth() !== viewDate.month || d.getFullYear() !== viewDate.year) return false;
            }

            if (filters.types.length > 0) {
                const txKind = t.source === 'transfer' ? 'transfer' : t.type;
                if (!filters.types.includes(txKind as 'income' | 'expense' | 'transfer')) return false;
            }

            const catActive = filters.categoryIds.length > 0 || filters.subcategoryIds.length > 0;
            if (catActive) {
                const matchesDebts = filters.categoryIds.includes('__debts__') && t.source === 'debt_payment';
                const matchesCat = filters.categoryIds.includes(t.categoryId);
                const matchesSub = t.subcategoryId != null && filters.subcategoryIds.includes(t.subcategoryId);
                if (!matchesDebts && !matchesCat && !matchesSub) return false;
            }

            if (filters.cardIds.length > 0) {
                if (!t.cardId || !filters.cardIds.includes(t.cardId)) return false;
            }

            return true;
        });
    }, [transactions, filters, viewDate]);

    const grouped = useMemo(() => {
        const todayStr = t('common.today_label');
        const yesterdayStr = t('common.yesterday_label');
        const map = new Map<string, Transaction[]>();
        for (const tx of filteredTxs) {
            const key = formatDate(tx.date, locale, todayStr, yesterdayStr);
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(tx);
        }
        return Array.from(map.entries());
    }, [filteredTxs, locale, t]);

    const summaryTotals = useMemo(() => {
        let income = 0;
        let expense = 0;
        let hasUnconverted = false;
        for (const tx of filteredTxs) {
            if (tx.source === 'transfer') continue;
            let valueInBase: number | null = null;
            if (tx.currency === BASE_CURRENCY) valueInBase = tx.amount;
            else if (typeof tx.baseAmount === 'number') valueInBase = tx.baseAmount;
            else { hasUnconverted = true; continue; }
            if (tx.type === 'income') income += valueInBase;
            else if (tx.type === 'expense') expense += valueInBase;
        }
        return {income, expense, hasUnconverted};
    }, [filteredTxs]);

    const summaryByCurrency = useMemo(() => {
        const byCcy: Record<string, { income: number; expense: number }> = {};
        for (const tx of filteredTxs) {
            if (tx.source === 'transfer') continue;
            const c = tx.currency;
            if (!byCcy[c]) byCcy[c] = { income: 0, expense: 0 };
            if (tx.type === 'income') byCcy[c].income += tx.amount;
            else if (tx.type === 'expense') byCcy[c].expense += tx.amount;
        }
        return byCcy;
    }, [filteredTxs]);

    const usedCurrencies = useMemo(
        () => (Object.keys(summaryByCurrency) as Currency[])
            .sort((a, b) => (a === BASE_CURRENCY ? -1 : b === BASE_CURRENCY ? 1 : a.localeCompare(b))),
        [summaryByCurrency],
    );

    const monthCategoryIds = useMemo(() => {
        const monthTxs = transactions.filter(t => {
            const d = new Date(t.date);
            return d.getMonth() === viewDate.month && d.getFullYear() === viewDate.year;
        });
        return new Set(monthTxs.map(t => t.categoryId));
    }, [transactions, viewDate]);

    const hasDebtTxsThisMonth = useMemo(() => transactions.some(t => {
        const d = new Date(t.date);
        return t.source === 'debt_payment' && d.getMonth() === viewDate.month && d.getFullYear() === viewDate.year;
    }), [transactions, viewDate]);

    const hasAnyFilter = filters.types.length > 0 || filters.categoryIds.length > 0 || filters.subcategoryIds.length > 0 || filters.cardIds.length > 0 || !!filters.dateFrom || !!filters.dateTo;

    const getCategory = (id: string) => categories.find(c => c.id === id);

    if (txLoading || catLoading) return <PageLoader/>;

    const incomeBudget = budgets.find(b => b.categoryId === '__income__')?.amount ?? 0;
    const expenseBudget = budgets.filter(b => b.categoryId !== '__income__').reduce((s, b) => s + b.amount, 0);

    const toggleType = (type: 'income' | 'expense' | 'transfer') =>
        setFilters(f => ({...f, types: f.types.includes(type) ? f.types.filter(x => x !== type) : [...f.types, type]}));

    const toggleCategory = (id: string) =>
        setFilters(f => ({
            ...f,
            categoryIds: f.categoryIds.includes(id) ? f.categoryIds.filter(x => x !== id) : [...f.categoryIds, id]
        }));

    const toggleCard = (id: string) =>
        setFilters(f => ({
            ...f,
            cardIds: f.cardIds.includes(id) ? f.cardIds.filter(x => x !== id) : [...f.cardIds, id]
        }));

    const handleDelete = async (transaction: Transaction) => {
        if (!confirm(t('common.delete') + '?')) return;
        // The server reverses any balance impact (including both legs of a transfer) atomically.
        await remove(transaction.id);
    };

    const handleEditSave = async (data: NewTransaction) => {
        // The server re-derives the balance impact (revert old + apply new) atomically.
        await update(editingTx!.id, data);
    };

    const handleReturn = async (returnAmount: number, originalTxId: string, accountId: string, date: number) => {
        // Atomic: records the income transaction, bumps returnedAmount, and adjusts the account balance.
        await returnTransaction(originalTxId, { returnAmount, accountId: accountId || undefined, date });
    };

    const getCategoryLabel = (id: string) => {
        if (id === '__debts__') return t('transactions.filter_debt_payments');
        const cat = categories.find(c => c.id === id);
        return cat ? `${cat.icon} ${cat.name}` : id;
    };

    const getSubcategoryLabel = (id: string) => subcategories.find(s => s.id === id)?.name ?? id;
    const getCardLabel = (id: string) => cards.find(c => c.id === id)?.name ?? id;

    const formatDateChip = (from: string | null, to: string | null) => {
        const fmt = (d: string) => dayjs(d).format('D MMM');
        if (from && to) return `${fmt(from)} – ${fmt(to)}`;
        if (from) return `${t('transactions.filter_date_from')} ${fmt(from)}`;
        return `${t('transactions.filter_date_to')} ${fmt(to!)}`;
    };

    return (
        <div className={styles.page}>
            {/* Month nav */}
            <div className={styles.monthNav}>
                <button onClick={prevMonth}><HiChevronLeft size={20}/></button>
                <span>{monthLabel}</span>
                <button onClick={nextMonth}><HiChevronRight size={20}/></button>
                <button
                    className={`${styles.filterIconBtn} ${hasAnyFilter ? styles.filterIconActive : ''}`}
                    onClick={() => setShowFilterPanel(true)}
                >
                    <HiAdjustmentsHorizontal size={19}/>
                    {hasAnyFilter && <span className={styles.filterBadge}/>}
                </button>
            </div>

            {/* Active filter chips */}
            {hasAnyFilter && (
                <div className={styles.chipsRow}>
                    {filters.types.map(type => (
                        <div key={type} className={styles.chip}>
                            <span>{type === 'income' ? t('transactions.filter_type_income') : type === 'expense' ? t('transactions.filter_type_expense') : t('transactions.filter_type_transfer')}</span>
                            <button
                                onClick={() => setFilters(f => ({...f, types: f.types.filter(x => x !== type)}))}>✕
                            </button>
                        </div>
                    ))}
                    {filters.categoryIds.map(id => (
                        <div key={id} className={styles.chip}>
                            <span>{getCategoryLabel(id)}</span>
                            <button onClick={() => setFilters(f => ({
                                ...f,
                                categoryIds: f.categoryIds.filter(x => x !== id)
                            }))}>✕
                            </button>
                        </div>
                    ))}
                    {filters.subcategoryIds.map(id => (
                        <div key={id} className={styles.chip}>
                            <span>{getSubcategoryLabel(id)}</span>
                            <button onClick={() => setFilters(f => ({
                                ...f,
                                subcategoryIds: f.subcategoryIds.filter(x => x !== id)
                            }))}>✕
                            </button>
                        </div>
                    ))}
                    {filters.cardIds.map(id => (
                        <div key={id} className={styles.chip}>
                            <span>{getCardLabel(id)}</span>
                            <button
                                onClick={() => setFilters(f => ({...f, cardIds: f.cardIds.filter(x => x !== id)}))}>✕
                            </button>
                        </div>
                    ))}
                    {(filters.dateFrom || filters.dateTo) && (
                        <div className={styles.chip}>
                            <span>{formatDateChip(filters.dateFrom, filters.dateTo)}</span>
                            <button onClick={() => setFilters(f => ({...f, dateFrom: null, dateTo: null}))}>✕</button>
                        </div>
                    )}
                </div>
            )}

            {/* Summary mode toggle (only useful if user has multi-currency txs) */}
            {usedCurrencies.length > 1 && (
                <div className={styles.summaryToggle}>
                    <button
                        className={`${styles.summaryToggleBtn} ${summaryMode === 'total' ? styles.summaryToggleActive : ''}`}
                        onClick={() => setSummaryMode('total')}
                    >{t('transactions.summary_total')}</button>
                    <button
                        className={`${styles.summaryToggleBtn} ${summaryMode === 'byCurrency' ? styles.summaryToggleActive : ''}`}
                        onClick={() => setSummaryMode('byCurrency')}
                    >{t('transactions.summary_by_currency')}</button>
                </div>
            )}

            {/* Monthly summary */}
            {summaryMode === 'total' || usedCurrencies.length <= 1 ? (
                <>
                    <div className={styles.summaryRow}>
                        <div className={styles.summaryItem}>
                            <p className={styles.summaryLabel}>{t('common.income')}</p>
                            <p className={styles.summaryIncome}>{formatAmount(summaryTotals.income)}</p>
                            {!hasAnyFilter && incomeBudget > 0 &&
                                <p className={styles.summaryBudget}>/ {formatAmount(incomeBudget)}</p>}
                        </div>
                        <div className={styles.summarySep}/>
                        <div className={styles.summaryItem}>
                            <p className={styles.summaryLabel}>{t('common.expenses')}</p>
                            <p className={`${styles.summaryExpense} ${!hasAnyFilter && expenseBudget > 0 && summaryTotals.expense > expenseBudget ? styles.summaryOver : ''}`}>
                                {formatAmount(summaryTotals.expense)}
                            </p>
                            {!hasAnyFilter && expenseBudget > 0 &&
                                <p className={styles.summaryBudget}>/ {formatAmount(expenseBudget)}</p>}
                        </div>
                        <div className={styles.summarySep}/>
                        <div className={styles.summaryItem}>
                            <p className={styles.summaryLabel}>{t('common.net')}</p>
                            <p className={summaryTotals.income - summaryTotals.expense >= 0 ? styles.summaryIncome : styles.summaryExpense}>
                                {formatAmount(Math.abs(summaryTotals.income - summaryTotals.expense))}
                            </p>
                        </div>
                    </div>
                    {summaryTotals.hasUnconverted && (
                        <p className={styles.summaryNote}>{t('transactions.summary_unconverted_note')}</p>
                    )}
                </>
            ) : (
                <div className={styles.summaryByCurrency}>
                    {usedCurrencies.map(ccy => (
                        <div key={ccy} className={styles.summaryByCurrencyRow}>
                            <span className={styles.summaryByCurrencyCode}>{ccy}</span>
                            <span className={styles.summaryIncome}>+{formatAmount(summaryByCurrency[ccy].income, ccy)}</span>
                            <span className={styles.summaryExpense}>−{formatAmount(summaryByCurrency[ccy].expense, ccy)}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Chart view */}
            {viewMode === 'chart' && (
                <ChartView
                    filters={filters}
                    transactions={filteredTxs}
                    categories={categories}
                    budgets={budgets}
                    viewDate={viewDate}
                />
            )}

            {/* List view */}
            {viewMode === 'list' && (
                grouped.length === 0 ? (
                    <div className={styles.empty}>
                        <div className={styles.emptyIcon}>{hasAnyFilter ? '🔍' : '📭'}</div>
                        <p className={styles.emptyTitle}>
                            {hasAnyFilter ? t('transactions.filter_no_match') : t('transactions.empty')}
                        </p>
                        {hasAnyFilter && (
                            <>
                                <p className={styles.emptyHint}>{t('transactions.filter_no_match_hint')}</p>
                                <button className={styles.emptyClearBtn} onClick={() => setFilters(defaultFilters)}>
                                    {t('transactions.filter_clear_btn')}
                                </button>
                            </>
                        )}
                    </div>
                ) : (
                    <div className={styles.groups}>
                        {grouped.map(([dateLabel, txs]) => {
                            const dayIncome = txs.filter(t => t.type === 'income' && t.currency === 'UZS' && t.source !== 'transfer').reduce((s, t) => s + t.amount, 0);
                            const dayExpense = txs.filter(t => t.type === 'expense' && t.currency === 'UZS' && t.source !== 'transfer').reduce((s, t) => s + t.amount, 0);
                            const dayNet = dayIncome - dayExpense;
                            return (
                                <div key={dateLabel} className={styles.group}>
                                    <div className={styles.dateHeader}>
                                        <span>{dateLabel}</span>
                                        <span className={dayNet >= 0 ? styles.incTotal : styles.expTotal}>
                      {dayNet >= 0 ? '+' : '−'}{formatAmount(Math.abs(dayNet))}
                    </span>
                                    </div>
                                    <div className={styles.list}>
                                        {txs.map(tx => {
                                            const isReturn = tx.source === 'return';
                                            const cat = getCategory(tx.categoryId);
                                            const icon = isReturn ? '↩' : tx.source === 'debt_payment' ? '💳' : tx.source === 'savings' ? '🐷' : tx.source === 'transfer' ? '🔄' : tx.source === 'subscription' ? '📡' : cat?.icon ?? '📦';
                                            const color = isReturn ? '#30d158' : tx.source ? '#636366' : cat?.color ?? '#636366';
                                            const name = isReturn ? t('return.history_label') : (tx.sourceLabel ?? cat?.name ?? 'Unknown');
                                            const remaining = tx.type === 'expense' ? tx.amount - (tx.returnedAmount ?? 0) : null;
                                            return (
                                                <div key={tx.id} className={styles.txRow}>
                                                    <div className={styles.txIcon} style={{background: color + '22'}}>
                                                        <span>{icon}</span>
                                                    </div>
                                                    <div className={styles.txMid}>
                                                        <p className={styles.txName}>
                                                            {name}
                                                            <span className={styles.txTime}>{formatTime(tx.createdAt, locale)}</span>
                                                        </p>
                                                        {tx.comment && <p className={styles.txComment}>{tx.comment}</p>}
                                                        {tx.type === 'expense' && (tx.returnedAmount ?? 0) > 0 && (
                                                            <p className={styles.txComment}>
                                                                {t('return.returned_badge', {amount: formatAmount(tx.returnedAmount!, tx.currency)})}
                                                                {remaining !== null && remaining > 0 && ` · ${formatAmount(remaining, tx.currency)} left`}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className={styles.txRight}>
                                                        <p className={`${styles.txAmount} ${tx.source === 'transfer' ? styles.transfer : tx.type === 'income' ? styles.inc : styles.exp}`}>
                                                            {tx.source === 'transfer'
                                                                ? tx.toAmount && tx.toCurrency && tx.toCurrency !== tx.currency
                                                                    ? `${formatAmount(tx.amount, tx.currency)} → ${formatAmount(tx.toAmount, tx.toCurrency)}`
                                                                    : formatAmount(tx.amount, tx.currency)
                                                                : `${tx.type === 'income' ? '+' : '−'}${formatAmount(tx.amount, tx.currency)}`}
                                                        </p>
                                                        <div className={styles.txActions}>
                                                            {tx.type === 'expense' && !isReturn && tx.source !== 'transfer' && (
                                                                <button className={styles.returnBtn}
                                                                        onClick={() => setReturnTx(tx)}
                                                                        title={t('return.history_label')}>
                                                                    <HiArrowUturnLeft size={13}/>
                                                                </button>
                                                            )}
                                                            <button className={styles.editBtn}
                                                                    onClick={() => setEditingTx(tx)}>
                                                                <HiPencil size={13}/>
                                                            </button>
                                                            <button className={styles.delBtn}
                                                                    onClick={() => handleDelete(tx)}>
                                                                <HiTrash size={13}/>
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )
            )}

            {/* FAB */}
            <button className={styles.fab} onClick={() => setViewMode(m => m === 'list' ? 'chart' : 'list')}>
                {viewMode === 'list' ? t('transactions.view_chart') : t('transactions.view_list')}
                {viewMode === 'chart' ? <HiQueueList size={22}/> : <HiChartPie size={22}/>}
            </button>

            {/* Filter Panel */}
            {showFilterPanel && (
                <>
                    <div className={styles.filterOverlay} onClick={() => setShowFilterPanel(false)}/>
                    <div className={styles.filterPanel}>
                        <div className={styles.filterHandle}/>
                        <div className={styles.filterPanelHeader}>
                            <span className={styles.filterPanelTitle}>{t('transactions.filter_title')}</span>
                            {hasAnyFilter && (
                                <button className={styles.clearAllBtn} onClick={() => setFilters(defaultFilters)}>
                                    {t('transactions.filter_clear_all')}
                                </button>
                            )}
                            <button className={styles.closePanelBtn} onClick={() => setShowFilterPanel(false)}>
                                <HiXMark size={20}/>
                            </button>
                        </div>

                        {/* Type */}
                        <div className={styles.filterSection}>
                            <p className={styles.filterSectionLabel}>{t('transactions.filter_section_type')}</p>
                            <div className={styles.typeRow}>
                                {(['income', 'expense', 'transfer'] as const).map(type => (
                                    <button
                                        key={type}
                                        className={`${styles.typeBtn} ${filters.types.includes(type) ? styles.typeBtnActive : ''}`}
                                        onClick={() => toggleType(type)}
                                    >
                                        {type === 'income' ? t('transactions.filter_type_income') : type === 'expense' ? t('transactions.filter_type_expense') : t('transactions.filter_type_transfer')}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Category */}
                        <div className={styles.filterSection}>
                            <p className={styles.filterSectionLabel}>{t('transactions.filter_section_category')}</p>
                            <div className={styles.filterList}>
                                {categories.filter(c => monthCategoryIds.has(c.id)).map(cat => {
                                    const catActive = filters.categoryIds.includes(cat.id);
                                    return (
                                        <div key={cat.id}>
                                            <button
                                                className={`${styles.filterListItem} ${catActive ? styles.filterListItemActive : ''}`}
                                                onClick={() => toggleCategory(cat.id)}
                                            >
                                                <span>{cat.icon} {cat.name}</span>
                                                {catActive && <span className={styles.checkMark}>✓</span>}
                                            </button>
                                        </div>
                                    );
                                })}
                                {hasDebtTxsThisMonth && (
                                    <button
                                        className={`${styles.filterListItem} ${filters.categoryIds.includes('__debts__') ? styles.filterListItemActive : ''}`}
                                        onClick={() => toggleCategory('__debts__')}
                                    >
                                        <span>{t('transactions.filter_debt_payments')}</span>
                                        {filters.categoryIds.includes('__debts__') &&
                                            <span className={styles.checkMark}>✓</span>}
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Account */}
                        {cards.length > 0 && (
                            <div className={styles.filterSection} style={{ position: 'relative' }}>
                                <p className={styles.filterSectionLabel} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    {t('transactions.filter_section_account')}
                                    {!isPremium && <PremiumBadge />}
                                </p>
                                <div className={styles.filterList} style={!isPremium ? { filter: 'blur(2px)', pointerEvents: 'none' } : undefined}>
                                    {cards.map(card => {
                                        const active = filters.cardIds.includes(card.id);
                                        return (
                                            <button
                                                key={card.id}
                                                className={`${styles.filterListItem} ${active ? styles.filterListItemActive : ''}`}
                                                onClick={() => toggleCard(card.id)}
                                            >
                                                <span>{card.name}</span>
                                                {active && <span className={styles.checkMark}>✓</span>}
                                            </button>
                                        );
                                    })}
                                </div>
                                {!isPremium && (
                                    <button
                                        onClick={() => premiumGate.open('filters')}
                                        style={{
                                            position: 'absolute', inset: 0, top: 28,
                                            background: 'transparent', border: 'none', cursor: 'pointer',
                                        }}
                                        aria-label="Premium filter"
                                    />
                                )}
                            </div>
                        )}

                        {/* Date Range */}
                        <div className={styles.filterSection}>
                            <p className={styles.filterSectionLabel}>{t('transactions.filter_section_date')}</p>
                            <div className={styles.dateRow}>
                                <div className={styles.dateField}>
                                    <label className={styles.dateLabel}>{t('transactions.filter_date_from')}</label>
                                    <Input
                                        type="date"
                                        className={styles.dateInput}
                                        value={filters.dateFrom ?? ''}
                                        onChange={e => setFilters(f => ({...f, dateFrom: e.target.value || null}))}
                                    />
                                </div>
                                <div className={styles.dateField}>
                                    <label className={styles.dateLabel}>{t('transactions.filter_date_to')}</label>
                                    <Input
                                        type="date"
                                        className={styles.dateInput}
                                        value={filters.dateTo ?? ''}
                                        onChange={e => setFilters(f => ({...f, dateTo: e.target.value || null}))}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {showAdd && (
                <AddTransactionModal
                    categories={categories}
                    subcategories={subcategories}
                    cards={cards}
                    cardOrder={cardOrder}
                    onSaveCardOrder={saveCardOrder}
                    onAdd={async (data: NewTransaction) => {
                        // The server adjusts the card balance when cardId is present.
                        await add(data);
                    }}
                    onClose={() => setShowAdd(false)}
                    onReturn={() => {
                        setShowAdd(false);
                        setShowReturn(true);
                    }}
                />
            )}

            {editingTx && (
                <AddTransactionModal
                    categories={categories}
                    subcategories={subcategories}
                    cards={cards}
                    cardOrder={cardOrder}
                    onSaveCardOrder={saveCardOrder}
                    initialData={editingTx}
                    onAdd={handleEditSave}
                    onClose={() => setEditingTx(null)}
                />
            )}

            {(returnTx || showReturn) && (
                <ReturnModal
                    transactions={transactions}
                    categories={categories}
                    cards={cards}
                    preselectedTx={returnTx ?? undefined}
                    onSave={handleReturn}
                    onClose={() => {
                        setReturnTx(null);
                        setShowReturn(false);
                    }}
                />
            )}
            {premiumGate.node}
        </div>
    );
};

export default Transactions;
