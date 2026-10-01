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
    HiCheck,
    HiMinus,
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
    // "Custom period" is a UI mode, not a filter value: it stays open while the user
    // has picked no dates (or dates that happen to match a preset) yet.
    const [customPeriod, setCustomPeriod] = useState(false);
    // The sheet's main screen stays short; long option lists open as a second screen.
    const [filterView, setFilterView] = useState<'main' | 'categories' | 'accounts'>('main');
    const [categorySearch, setCategorySearch] = useState('');
    const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);
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
        setFilterView('main');
        setCategorySearch('');
        setExpandedCategoryId(null);
        setShowFilterPanel(true);
    };

    useEffect(() => {
        if (categoryFilter) {
            setFilters(f => ({...f, categoryIds: [categoryFilter]}));
            setCategoryFilter(null);
        }
    }, [categoryFilter, setCategoryFilter, setFilters]);

    const monthLabel = formatMonth(new Date(viewDate.year, viewDate.month), locale);

    // With a date range active the arrows would move a month nobody sees; stepping
    // drops the range and goes back to browsing by month.
    const leaveDateRange = () => {
        setCustomPeriod(false);
        if (filters.dateFrom || filters.dateTo) setFilters(f => ({...f, dateFrom: null, dateTo: null}));
    };

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

    // The period comes first: a custom/preset range replaces the month picked in the
    // header, otherwise that month is the period. Everything else narrows within it.
    const periodTxs = useMemo(() => transactions.filter(t => {
        const d = new Date(t.date);
        if (filters.dateFrom || filters.dateTo) {
            if (filters.dateFrom && d < new Date(filters.dateFrom + 'T00:00:00')) return false;
            if (filters.dateTo && d > new Date(filters.dateTo + 'T23:59:59')) return false;
            return true;
        }
        return d.getMonth() === viewDate.month && d.getFullYear() === viewDate.year;
    }), [transactions, filters.dateFrom, filters.dateTo, viewDate]);

    const filteredTxs = useMemo(() => {
        return periodTxs.filter(t => {
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
    }, [periodTxs, filters.types, filters.categoryIds, filters.subcategoryIds, filters.cardIds]);

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

    // Operation counts per category/subcategory inside the chosen period, so the
    // filter only offers options that can actually match and shows how many will.
    const periodCounts = useMemo(() => {
        const categoryCounts = new Map<string, number>();
        const subcategoryCounts = new Map<string, number>();
        let debtPayments = 0;
        for (const tx of periodTxs) {
            categoryCounts.set(tx.categoryId, (categoryCounts.get(tx.categoryId) ?? 0) + 1);
            if (tx.subcategoryId) subcategoryCounts.set(tx.subcategoryId, (subcategoryCounts.get(tx.subcategoryId) ?? 0) + 1);
            if (tx.source === 'debt_payment') debtPayments += 1;
        }
        return {categoryCounts, subcategoryCounts, debtPayments};
    }, [periodTxs]);

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

    const subcategoryIdsOf = (categoryId: string) =>
        new Set(subcategories.filter(item => item.categoryId === categoryId).map(item => item.id));

    const isCategoryActive = (id: string) => {
        if (filters.categoryIds.includes(id)) return true;
        const childIds = subcategoryIdsOf(id);
        return filters.subcategoryIds.some(item => childIds.has(item));
    };

    // Checkbox semantics: a partly picked category (some subcategories) becomes the
    // whole category on tap; a whole one is cleared.
    const toggleCategory = (id: string) => {
        const childIds = subcategoryIdsOf(id);
        setFilters(current => ({
            ...current,
            categoryIds: current.categoryIds.includes(id)
                ? current.categoryIds.filter(item => item !== id)
                : [...current.categoryIds, id],
            subcategoryIds: current.subcategoryIds.filter(item => !childIds.has(item)),
        }));
    };

    // Subcategory ticks behave like checkboxes. Unticking one while the whole category
    // is on keeps its siblings ticked, so only the unticked one leaves the result.
    const toggleSubcategory = (id: string, categoryId: string) => setFilters(current => {
        const childIds = subcategoryIdsOf(categoryId);
        if (current.categoryIds.includes(categoryId)) {
            const siblings = subcategories
                .filter(sub => sub.categoryId === categoryId && sub.id !== id && periodCounts.subcategoryCounts.has(sub.id))
                .map(sub => sub.id);
            return {
                ...current,
                categoryIds: current.categoryIds.filter(item => item !== categoryId),
                subcategoryIds: [...current.subcategoryIds.filter(item => !childIds.has(item)), ...siblings],
            };
        }
        return {
            ...current,
            subcategoryIds: current.subcategoryIds.includes(id)
                ? current.subcategoryIds.filter(item => item !== id)
                : [...current.subcategoryIds, id],
        };
    });

    const hasCategoryFilter = filters.categoryIds.length > 0 || filters.subcategoryIds.length > 0;

    const categoryOptions = categories
        .filter(cat => periodCounts.categoryCounts.has(cat.id) || isCategoryActive(cat.id))
        .sort((a, b) => (periodCounts.categoryCounts.get(b.id) ?? 0) - (periodCounts.categoryCounts.get(a.id) ?? 0));
    const subsInPeriod = (categoryId: string) => subcategories.filter(sub => sub.categoryId === categoryId
        && (periodCounts.subcategoryCounts.has(sub.id) || filters.subcategoryIds.includes(sub.id)));

    const searchQuery = categorySearch.trim().toLocaleLowerCase(locale);
    const searchedCategories = searchQuery
        ? categoryOptions.filter(cat => categoryName(cat).toLocaleLowerCase(locale).includes(searchQuery)
            || subsInPeriod(cat.id).some(sub => sub.name.toLocaleLowerCase(locale).includes(searchQuery)))
        : categoryOptions;

    const categoryState = (id: string): 'all' | 'some' | 'none' => {
        if (filters.categoryIds.includes(id)) return 'all';
        return isCategoryActive(id) ? 'some' : 'none';
    };

    // One line that says what is picked: "All", "Food, Cafe", or "Food, Cafe +3".
    const summarize = (labels: string[]) => {
        if (labels.length === 0) return t('transactions.filter_all');
        if (labels.length <= 2) return labels.join(', ');
        return `${labels.slice(0, 2).join(', ')} ${t('transactions.filter_and_more', {count: labels.length - 2})}`;
    };
    const categorySummary = summarize([
        ...categories.filter(cat => isCategoryActive(cat.id)).map(cat => categoryName(cat)),
        ...(filters.categoryIds.includes('__debts__') ? [t('transactions.filter_debt_payments')] : []),
    ]);
    const accountSummary = summarize(cards.filter(card => filters.cardIds.includes(card.id)).map(card => card.name));

    type PeriodMode = 'month' | '7d' | '30d' | 'custom';
    const today = dayjs().format('YYYY-MM-DD');
    const presetFrom = (days: number) => dayjs().subtract(days - 1, 'day').format('YYYY-MM-DD');
    const derivedPeriod: PeriodMode = !filters.dateFrom && !filters.dateTo
        ? 'month'
        : filters.dateTo === today && filters.dateFrom === presetFrom(7)
            ? '7d'
            : filters.dateTo === today && filters.dateFrom === presetFrom(30)
                ? '30d'
                : 'custom';
    const periodMode: PeriodMode = customPeriod ? 'custom' : derivedPeriod;
    const periodOptions: {mode: PeriodMode; label: string}[] = [
        {mode: 'month', label: monthLabel},
        {mode: '7d', label: t('transactions.filter_period_7d')},
        {mode: '30d', label: t('transactions.filter_period_30d')},
        {mode: 'custom', label: t('transactions.filter_period_custom')},
    ];

    const selectPeriod = (mode: PeriodMode) => {
        setCustomPeriod(mode === 'custom');
        if (mode === 'custom') return;
        if (mode === 'month') {
            setFilters(f => ({...f, dateFrom: null, dateTo: null}));
            return;
        }
        const from = presetFrom(mode === '7d' ? 7 : 30);
        setFilters(f => ({...f, dateFrom: from, dateTo: today}));
    };

    const resetFilters = () => {
        setCustomPeriod(false);
        setFilters(defaultFilters);
    };

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
                <button aria-label={t('common.prev_month')} onClick={() => { leaveDateRange(); prevMonth(); }}><HiChevronLeft size={20}/></button>
                <span>{filters.dateFrom || filters.dateTo ? formatDateChip(filters.dateFrom, filters.dateTo) : monthLabel}</span>
                <button aria-label={t('common.next_month')} onClick={() => { leaveDateRange(); nextMonth(); }}><HiChevronRight size={20}/></button>
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
                            <button onClick={() => selectPeriod('month')}>✕</button>
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
                                <button className={styles.emptyClearBtn} onClick={resetFilters}>
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
                            className={`${styles.filterPanel} ${filterView !== 'main' ? styles.filterPanelTall : ''} ${isFilterClosing ? styles.filterPanelClosing : ''}`}
                            onClick={event => event.stopPropagation()}
                            {...filterSwipeProps}
                        >
                            <div className={styles.filterSwipeArea}>
                                <div className={styles.filterHandle}/>
                                <div className={styles.filterPanelHeader}>
                                    {filterView !== 'main' && (
                                        <button
                                            type="button"
                                            className={styles.closePanelBtn}
                                            aria-label={t('common.back')}
                                            onClick={() => setFilterView('main')}
                                        >
                                            <HiChevronLeft size={20}/>
                                        </button>
                                    )}
                                    <span className={styles.filterPanelTitle}>
                                        {filterView === 'categories'
                                            ? t('transactions.filter_section_category')
                                            : filterView === 'accounts'
                                                ? t('transactions.filter_section_account')
                                                : t('transactions.filter_title')}
                                    </span>
                                    {filterView === 'categories' && hasCategoryFilter && (
                                        <button type="button" className={styles.sectionClearBtn} onClick={() => setFilters(f => ({...f, categoryIds: [], subcategoryIds: []}))}>
                                            {t('transactions.filter_clear_all')}
                                        </button>
                                    )}
                                    {filterView === 'accounts' && filters.cardIds.length > 0 && (
                                        <button type="button" className={styles.sectionClearBtn} onClick={() => setFilters(f => ({...f, cardIds: []}))}>
                                            {t('transactions.filter_clear_all')}
                                        </button>
                                    )}
                                    {filterView === 'main' && (
                                        <button className={styles.closePanelBtn} aria-label={t('common.close')} onClick={closeFilterPanel}>
                                            <HiXMark size={20}/>
                                        </button>
                                    )}
                                </div>
                                {filterView === 'main' && (
                                    <p className={styles.filterPanelSubtitle}>{t('transactions.filter_subtitle')}</p>
                                )}
                            </div>

                            {filterView === 'main' && (
                            <div className={styles.filterBody}>
                                {/* Period */}
                                <section className={styles.filterSection}>
                                    <p className={styles.filterSectionLabel}>{t('transactions.filter_section_date')}</p>
                                    <div className={styles.chipGroup}>
                                        {periodOptions.map(option => (
                                            <button
                                                key={option.mode}
                                                type="button"
                                                className={`${styles.optionChip} ${periodMode === option.mode ? styles.optionChipActive : ''}`}
                                                aria-pressed={periodMode === option.mode}
                                                onClick={() => selectPeriod(option.mode)}
                                            >
                                                {option.label}
                                            </button>
                                        ))}
                                    </div>
                                    {periodMode === 'custom' && (
                                        <div className={styles.dateRow}>
                                            <div className={styles.dateField}>
                                                <label className={styles.dateLabel}>{t('transactions.filter_date_from')}</label>
                                                <Input
                                                    type="date"
                                                    className={styles.dateInput}
                                                    value={filters.dateFrom ?? ''}
                                                    max={filters.dateTo ?? undefined}
                                                    onChange={e => setFilters(f => ({...f, dateFrom: e.target.value || null}))}
                                                />
                                            </div>
                                            <div className={styles.dateField}>
                                                <label className={styles.dateLabel}>{t('transactions.filter_date_to')}</label>
                                                <Input
                                                    type="date"
                                                    className={styles.dateInput}
                                                    value={filters.dateTo ?? ''}
                                                    min={filters.dateFrom ?? undefined}
                                                    onChange={e => setFilters(f => ({...f, dateTo: e.target.value || null}))}
                                                />
                                            </div>
                                        </div>
                                    )}
                                    {periodMode !== 'month' && (
                                        <p className={styles.filterHint}>{t('transactions.filter_period_override_hint')}</p>
                                    )}
                                </section>

                                {/* Type */}
                                <section className={styles.filterSection}>
                                    <p className={styles.filterSectionLabel}>{t('transactions.filter_section_type')}</p>
                                    <div className={styles.chipGroup}>
                                        <button
                                            type="button"
                                            className={`${styles.optionChip} ${filters.types.length === 0 ? styles.optionChipActive : ''}`}
                                            aria-pressed={filters.types.length === 0}
                                            onClick={() => setFilters(f => ({...f, types: []}))}
                                        >
                                            {t('transactions.filter_all')}
                                        </button>
                                        {(['expense', 'income', 'transfer', 'return'] as const).map(type => (
                                            <button
                                                key={type}
                                                type="button"
                                                className={`${styles.optionChip} ${filters.types.includes(type) ? styles.optionChipActive : ''}`}
                                                aria-pressed={filters.types.includes(type)}
                                                onClick={() => toggleType(type)}
                                            >
                                                {typeLabel(type)}
                                            </button>
                                        ))}
                                    </div>
                                </section>

                                {/* Category and account: one summary row each, details on their own screen */}
                                <section className={styles.filterSection}>
                                    <div className={styles.navGroup}>
                                        <button
                                            type="button"
                                            className={styles.navRow}
                                            onClick={() => { setCategorySearch(''); setFilterView('categories'); }}
                                        >
                                            <span className={styles.navLabel}>{t('transactions.filter_section_category')}</span>
                                            <span className={`${styles.navValue} ${hasCategoryFilter ? styles.navValueActive : ''}`}>{categorySummary}</span>
                                            <HiChevronRight className={styles.navChevron} size={18}/>
                                        </button>
                                        {cards.length > 0 && (
                                            <button
                                                type="button"
                                                className={styles.navRow}
                                                onClick={() => {
                                                    if (!isPremium) { premiumGate.open('filters'); return; }
                                                    setFilterView('accounts');
                                                }}
                                            >
                                                <span className={styles.navLabel}>{t('transactions.filter_section_account')}</span>
                                                {isPremium
                                                    ? <span className={`${styles.navValue} ${filters.cardIds.length > 0 ? styles.navValueActive : ''}`}>{accountSummary}</span>
                                                    : <span className={styles.navValue}><PremiumBadge/></span>}
                                                <HiChevronRight className={styles.navChevron} size={18}/>
                                            </button>
                                        )}
                                    </div>
                                </section>
                            </div>
                            )}

                            {filterView === 'categories' && (
                            <div className={styles.filterBody}>
                                {categoryOptions.length > 8 && (
                                    <div className={styles.searchWrap}>
                                        <input
                                            type="search"
                                            className={styles.searchInput}
                                            placeholder={t('transactions.filter_search_category')}
                                            value={categorySearch}
                                            onChange={e => setCategorySearch(e.target.value)}
                                        />
                                    </div>
                                )}
                                <div className={styles.pickList}>
                                    {searchedCategories.map(cat => {
                                        const state = categoryState(cat.id);
                                        const subs = subsInPeriod(cat.id);
                                        const expanded = expandedCategoryId === cat.id || (searchQuery !== '' && subs.length > 0
                                            && !categoryName(cat).toLocaleLowerCase(locale).includes(searchQuery));
                                        const visibleSubs = searchQuery && !categoryName(cat).toLocaleLowerCase(locale).includes(searchQuery)
                                            ? subs.filter(sub => sub.name.toLocaleLowerCase(locale).includes(searchQuery))
                                            : subs;
                                        const pickedSubs = subs.filter(sub => filters.subcategoryIds.includes(sub.id));
                                        return (
                                            <div key={cat.id} className={styles.pickItem}>
                                                <div className={styles.pickRow}>
                                                    <button
                                                        type="button"
                                                        className={styles.pickMain}
                                                        role="checkbox"
                                                        aria-checked={state === 'all' ? true : state === 'some' ? 'mixed' : false}
                                                        onClick={() => toggleCategory(cat.id)}
                                                    >
                                                        <span className={`${styles.checkbox} ${state !== 'none' ? styles.checkboxOn : ''}`}>
                                                            {state === 'all' && <HiCheck size={14}/>}
                                                            {state === 'some' && <HiMinus size={14}/>}
                                                        </span>
                                                        <span className={styles.pickIcon} aria-hidden="true">{cat.icon}</span>
                                                        <span className={styles.pickText}>
                                                            <span className={styles.pickName}>{categoryName(cat)}</span>
                                                            {state === 'some' && (
                                                                <span className={styles.pickSub}>{pickedSubs.map(sub => sub.name).join(', ')}</span>
                                                            )}
                                                        </span>
                                                        <span className={styles.pickCount}>{periodCounts.categoryCounts.get(cat.id) ?? 0}</span>
                                                    </button>
                                                    {subs.length > 0 && (
                                                        <button
                                                            type="button"
                                                            className={styles.expandBtn}
                                                            aria-expanded={expanded}
                                                            aria-label={t('transactions.filter_subcategories')}
                                                            onClick={() => setExpandedCategoryId(id => id === cat.id ? null : cat.id)}
                                                        >
                                                            <HiChevronDown className={expanded ? styles.expandOpen : ''} size={18}/>
                                                        </button>
                                                    )}
                                                </div>
                                                {expanded && visibleSubs.map(sub => {
                                                    const checked = state === 'all' || filters.subcategoryIds.includes(sub.id);
                                                    return (
                                                        <button
                                                            key={sub.id}
                                                            type="button"
                                                            className={`${styles.pickMain} ${styles.pickSubRow}`}
                                                            role="checkbox"
                                                            aria-checked={checked}
                                                            onClick={() => toggleSubcategory(sub.id, cat.id)}
                                                        >
                                                            <span className={`${styles.checkbox} ${checked ? styles.checkboxOn : ''}`}>
                                                                {checked && <HiCheck size={14}/>}
                                                            </span>
                                                            <span className={styles.pickText}>
                                                                <span className={styles.pickName}>{sub.name}</span>
                                                            </span>
                                                            <span className={styles.pickCount}>{periodCounts.subcategoryCounts.get(sub.id) ?? 0}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })}
                                    {periodCounts.debtPayments > 0 && !searchQuery && (
                                        <div className={styles.pickItem}>
                                            <button
                                                type="button"
                                                className={styles.pickMain}
                                                role="checkbox"
                                                aria-checked={filters.categoryIds.includes('__debts__')}
                                                onClick={() => toggleCategory('__debts__')}
                                            >
                                                <span className={`${styles.checkbox} ${filters.categoryIds.includes('__debts__') ? styles.checkboxOn : ''}`}>
                                                    {filters.categoryIds.includes('__debts__') && <HiCheck size={14}/>}
                                                </span>
                                                <span className={styles.pickText}>
                                                    <span className={styles.pickName}>{t('transactions.filter_debt_payments')}</span>
                                                </span>
                                                <span className={styles.pickCount}>{periodCounts.debtPayments}</span>
                                            </button>
                                        </div>
                                    )}
                                    {searchedCategories.length === 0 && (
                                        <p className={styles.pickEmpty}>{t('transactions.filter_nothing_found')}</p>
                                    )}
                                </div>
                            </div>
                            )}

                            {filterView === 'accounts' && (
                            <div className={styles.filterBody}>
                                <div className={styles.pickList}>
                                    {cards.map(card => {
                                        const checked = filters.cardIds.includes(card.id);
                                        return (
                                            <div key={card.id} className={styles.pickItem}>
                                                <button
                                                    type="button"
                                                    className={styles.pickMain}
                                                    role="checkbox"
                                                    aria-checked={checked}
                                                    onClick={() => toggleCard(card.id)}
                                                >
                                                    <span className={`${styles.checkbox} ${checked ? styles.checkboxOn : ''}`}>
                                                        {checked && <HiCheck size={14}/>}
                                                    </span>
                                                    <span className={styles.pickText}>
                                                        <span className={styles.pickName}>{card.name}</span>
                                                    </span>
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            )}

                            <div className={styles.filterFooter}>
                                <button
                                    type="button"
                                    className={styles.filterResetBtn}
                                    disabled={!hasAnyFilter}
                                    onClick={resetFilters}
                                >
                                    {t('transactions.filter_clear_all')}
                                </button>
                                <button
                                    type="button"
                                    className={styles.filterApplyBtn}
                                    onClick={closeFilterPanel}
                                >
                                    {filteredTxs.length > 0
                                        ? t('transactions.filter_show_results', {count: filteredTxs.length})
                                        : t('transactions.filter_show_none')}
                                </button>
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
