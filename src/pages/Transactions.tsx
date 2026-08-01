import {useState, useMemo, useEffect, useCallback, useRef} from 'react';
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
    HiQuestionMarkCircle
} from 'react-icons/hi2';
import {useApp} from '../context';
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
import ChartView from '../components/ChartView';
import PageLoader from '../components/PageLoader';
import type {Budget, Category, Transaction} from '../types';
import {BASE_CURRENCY} from '../utils/nbuRates';
import type {NewTransaction} from '../hooks/useTransactions';
import styles from './Transactions.module.css';
import {useTranslation} from 'react-i18next';
import {Input} from "../components/FormField.tsx";
import {useModalClose} from '../hooks/useModalClose';
import {useSwipeDismiss} from '../hooks/useSwipeDismiss';
import HistoryOnboardingTour from '../components/HistoryOnboardingTour';

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
    const categoryName = useCategoryName();
    const {confirm, node: confirmNode} = useConfirm();
    const [filters, setFilters] = useState<ActiveFilters>(defaultFilters);
    const [showFilterPanel, setShowFilterPanel] = useState(false);
    const [showHistoryIntro, setShowHistoryIntro] = useState(true);
    const [historyTourRunning, setHistoryTourRunning] = useState(false);
    const [historyDemoStage, setHistoryDemoStage] = useState(0);
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
    const [returnTx, setReturnTx] = useState<Transaction | null>(null);
    const [showReturn, setShowReturn] = useState(false);
    const [viewMode, setViewMode] = useState<'list' | 'pie' | 'line'>('list');
    const viewModeBeforeTour = useRef<'list' | 'pie' | 'line'>('list');
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
    const historyTourStorageKey = `pulim:history-onboarding:v2:${user?.uid ?? 'guest'}`;
    const shouldShowHistoryIntro = showHistoryIntro
        && localStorage.getItem(historyTourStorageKey) !== 'seen';

    const startHistoryTour = useCallback(() => {
        viewModeBeforeTour.current = viewMode;
        setShowHistoryIntro(false);
        setHistoryDemoStage(0);
        setHistoryTourRunning(true);
    }, [viewMode]);

    const finishHistoryTour = useCallback(() => {
        localStorage.setItem(historyTourStorageKey, 'seen');
        setHistoryTourRunning(false);
        setHistoryDemoStage(0);
        setShowFilterPanel(false);
        setViewMode(viewModeBeforeTour.current);
    }, [historyTourStorageKey]);

    const neverShowHistoryTour = useCallback(() => {
        localStorage.setItem(historyTourStorageKey, 'seen');
        setShowHistoryIntro(false);
    }, [historyTourStorageKey]);

    const openFilterPanel = useCallback(() => {
        resetFilterClose();
        setShowFilterPanel(true);
    }, [resetFilterClose]);

    const prepareHistoryTourStep = useCallback((stage: number) => {
        setHistoryDemoStage(stage);
        resetFilterClose();
        if (stage === 2) setViewMode('pie');
        else setViewMode('list');
        setShowFilterPanel(stage >= 5);
    }, [resetFilterClose]);

    const demoDateFrom = dayjs(new Date(viewDate.year, viewDate.month, 1)).add(9, 'day').format('YYYY-MM-DD');
    const demoDateTo = dayjs(new Date(viewDate.year, viewDate.month + 1, 0)).format('YYYY-MM-DD');
    const demoFilters = useMemo<ActiveFilters>(() => ({
        types: historyDemoStage >= 5 ? ['expense', 'transfer'] : [],
        categoryIds: historyDemoStage >= 6 ? ['demo-shopping'] : [],
        subcategoryIds: historyDemoStage >= 6 ? ['demo-groceries'] : [],
        cardIds: historyDemoStage >= 7 ? ['demo-tbc', 'demo-cash'] : [],
        dateFrom: historyDemoStage >= 8 ? demoDateFrom : null,
        dateTo: historyDemoStage >= 8 ? demoDateTo : null,
    }), [demoDateFrom, demoDateTo, historyDemoStage]);

    const panelFilters = historyTourRunning ? demoFilters : filters;
    const panelHasAnyFilter = panelFilters.types.length > 0
        || panelFilters.categoryIds.length > 0
        || panelFilters.subcategoryIds.length > 0
        || panelFilters.cardIds.length > 0
        || !!panelFilters.dateFrom
        || !!panelFilters.dateTo;

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

    const demoCategories = useMemo<Category[]>(() => [
        {id: 'demo-shopping', name: t('transactions.filter_tour_demo_shopping'), icon: '🛍️', color: '#FF375F', type: 'expense', userId: 'demo', createdAt: 0},
        {id: 'demo-housing', name: t('transactions.filter_tour_demo_housing'), icon: '🏠', color: '#F97316', type: 'expense', userId: 'demo', createdAt: 0},
        {id: 'demo-food', name: t('transactions.history_tour_demo_food'), icon: '🍔', color: '#30D158', type: 'expense', userId: 'demo', createdAt: 0},
        {id: 'demo-transport', name: t('transactions.history_tour_demo_transport'), icon: '🚕', color: '#5AC8FA', type: 'expense', userId: 'demo', createdAt: 0},
        {id: 'demo-bills', name: t('transactions.history_tour_demo_bills'), icon: '💡', color: '#FFD60A', type: 'expense', userId: 'demo', createdAt: 0},
        {id: 'demo-health', name: t('transactions.history_tour_demo_health'), icon: '🏥', color: '#BF5AF2', type: 'expense', userId: 'demo', createdAt: 0},
        {id: 'demo-salary', name: t('transactions.filter_tour_demo_salary'), icon: '💼', color: '#0A84FF', type: 'income', userId: 'demo', createdAt: 0},
    ], [t]);

    const demoTransactions = useMemo<Transaction[]>(() => {
        const stamp = (day: number, hour: number) => new Date(viewDate.year, viewDate.month, day, hour).getTime();
        const make = (id: string, day: number, amount: number, type: 'income' | 'expense', categoryId: string, cardId: string, extra: Partial<Transaction> = {}): Transaction => ({
            id,
            amount,
            currency: 'UZS',
            type,
            categoryId,
            cardId,
            date: stamp(day, 12),
            createdAt: stamp(day, 12),
            userId: 'demo',
            ...extra,
        });
        return [
            make('demo-01', 2, 24_500_000, 'income', 'demo-salary', 'demo-tbc', {comment: t('transactions.history_tour_demo_main_salary')}),
            make('demo-02', 6, 3_200_000, 'income', 'demo-salary', 'demo-cash', {comment: t('transactions.history_tour_demo_freelance')}),
            make('demo-03', 4, 4_250_000, 'expense', 'demo-housing', 'demo-tbc', {comment: t('transactions.history_tour_demo_rent')}),
            make('demo-04', 10, 1_350_000, 'expense', 'demo-shopping', 'demo-tbc', {subcategoryId: 'demo-groceries', comment: t('transactions.filter_tour_demo_groceries')}),
            make('demo-05', 13, 780_000, 'expense', 'demo-shopping', 'demo-cash', {comment: t('transactions.history_tour_demo_clothes')}),
            make('demo-06', 15, 2_100_000, 'expense', 'demo-food', 'demo-tbc', {comment: t('transactions.history_tour_demo_restaurants')}),
            make('demo-07', 18, 920_000, 'expense', 'demo-transport', 'demo-cash'),
            make('demo-08', 20, 640_000, 'expense', 'demo-bills', 'demo-tbc'),
            make('demo-09', 22, 480_000, 'expense', 'demo-health', 'demo-credit'),
            make('demo-10', 24, 1_100_000, 'expense', 'demo-bills', 'demo-credit', {source: 'debt_payment', sourceLabel: t('transactions.history_tour_demo_debt_one')}),
            make('demo-11', 25, 850_000, 'expense', 'demo-bills', 'demo-tbc', {source: 'debt_payment', sourceLabel: t('transactions.history_tour_demo_debt_two')}),
            make('demo-12', 27, 500_000, 'expense', 'demo-shopping', 'demo-cash', {subcategoryId: 'demo-groceries'}),
            make('demo-13', 28, 750_000, 'expense', 'demo-shopping', 'demo-tbc', {currency: 'USD', amount: 62, baseAmount: 750_000, fxRate: 12_096}),
            make('demo-14', 29, 1_500_000, 'expense', 'demo-shopping', 'demo-tbc', {source: 'transfer', toCardId: 'demo-cash'}),
        ];
    }, [t, viewDate.month, viewDate.year]);

    const demoBudgets = useMemo<Budget[]>(() => [
        {id: 'demo-income', categoryId: '__income__', amount: 28_000_000, currency: 'UZS', userId: 'demo', updatedAt: 0},
        {id: 'demo-shopping-budget', categoryId: 'demo-shopping', amount: 4_000_000, currency: 'UZS', userId: 'demo', updatedAt: 0},
        {id: 'demo-housing-budget', categoryId: 'demo-housing', amount: 5_000_000, currency: 'UZS', userId: 'demo', updatedAt: 0},
        {id: 'demo-other-budget', categoryId: 'demo-food', amount: 3_000_000, currency: 'UZS', userId: 'demo', updatedAt: 0},
    ], []);

    const sourceTransactions = historyTourRunning ? demoTransactions : transactions;
    const displayCategories = historyTourRunning ? demoCategories : categories;
    const displayBudgets = historyTourRunning ? demoBudgets : budgets;
    const activePageFilters = historyTourRunning ? demoFilters : filters;

    const filteredTxs = useMemo(() => {
        return sourceTransactions.filter(t => {
            const d = new Date(t.date);

            if (activePageFilters.dateFrom || activePageFilters.dateTo) {
                if (activePageFilters.dateFrom && d < new Date(activePageFilters.dateFrom + 'T00:00:00')) return false;
                if (activePageFilters.dateTo && d > new Date(activePageFilters.dateTo + 'T23:59:59')) return false;
            } else {
                if (d.getMonth() !== viewDate.month || d.getFullYear() !== viewDate.year) return false;
            }

            if (activePageFilters.types.length > 0) {
                const txKind = t.source === 'transfer' ? 'transfer' : t.type;
                if (!activePageFilters.types.includes(txKind as 'income' | 'expense' | 'transfer')) return false;
            }

            const catActive = activePageFilters.categoryIds.length > 0 || activePageFilters.subcategoryIds.length > 0;
            if (catActive) {
                const matchesDebts = activePageFilters.categoryIds.includes('__debts__') && t.source === 'debt_payment';
                const matchesCat = activePageFilters.categoryIds.includes(t.categoryId);
                const matchesSub = t.subcategoryId != null && activePageFilters.subcategoryIds.includes(t.subcategoryId);
                if (!matchesDebts && !matchesCat && !matchesSub) return false;
            }

            if (activePageFilters.cardIds.length > 0) {
                if (!t.cardId || !activePageFilters.cardIds.includes(t.cardId)) return false;
            }

            return true;
        });
    }, [sourceTransactions, activePageFilters, viewDate]);

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
        const monthTxs = sourceTransactions.filter(t => {
            const d = new Date(t.date);
            return d.getMonth() === viewDate.month && d.getFullYear() === viewDate.year;
        });
        return new Set(monthTxs.map(t => t.categoryId));
    }, [sourceTransactions, viewDate]);

    const monthSubcategoryIds = useMemo(() => {
        const ids = sourceTransactions.flatMap(transaction => {
            const date = new Date(transaction.date);
            if (date.getMonth() !== viewDate.month || date.getFullYear() !== viewDate.year) return [];
            return transaction.subcategoryId ? [transaction.subcategoryId] : [];
        });
        return new Set(ids);
    }, [sourceTransactions, viewDate]);

    const hasDebtTxsThisMonth = useMemo(() => sourceTransactions.some(t => {
        const d = new Date(t.date);
        return t.source === 'debt_payment' && d.getMonth() === viewDate.month && d.getFullYear() === viewDate.year;
    }), [sourceTransactions, viewDate]);

    const hasAnyFilter = filters.types.length > 0 || filters.categoryIds.length > 0 || filters.subcategoryIds.length > 0 || filters.cardIds.length > 0 || !!filters.dateFrom || !!filters.dateTo;
    const displayHasAnyFilter = historyTourRunning ? panelHasAnyFilter : hasAnyFilter;

    const getCategory = (id: string) => displayCategories.find(c => c.id === id);

    if (txLoading || catLoading) return <PageLoader/>;

    const incomeBudget = displayBudgets.find(b => b.categoryId === '__income__')?.amount ?? 0;
    const expenseBudget = displayBudgets.filter(b => b.categoryId !== '__income__').reduce((s, b) => s + b.amount, 0);

    const toggleType = (type: 'income' | 'expense' | 'transfer') =>
        setFilters(f => ({...f, types: f.types.includes(type) ? f.types.filter(x => x !== type) : [...f.types, type]}));

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

    const toggleCard = (id: string) =>
        setFilters(f => ({
            ...f,
            cardIds: f.cardIds.includes(id) ? f.cardIds.filter(x => x !== id) : [...f.cardIds, id]
        }));

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
            {shouldShowHistoryIntro && !historyTourRunning && createPortal(
                <div className={styles.historyTourIntroOverlay}>
                    <div className={`${styles.filterIntroCard} ${styles.historyTourIntroCard}`}>
                        <div className={styles.filterIntroIcon}>✨</div>
                        <div className={styles.filterIntroCopy}>
                            <span className={styles.filterIntroBadge}>{t('transactions.filter_tour_demo_badge')}</span>
                            <h3>{t('transactions.history_tour_intro_title')}</h3>
                            <p>{t('transactions.history_tour_intro_text')}</p>
                        </div>
                        <button className={styles.filterIntroPrimary} onClick={startHistoryTour}>
                            {t('transactions.history_tour_start')}
                        </button>
                        <div className={styles.filterIntroSecondaryRow}>
                            <button onClick={() => setShowHistoryIntro(false)}>
                                {t('transactions.filter_tour_not_now')}
                            </button>
                            <button onClick={neverShowHistoryTour}>
                                {t('transactions.filter_tour_never')}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body,
            )}

            {/* Month nav */}
            <div className={styles.monthNav}>
                <button aria-label={t('common.prev_month')} onClick={prevMonth}><HiChevronLeft size={20}/></button>
                <span>{monthLabel}</span>
                <button aria-label={t('common.next_month')} onClick={nextMonth}><HiChevronRight size={20}/></button>
                <button
                    className={styles.historyTourHelpBtn}
                    onClick={startHistoryTour}
                    title={t('transactions.history_tour_replay')}
                    aria-label={t('transactions.history_tour_replay')}
                >
                    <HiQuestionMarkCircle size={20}/>
                </button>
                <button
                    className={`${styles.filterIconBtn} ${displayHasAnyFilter ? styles.filterIconActive : ''}`}
                    onClick={openFilterPanel}
                    aria-label={t('transactions.filter_title')}
                    data-history-tour="filter-button"
                >
                    <HiAdjustmentsHorizontal size={19}/>
                    {displayHasAnyFilter && <span className={styles.filterBadge}/>}
                </button>
            </div>

            {/* Active filter chips */}
            {!historyTourRunning && hasAnyFilter && (
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

            {/* Monthly summary */}
            <div className={styles.summaryRow} data-history-tour="summary">
                <div className={styles.summaryItem}>
                    <p className={styles.summaryLabel}>{t('common.income')}</p>
                    <p className={styles.summaryIncome}>{formatAmount(summaryTotals.income)}</p>
                    {!displayHasAnyFilter && incomeBudget > 0 &&
                        <p className={styles.summaryBudget}>/ {formatAmount(incomeBudget)}</p>}
                </div>
                <div className={styles.summarySep}/>
                <div className={styles.summaryItem}>
                    <p className={styles.summaryLabel}>{t('common.expenses')}</p>
                    <p className={`${styles.summaryExpense} ${!displayHasAnyFilter && expenseBudget > 0 && summaryTotals.expense > expenseBudget ? styles.summaryOver : ''}`}>
                        {formatWithMinus(summaryTotals.expense)}
                    </p>
                    {!displayHasAnyFilter && expenseBudget > 0 &&
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

            <div className={styles.viewSwitcher} data-history-tour="views">
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
                        filters={activePageFilters}
                        transactions={filteredTxs}
                        categories={displayCategories}
                        budgets={displayBudgets}
                        viewDate={viewDate}
                        demoMode={historyTourRunning}
                    />
                </div>
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
                                            const remaining = tx.type === 'expense' ? tx.amount - (tx.returnedAmount ?? 0) : null;
                                            return (
                                                <div
                                                    key={tx.id}
                                                    className={styles.txRow}
                                                    data-history-tour={tx.id === 'demo-01' ? 'list' : undefined}
                                                >
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
                                                            <p className={styles.txRefundNote}>
                                                                {t('return.returned_badge', {amount: formatAmount(tx.returnedAmount!, tx.currency)})}
                                                                {remaining !== null && remaining > 0 && ` · ${t('return.remaining_left', {amount: formatAmount(remaining, tx.currency)})}`}
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
                                                                    aria-label={t('common.edit')}
                                                                    onClick={() => setEditingTx(tx)}>
                                                                <HiPencil size={13}/>
                                                            </button>
                                                            <button className={styles.delBtn}
                                                                    aria-label={t('common.delete')}
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

            {/* Filter Panel */}
            {showFilterPanel && createPortal(
                <div
                    className={`${styles.filterOverlay} ${isFilterClosing ? styles.filterOverlayClosing : ''}`}
                    onClick={historyTourRunning ? undefined : closeFilterPanel}
                >
                    <div className={styles.filterSwipeLayer} style={filterSwipeStyle}>
                        <div
                            ref={filterSwipeRef}
                            className={`${styles.filterPanel} ${isFilterClosing ? styles.filterPanelClosing : ''}`}
                            onClick={event => event.stopPropagation()}
                            {...(historyTourRunning ? {} : filterSwipeProps)}
                        >
                            <div className={styles.filterSwipeArea}>
                                <div className={styles.filterHandle}/>
                                <div className={styles.filterPanelHeader}>
                                    <span className={styles.filterPanelTitle}>{t('transactions.filter_title')}</span>
                                    {!historyTourRunning && panelHasAnyFilter && (
                                        <button className={styles.clearAllBtn} onClick={() => setFilters(defaultFilters)}>
                                            {t('transactions.filter_clear_all')}
                                        </button>
                                    )}
                                    <button className={styles.closePanelBtn} aria-label={t('common.close')} onClick={closeFilterPanel} disabled={historyTourRunning}>
                                        <HiXMark size={20}/>
                                    </button>
                                </div>
                            </div>

                        {/* Type */}
                        <div className={styles.filterSection} data-filter-tour="types">
                            <p className={styles.filterSectionLabel}>{t('transactions.filter_section_type')}</p>
                            <div className={styles.typeRow}>
                                {(['income', 'expense', 'transfer'] as const).map(type => (
                                    <button
                                        key={type}
                                        className={`${styles.typeBtn} ${panelFilters.types.includes(type) ? styles.typeBtnActive : ''}`}
                                        onClick={() => historyTourRunning ? undefined : toggleType(type)}
                                    >
                                        {type === 'income' ? t('transactions.filter_type_income') : type === 'expense' ? t('transactions.filter_type_expense') : t('transactions.filter_type_transfer')}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Category */}
                        <div className={styles.filterSection} data-filter-tour="categories">
                            <p className={styles.filterSectionLabel}>{t('transactions.filter_section_category')}</p>
                            <div className={styles.filterList}>
                                {historyTourRunning ? (
                                    [
                                        {id: 'demo-shopping', icon: '🛍️', label: t('transactions.filter_tour_demo_shopping'), sub: false},
                                        {id: 'demo-groceries', icon: '🥗', label: t('transactions.filter_tour_demo_groceries'), sub: true},
                                        {id: 'demo-housing', icon: '🏠', label: t('transactions.filter_tour_demo_housing'), sub: false},
                                        {id: 'demo-salary', icon: '💼', label: t('transactions.filter_tour_demo_salary'), sub: false},
                                    ].map(item => {
                                        const active = item.sub
                                            ? panelFilters.subcategoryIds.includes(item.id)
                                            : panelFilters.categoryIds.includes(item.id);
                                        return (
                                            <button
                                                key={item.id}
                                                className={`${styles.filterListItem} ${item.sub ? styles.filterListItemSub : ''} ${active ? styles.filterListItemActive : ''}`}
                                            >
                                                <span>{item.sub && <span className={styles.filterSubBranch}>↳</span>} {item.icon} {item.label}</span>
                                                {active && <span className={styles.checkMark}>✓</span>}
                                            </button>
                                        );
                                    })
                                ) : (
                                    <>
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
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Account */}
                        {(historyTourRunning || cards.length > 0) && (
                            <div className={styles.filterSection} style={{ position: 'relative' }} data-filter-tour="accounts">
                                <p className={styles.filterSectionLabel} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    {t('transactions.filter_section_account')}
                                    {!historyTourRunning && !isPremium && <PremiumBadge />}
                                </p>
                                <div className={styles.filterList} style={!historyTourRunning && !isPremium ? { filter: 'blur(2px)', pointerEvents: 'none' } : undefined}>
                                    {historyTourRunning ? (
                                        [
                                            {id: 'demo-tbc', icon: '💳', label: t('transactions.filter_tour_demo_tbc')},
                                            {id: 'demo-cash', icon: '💵', label: t('transactions.filter_tour_demo_cash')},
                                            {id: 'demo-credit', icon: '💳', label: t('transactions.filter_tour_demo_credit')},
                                        ].map(card => {
                                            const active = panelFilters.cardIds.includes(card.id);
                                            return (
                                                <button
                                                    key={card.id}
                                                    className={`${styles.filterListItem} ${active ? styles.filterListItemActive : ''}`}
                                                >
                                                    <span>{card.icon} {card.label}</span>
                                                    {active && <span className={styles.checkMark}>✓</span>}
                                                </button>
                                            );
                                        })
                                    ) : cards.map(card => {
                                        const active = panelFilters.cardIds.includes(card.id);
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
                                {!historyTourRunning && !isPremium && (
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
                        <div className={styles.filterSection} data-filter-tour="dates">
                            <p className={styles.filterSectionLabel}>{t('transactions.filter_section_date')}</p>
                            <div className={styles.dateRow}>
                                <div className={styles.dateField}>
                                    <label className={styles.dateLabel}>{t('transactions.filter_date_from')}</label>
                                    <Input
                                        type="date"
                                        className={styles.dateInput}
                                        value={panelFilters.dateFrom ?? ''}
                                        onChange={e => historyTourRunning ? undefined : setFilters(f => ({...f, dateFrom: e.target.value || null}))}
                                    />
                                </div>
                                <div className={styles.dateField}>
                                    <label className={styles.dateLabel}>{t('transactions.filter_date_to')}</label>
                                    <Input
                                        type="date"
                                        className={styles.dateInput}
                                        value={panelFilters.dateTo ?? ''}
                                        onChange={e => historyTourRunning ? undefined : setFilters(f => ({...f, dateTo: e.target.value || null}))}
                                    />
                                </div>
                            </div>
                        </div>

                        {historyTourRunning && (
                            <div className={styles.filterDemoResult} data-filter-tour="result">
                                <div className={styles.filterDemoResultIcon}>✓</div>
                                <div>
                                    <strong>{t('transactions.filter_tour_demo_result', {count: filteredTxs.length, total: demoTransactions.length})}</strong>
                                    <p>{t('transactions.filter_tour_demo_result_hint')}</p>
                                </div>
                            </div>
                        )}
                        </div>
                    </div>
                </div>,
                document.body,
            )}

            <HistoryOnboardingTour
                run={historyTourRunning}
                onPrepareStep={prepareHistoryTourStep}
                onFinish={finishHistoryTour}
            />

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
