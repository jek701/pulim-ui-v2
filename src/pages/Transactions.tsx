import {useState, useMemo, useEffect} from 'react';
import {createPortal} from 'react-dom';
import {
    HiTrash,
    HiPencil,
    HiChevronLeft,
    HiChevronRight,
    HiChartPie,
    HiQueueList,
    HiPresentationChartLine,
    HiArrowUturnLeft,
    HiAdjustmentsHorizontal,
    HiXMark,
    HiChevronDown,
    HiPaperAirplane,
} from 'react-icons/hi2';
import {useApp} from '../context';
import {EMPTY_HISTORY_FILTERS, type HistoryFilters} from '../utils/historyFilters';
import {useTransactions} from '../hooks/useTransactions';
import {useCategories} from '../hooks/useCategories';
import {useCards} from '../hooks/useCards';
import {useBudgets} from '../hooks/useBudgets';
import {useEntitlements} from '../hooks/useEntitlements';
import {usePremiumGate, PremiumBadge} from '../components/PremiumLock';
import {formatAmount, formatDate, formatFullDate, formatTime, formatMonth} from '../utils/format';
import {formatSignedAmount, formatWithMinus} from '../utils/money';
import {categoryDisplayName, useCategoryName} from '../utils/categoryName';
import {useConfirm} from '../components/ConfirmDialog';
import dayjs from '../utils/dayjs';
import AddTransactionModal from '../components/AddTransactionModal';
import ReturnModal from '../components/ReturnModal';
import EditReturnModal from '../components/EditReturnModal';
import EditTransferModal from '../components/EditTransferModal';
import ChartView from '../components/ChartView';
import PageLoader from '../components/PageLoader';
import type {Transaction} from '../types';
import {BASE_CURRENCY} from '../utils/nbuRates';
import type {NewTransaction} from '../hooks/useTransactions';
import styles from './Transactions.module.css';
import {useTranslation} from 'react-i18next';
import {Input} from "../components/FormField.tsx";
import {useModalClose} from '../hooks/useModalClose';
import {useSwipeDismiss} from '../hooks/useSwipeDismiss';
import {
    getTransactionKind,
    isRegularTransaction,
    isReturnableTransaction,
    type TransactionKind,
} from '../utils/transactionKind';

export type ActiveFilters = HistoryFilters;

const defaultFilters = EMPTY_HISTORY_FILTERS;

const Transactions = () => {
    const {
        user, categoryFilter, setCategoryFilter, historyFilters: filters,
        setHistoryFilters: setFilters, transactionDeepLinkId, clearTransactionDeepLink,
    } = useApp();
    const {
        transactions,
        add,
        update,
        remove,
        returnTransaction,
        updateTransfer,
        updateReturn,
        loading: txLoading,
    } = useTransactions(user?.uid ?? null);
    const {categories, subcategories, loading: catLoading} = useCategories(user?.uid ?? null);
    const {cards, cardOrder, saveCardOrder} = useCards(user?.uid ?? null);
    const {budgets} = useBudgets(user?.uid ?? null);
    const {isPremium} = useEntitlements();
    const premiumGate = usePremiumGate();
    const categoryName = useCategoryName();
    const {confirm, node: confirmNode} = useConfirm();
    const [showFilterPanel, setShowFilterPanel] = useState(false);
    // Which purchase currently has its merged refunds expanded.
    const [expandedRefundsFor, setExpandedRefundsFor] = useState<string | null>(null);
    const {
        isClosing: isFilterClosing,
        requestClose: closeFilterPanel,
        resetClose: resetFilterClose,
    } = useModalClose(() => setShowFilterPanel(false));
    const {
        swipeRef: filterSwipeRef,
        swipeAreaProps: filterSwipeProps,
        swipeStyle: filterSwipeStyle,
    } = useSwipeDismiss(closeFilterPanel);
    const [showAdd, setShowAdd] = useState(false);
    const [editingTx, setEditingTx] = useState<Transaction | null>(null);
    const [editingReturnTx, setEditingReturnTx] = useState<Transaction | null>(null);
    const [editingTransferTx, setEditingTransferTx] = useState<Transaction | null>(null);
    const [returnTx, setReturnTx] = useState<Transaction | null>(null);
    const [showReturn, setShowReturn] = useState(false);

    useEffect(() => {
        if (!transactionDeepLinkId || txLoading) return;
        const transaction = transactions.find(candidate => candidate.id === transactionDeepLinkId);
        const task = window.setTimeout(() => {
            if (transaction) {
                const kind = getTransactionKind(transaction);
                if (kind === 'return') setEditingReturnTx(transaction);
                else if (kind === 'transfer') setEditingTransferTx(transaction);
                else if (isRegularTransaction(transaction)) setEditingTx(transaction);
            }
            clearTransactionDeepLink();
        }, 0);
        return () => window.clearTimeout(task);
    }, [transactionDeepLinkId, txLoading, transactions, clearTransactionDeepLink]);
    const [viewMode, setViewMode] = useState<'list' | 'pie' | 'line'>('list');
    const recentCardIds = useMemo(() => {
        const ids: string[] = [];
        for (const transaction of transactions) {
            if (transaction.cardId && !ids.includes(transaction.cardId)) ids.push(transaction.cardId);
            if (ids.length === 3) break;
        }
        return ids;
    }, [transactions]);
    const now = new Date();
    const [viewDate, setViewDate] = useState({month: now.getMonth(), year: now.getFullYear()});
    const {t, i18n} = useTranslation();
    // Pass the app language straight through — hard-coding ru/en here sent Uzbek
    // users down the English branch.
    const locale = i18n.language;
    const openFilterPanel = () => {
        resetFilterClose();
        setShowFilterPanel(true);
    };

    useEffect(() => {
        if (categoryFilter) {
            setFilters(f => ({...f, categoryIds: [categoryFilter]}));
            setCategoryFilter(null);
        }
    }, [categoryFilter, setCategoryFilter, setFilters]);

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
                if (!filters.types.includes(getTransactionKind(t))) return false;
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

    /**
     * Day groups, with same-day refunds folded into the purchase they belong to.
     *
     * A refund that lands on the same day as its original is really one event —
     * showing both as siblings duplicated the number and read as unrelated rows.
     * A refund on a *different* day keeps its own row: the money moved that day, and
     * hiding it would leave the balance changing with nothing in the history to
     * explain it (and the month summary nets it against that month, not the
     * purchase's month).
     */
    const grouped = useMemo(() => {
        const todayStr = t('common.today_label');
        const yesterdayStr = t('common.yesterday_label');
        const map = new Map<string, Transaction[]>();
        const dayKey = (tx: Transaction) => formatDate(tx.date, locale, todayStr, yesterdayStr);
        const visible = new Set(filteredTxs.map(tx => tx.id));
        const mergedInto = new Map<string, Transaction[]>();

        for (const tx of filteredTxs) {
            if (tx.source !== 'return' || !tx.linkedTransactionId) continue;
            const original = filteredTxs.find(candidate => candidate.id === tx.linkedTransactionId);
            if (!original || dayKey(original) !== dayKey(tx)) continue;
            visible.delete(tx.id);
            mergedInto.set(original.id, [...(mergedInto.get(original.id) ?? []), tx]);
        }

        for (const tx of filteredTxs) {
            if (!visible.has(tx.id)) continue;
            const key = dayKey(tx);
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(tx);
        }
        return {groups: Array.from(map.entries()), mergedInto};
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
            // A refund is money coming back from a purchase, not earnings. Counting it
            // as income invented revenue the user never received and left the expense
            // figure at its pre-refund value.
            if (tx.source === 'return') expense -= valueInBase;
            else if (tx.type === 'income') income += valueInBase;
            else if (tx.type === 'expense') expense += valueInBase;
        }
        return {income, expense, hasUnconverted};
    }, [filteredTxs]);

    const monthCategoryIds = useMemo(() => {
        const monthTxs = transactions.filter(t => {
            const d = new Date(t.date);
            return d.getMonth() === viewDate.month && d.getFullYear() === viewDate.year;
        });
        return new Set(monthTxs.map(t => t.categoryId));
    }, [transactions, viewDate]);

    const monthSubcategoryIds = useMemo(() => {
        const ids = transactions.flatMap(transaction => {
            const date = new Date(transaction.date);
            if (date.getMonth() !== viewDate.month || date.getFullYear() !== viewDate.year) return [];
            return transaction.subcategoryId ? [transaction.subcategoryId] : [];
        });
        return new Set(ids);
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

    const toggleType = (type: TransactionKind) =>
        setFilters(f => ({...f, types: f.types.includes(type) ? f.types.filter(x => x !== type) : [...f.types, type]}));

    const typeLabel = (type: TransactionKind) => {
        if (type === 'income') return t('transactions.filter_type_income');
        if (type === 'expense') return t('transactions.filter_type_expense');
        if (type === 'return') return t('transactions.filter_type_return');
        return t('transactions.filter_type_transfer');
    };

    const openTransactionEditor = (transaction: Transaction) => {
        const kind = getTransactionKind(transaction);
        if (kind === 'return') {
            setEditingReturnTx(transaction);
            return;
        }
        if (kind === 'transfer') {
            setEditingTransferTx(transaction);
            return;
        }
        if (isRegularTransaction(transaction)) setEditingTx(transaction);
    };

    const toggleCategory = (id: string) => setFilters(current => {
        const isActive = current.categoryIds.includes(id);
        const childIds = new Set(subcategories.filter(item => item.categoryId === id).map(item => item.id));
        return {
            ...current,
            categoryIds: isActive
                ? current.categoryIds.filter(item => item !== id)
                : [...current.categoryIds, id],
            subcategoryIds: isActive
                ? current.subcategoryIds
                : current.subcategoryIds.filter(item => !childIds.has(item)),
        };
    });

    const toggleSubcategory = (id: string, categoryId: string) => setFilters(current => ({
        ...current,
        categoryIds: current.categoryIds.filter(item => item !== categoryId),
        subcategoryIds: current.subcategoryIds.includes(id)
            ? current.subcategoryIds.filter(item => item !== id)
            : [...current.subcategoryIds, id],
    }));

    const toggleCard = (id: string) => {
        if (!isPremium) { premiumGate.open('filters'); return; }
        setFilters(f => ({
            ...f,
            cardIds: f.cardIds.includes(id) ? f.cardIds.filter(x => x !== id) : [...f.cardIds, id]
        }));
    };

    const handleDelete = async (transaction: Transaction) => {
        const linkedReturns = transactions.filter(tx => tx.linkedTransactionId === transaction.id);
        const category = getCategory(transaction.categoryId);
        const label = transaction.source === 'return'
            ? t('return.history_label')
            : transaction.sourceLabel ?? (category ? categoryDisplayName(category, t) : t('common.transaction'));
        const card = cards.find(c => c.id === transaction.cardId);

        const ok = await confirm({
            title: t('transactions.confirm_delete_title'),
            message: `${label} · ${formatSignedAmount(transaction.type === 'income' ? transaction.amount : -transaction.amount, transaction.currency)} · ${formatFullDate(transaction.date, locale)}`,
            detail: card ? t('transactions.confirm_delete_balance', { card: card.name }) : undefined,
            warning: linkedReturns.length > 0
                ? t('transactions.confirm_delete_returns', { count: linkedReturns.length })
                : undefined,
            confirmLabel: t('common.delete'),
        });
        if (!ok) return;
        // The server reverses any balance impact (both transfer legs, and any linked
        // refunds) atomically.
        await remove(transaction.id);
    };

    const handleEditSave = async (data: NewTransaction) => {
        // The server re-derives the balance impact (revert old + apply new) atomically.
        await update(editingTx!.id, data);
    };

    const handleReturn = async (returnAmount: number, originalTxId: string, accountId: string, date: number, comment?: string) => {
        // Atomic: records the income transaction, bumps returnedAmount, and adjusts the account balance.
        await returnTransaction(originalTxId, { returnAmount, accountId: accountId || undefined, date, comment });
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
                <button aria-label={t('common.prev_month')} onClick={prevMonth}><HiChevronLeft size={20}/></button>
                <span>{monthLabel}</span>
                <button aria-label={t('common.next_month')} onClick={nextMonth}><HiChevronRight size={20}/></button>
                <button
                    className={`${styles.filterIconBtn} ${hasAnyFilter ? styles.filterIconActive : ''}`}
                    onClick={openFilterPanel}
                    aria-label={t('transactions.filter_title')}
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
                            <span>{typeLabel(type)}</span>
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

            {/* Monthly summary */}
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
                        {formatWithMinus(summaryTotals.expense)}
                    </p>
                    {!hasAnyFilter && expenseBudget > 0 &&
                        <p className={styles.summaryBudget}>/ {formatAmount(expenseBudget)}</p>}
                </div>
                <div className={styles.summarySep}/>
                <div className={styles.summaryItem}>
                    <p className={styles.summaryLabel}>{t('common.net')}</p>
                    <p className={summaryTotals.income - summaryTotals.expense >= 0 ? styles.summaryIncome : styles.summaryExpense}>
                        {formatWithMinus(summaryTotals.income - summaryTotals.expense)}
                    </p>
                </div>
            </div>
            {summaryTotals.hasUnconverted && (
                <p className={styles.summaryNote}>{t('transactions.summary_unconverted_note')}</p>
            )}

            <div className={styles.viewSwitcher}>
                <button
                    type="button"
                    className={viewMode === 'list' ? styles.viewSwitcherActive : ''}
                    onClick={() => setViewMode('list')}
                >
                    <HiQueueList size={17}/>
                    {t('transactions.view_list')}
                </button>
                <button
                    type="button"
                    className={viewMode === 'pie' ? styles.viewSwitcherActive : ''}
                    onClick={() => setViewMode('pie')}
                >
                    <HiChartPie size={17}/>
                    {t('common.pie_chart')}
                </button>
                <button
                    type="button"
                    className={viewMode === 'line' ? styles.viewSwitcherActive : ''}
                    onClick={() => setViewMode('line')}
                >
                    <HiPresentationChartLine size={18}/>
                    {t('common.line_chart')}
                </button>
            </div>

            {/* Chart view */}
            {viewMode !== 'list' && (
                <div>
                    <ChartView
                        chartType={viewMode}
                        filters={filters}
                        transactions={filteredTxs}
                        categories={categories}
                        budgets={budgets}
                        viewDate={viewDate}
                    />
                </div>
            )}

            {/* List view */}
            {viewMode === 'list' && (
                grouped.groups.length === 0 ? (
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
                        {grouped.groups.map(([dateLabel, txs]) => {
                            // Mirrors summaryTotals: base-currency values (so a USD row still
                            // counts via baseAmount), transfers excluded, refunds netted off
                            // spending. Restricting this to `currency === 'UZS'` used to leave
                            // foreign-currency days with no total at all.
                            let dayIncome = 0;
                            let dayExpense = 0;
                            // Merged refunds no longer appear in `txs`, but they still moved
                            // money today, so fold them back in for the day total.
                            const dayTxs = txs.flatMap(tx => [tx, ...(grouped.mergedInto.get(tx.id) ?? [])]);
                            for (const t of dayTxs) {
                                if (t.source === 'transfer') continue;
                                const valueInBase = t.currency === BASE_CURRENCY
                                    ? t.amount
                                    : typeof t.baseAmount === 'number' ? t.baseAmount : null;
                                if (valueInBase === null) continue;
                                if (t.source === 'return') dayExpense -= valueInBase;
                                else if (t.type === 'income') dayIncome += valueInBase;
                                else dayExpense += valueInBase;
                            }
                            const dayNet = dayIncome - dayExpense;
                            const hasDayBaseActivity = dayIncome !== 0 || dayExpense !== 0;
                            return (
                                <div key={dateLabel} className={styles.group}>
                                    <div className={styles.dateHeader}>
                                        <span>{dateLabel}</span>
                                        {hasDayBaseActivity && (
                                            <span className={dayNet >= 0 ? styles.incTotal : styles.expTotal}>
                                                {dayNet >= 0 ? '+' : '−'}{formatAmount(Math.abs(dayNet))}
                                            </span>
                                        )}
                                    </div>
                                    <div className={styles.list}>
                                        {txs.map(tx => {
                                            const isReturn = tx.source === 'return';
                                            const cat = getCategory(tx.categoryId);
                                            const icon = isReturn ? '↩' : tx.source === 'debt_payment' ? '💳' : tx.source === 'savings' ? '🐷' : tx.source === 'transfer' ? '🔄' : tx.source === 'subscription' ? '📡' : cat?.icon ?? '📦';
                                            const color = isReturn ? '#30d158' : tx.source ? '#636366' : cat?.color ?? '#636366';
                                            const name = isReturn ? t('return.history_label') : (tx.sourceLabel || categoryName(cat) || t('common.transaction'));
                                            // A partially refunded expense shows what was actually spent; the
                                            // original figure stays visible, struck through, underneath. This
                                            // matches the month summary, which already nets refunds off expenses.
                                            const refunded = tx.type === 'expense' ? (tx.returnedAmount ?? 0) : 0;
                                            const effectiveAmount = tx.amount - refunded;
                                            // A refund row names the purchase it came from, so the pair reads as
                                            // one story without duplicating the numbers.
                                            const refundOrigin = isReturn && tx.linkedTransactionId
                                                ? transactions.find(candidate => candidate.id === tx.linkedTransactionId)
                                                : undefined;
                                            const refundOriginName = refundOrigin
                                                ? (refundOrigin.sourceLabel || categoryName(getCategory(refundOrigin.categoryId)))
                                                : '';
                                            const mergedRefunds = grouped.mergedInto.get(tx.id) ?? [];
                                            const isExpanded = expandedRefundsFor === tx.id;
                                            return (
                                                <div key={tx.id} className={styles.txGroupItem}>
                                                <div
                                                    className={styles.txRow}
                                                >
                                                    <div className={styles.txIcon} style={{background: color + '22'}}>
                                                        <span>{icon}</span>
                                                    </div>
                                                    <div className={styles.txMid}>
                                                        <p className={styles.txName}>
                                                            {name}
                                                            {tx.origin === 'telegram' && (
                                                                <span
                                                                    title={t('transactions.origin_telegram')}
                                                                    aria-label={t('transactions.origin_telegram')}
                                                                >
                                                                    <HiPaperAirplane size={12}/>
                                                                </span>
                                                            )}
                                                            <span className={styles.txTime}>{formatTime(tx.createdAt, locale)}</span>
                                                        </p>
                                                        {tx.comment && <p className={styles.txComment}>{tx.comment}</p>}
                                                        {isReturn && refundOriginName && (
                                                            <p className={styles.txComment}>{refundOriginName}</p>
                                                        )}
                                                        {mergedRefunds.length > 0 && (
                                                            <button
                                                                type="button"
                                                                className={styles.refundToggle}
                                                                aria-expanded={isExpanded}
                                                                onClick={() => setExpandedRefundsFor(isExpanded ? null : tx.id)}
                                                            >
                                                                {t('return.merged_count', {count: mergedRefunds.length})}
                                                                <HiChevronDown
                                                                    size={13}
                                                                    className={`${styles.refundChevron} ${isExpanded ? styles.refundChevronOpen : ''}`}
                                                                />
                                                            </button>
                                                        )}
                                                    </div>
                                                    <div className={styles.txRight}>
                                                        <div className={styles.txAmountBox}>
                                                            <p className={`${styles.txAmount} ${tx.source === 'transfer' ? styles.transfer : tx.type === 'income' ? styles.inc : styles.exp}`}>
                                                                {tx.source === 'transfer'
                                                                    ? tx.toAmount && tx.toCurrency && tx.toCurrency !== tx.currency
                                                                        ? `${formatAmount(tx.amount, tx.currency)} → ${formatAmount(tx.toAmount, tx.toCurrency)}`
                                                                        : `⇄ ${formatAmount(tx.amount, tx.currency)}`
                                                                    : `${tx.type === 'income' ? '+' : '−'}${formatAmount(effectiveAmount, tx.currency)}`}
                                                            </p>
                                                            {refunded > 0 && (
                                                                <p className={styles.txAmountOriginal}>
                                                                    <s>−{formatAmount(tx.amount, tx.currency)}</s>
                                                                </p>
                                                            )}
                                                        </div>
                                                        <div className={styles.txActions}>
                                                            {isReturnableTransaction(tx) && (
                                                                <button className={styles.returnBtn}
                                                                        onClick={() => setReturnTx(tx)}
                                                                        title={t('return.history_label')}>
                                                                    <HiArrowUturnLeft size={13}/>
                                                                </button>
                                                            )}
                                                            {(isRegularTransaction(tx) || isReturn || tx.source === 'transfer') && (
                                                                <button className={styles.editBtn}
                                                                        aria-label={t('common.edit')}
                                                                        onClick={() => openTransactionEditor(tx)}>
                                                                    <HiPencil size={13}/>
                                                                </button>
                                                            )}
                                                            <button className={styles.delBtn}
                                                                    aria-label={t('common.delete')}
                                                                    onClick={() => handleDelete(tx)}>
                                                                <HiTrash size={13}/>
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                                {isExpanded && mergedRefunds.map(refund => (
                                                    <div key={refund.id} className={styles.refundRow}>
                                                        <span className={styles.refundBranch} aria-hidden="true">↳</span>
                                                        <div className={styles.txMid}>
                                                            <p className={styles.refundName}>
                                                                {t('return.history_label')}
                                                                <span className={styles.txTime}>{formatTime(refund.createdAt, locale)}</span>
                                                            </p>
                                                            {refund.comment && <p className={styles.txComment}>{refund.comment}</p>}
                                                        </div>
                                                        <div className={styles.txRight}>
                                                            <p className={`${styles.txAmount} ${styles.inc}`}>
                                                                +{formatAmount(refund.amount, refund.currency)}
                                                            </p>
                                                            <div className={styles.txActions}>
                                                                <button className={styles.editBtn}
                                                                        aria-label={t('common.edit')}
                                                                        onClick={() => openTransactionEditor(refund)}>
                                                                    <HiPencil size={13}/>
                                                                </button>
                                                                <button className={styles.delBtn}
                                                                        aria-label={t('common.delete')}
                                                                        onClick={() => handleDelete(refund)}>
                                                                    <HiTrash size={13}/>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
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

            {/* Filter Panel */}
            {showFilterPanel && createPortal(
                <div
                    className={`${styles.filterOverlay} ${isFilterClosing ? styles.filterOverlayClosing : ''}`}
                    onClick={closeFilterPanel}
                >
                    <div className={styles.filterSwipeLayer} style={filterSwipeStyle}>
                        <div
                            ref={filterSwipeRef}
                            className={`${styles.filterPanel} ${isFilterClosing ? styles.filterPanelClosing : ''}`}
                            onClick={event => event.stopPropagation()}
                            {...filterSwipeProps}
                        >
                            <div className={styles.filterSwipeArea}>
                                <div className={styles.filterHandle}/>
                                <div className={styles.filterPanelHeader}>
                                    <span className={styles.filterPanelTitle}>{t('transactions.filter_title')}</span>
                                    {hasAnyFilter && (
                                        <button className={styles.clearAllBtn} onClick={() => setFilters(defaultFilters)}>
                                            {t('transactions.filter_clear_all')}
                                        </button>
                                    )}
                                    <button className={styles.closePanelBtn} aria-label={t('common.close')} onClick={closeFilterPanel}>
                                        <HiXMark size={20}/>
                                    </button>
                                </div>
                            </div>

                        {/* Type */}
                        <div className={styles.filterSection}>
                            <p className={styles.filterSectionLabel}>{t('transactions.filter_section_type')}</p>
                            <div className={styles.typeRow}>
                                {(['income', 'expense', 'return', 'transfer'] as const).map(type => (
                                    <button
                                        key={type}
                                        className={`${styles.typeBtn} ${filters.types.includes(type) ? styles.typeBtnActive : ''}`}
                                        onClick={() => toggleType(type)}
                                    >
                                        {typeLabel(type)}
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
                                                <span>{cat.icon} {categoryName(cat)}</span>
                                                {catActive && <span className={styles.checkMark}>✓</span>}
                                            </button>
                                            {subcategories
                                                .filter(subcategory => subcategory.categoryId === cat.id && monthSubcategoryIds.has(subcategory.id))
                                                .map(subcategory => {
                                                    const subcategoryActive = filters.subcategoryIds.includes(subcategory.id);
                                                    return (
                                                        <button
                                                            key={subcategory.id}
                                                            className={`${styles.filterListItem} ${styles.filterListItemSub} ${subcategoryActive ? styles.filterListItemActive : ''}`}
                                                            onClick={() => toggleSubcategory(subcategory.id, cat.id)}
                                                        >
                                                            <span><span className={styles.filterSubBranch}>↳</span> {subcategory.name}</span>
                                                            {subcategoryActive && <span className={styles.checkMark}>✓</span>}
                                                        </button>
                                                    );
                                                })}
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
                                                tabIndex={isPremium ? undefined : -1}
                                                aria-hidden={isPremium ? undefined : true}
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
                                        aria-label={t('premium.unlock_with_premium')}
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
                    </div>
                </div>,
                document.body,
            )}

            {showAdd && (
                <AddTransactionModal
                    categories={categories}
                    subcategories={subcategories}
                    cards={cards}
                    cardOrder={cardOrder}
                    recentCardIds={recentCardIds}
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
                    recentCardIds={recentCardIds}
                    onSaveCardOrder={saveCardOrder}
                    initialData={editingTx}
                    onAdd={handleEditSave}
                    onClose={() => setEditingTx(null)}
                />
            )}

            {editingReturnTx && (
                <EditReturnModal
                    transaction={editingReturnTx}
                    original={transactions.find(transaction => transaction.id === editingReturnTx.linkedTransactionId)}
                    categories={categories}
                    cards={cards}
                    onSave={input => updateReturn(editingReturnTx.id, input)}
                    onClose={() => setEditingReturnTx(null)}
                />
            )}

            {editingTransferTx && (
                <EditTransferModal
                    transaction={editingTransferTx}
                    cards={cards}
                    onSave={input => updateTransfer(editingTransferTx.id, input)}
                    onClose={() => setEditingTransferTx(null)}
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
            {confirmNode}
        </div>
    );
};

export default Transactions;
