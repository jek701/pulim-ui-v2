import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { HiPlus, HiChevronRight } from 'react-icons/hi2';
import { useApp } from '../context';
import { useTransactions } from '../hooks/useTransactions';
import { useCategories } from '../hooks/useCategories';
import { useCards } from '../hooks/useCards';
import { formatAmount, formatDate, formatMonth } from '../utils/format';
import dayjs from '../utils/dayjs';
import { getBudgetForecast } from '../utils/ai';
import { useBudgets } from '../hooks/useBudgets';
import AddTransactionModal from '../components/AddTransactionModal';
import ReturnModal from '../components/ReturnModal';
import PageLoader from '../components/PageLoader';
import ExchangeRatesWidget from '../components/ExchangeRatesWidget';
import AskAIWidget from '../components/AskAIWidget';
import AskAIChat from '../components/AskAIChat';
import type { NewTransaction } from '../hooks/useTransactions';
import type { Currency } from '../types';
import { resolveHomeWidgets, type HomeWidgetId } from '../utils/homeWidgets';
import styles from './Home.module.css';
import {detectScheme} from "../main.tsx";

const Home = () => {
  const { t, i18n } = useTranslation();
  const theme = detectScheme()
  const { user, profile, setActiveTab, setCategoryFilter } = useApp();
  const { transactions, add, returnTransaction, loading: txLoading } = useTransactions(user?.uid ?? null);
  const { categories, subcategories, loading: catLoading } = useCategories(user?.uid ?? null);
  const { cards, cardOrder, saveCardOrder } = useCards(user?.uid ?? null);
  const { budgets, loading: budgetLoading } = useBudgets(user?.uid ?? null);
  const [showAdd, setShowAdd] = useState(false);
  const [showReturn, setShowReturn] = useState(false);
  const [showAskAi, setShowAskAi] = useState(false);
  const [forecast, setForecast] = useState<string | null>(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [showAllBudgets, setShowAllBudgets] = useState(false);

  const now = new Date();
  const userName = profile?.name?.trim()
    || user?.displayName?.trim()
    || user?.email?.split('@')[0]
    || user?.phoneNumber
    || '';

  const monthStats = useMemo(() => {
    const m = now.getMonth(), y = now.getFullYear();
    const uzs = transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === m && d.getFullYear() === y && t.currency === 'UZS';
    });
    const income  = uzs.filter(t => t.type === 'income'  && t.source !== 'transfer').reduce((s, t) => s + t.amount, 0);
    const expense = uzs.filter(t => t.type === 'expense' && t.source !== 'transfer').reduce((s, t) => s + t.amount, 0);
    return { income, expense, balance: income - expense };
  }, [transactions]);

  const includedBalances = useMemo(() => {
    const totals = new Map<Currency, number>();
    cards
      .filter(card => (card.cardType === 'debit' || card.cardType === 'cash') && card.includeInTotalBalance !== false)
      .forEach(card => {
        totals.set(card.currency, (totals.get(card.currency) ?? 0) + card.balance);
      });
    return Array.from(totals.entries()).sort(([left], [right]) => left.localeCompare(right));
  }, [cards]);

  const getCategory = (id: string) => categories.find(c => c.id === id);

  const recentGrouped = useMemo(() => {
    const items = transactions.slice(0, 15);
    const map = new Map<string, typeof transactions>();
    for (const tx of items) {
      const key = formatDate(tx.date);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(tx);
    }
    return Array.from(map.entries());
  }, [transactions]);

  const monthTransactions = useMemo(() => {
    const m = now.getMonth(), y = now.getFullYear();
    return transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === m && d.getFullYear() === y;
    });
  }, [transactions]);

  const budgetRows = useMemo(() => {
    return budgets
      .filter(b => b.categoryId !== '__income__' && b.amount > 0)
      .map(b => {
        const spent = monthTransactions
          .filter(t => t.type === 'expense' && t.categoryId === b.categoryId && t.currency === 'UZS')
          .reduce((s, t) => s + t.amount, 0);
        const cat = categories.find(c => c.id === b.categoryId);
        return { budget: b, cat, spent, pct: Math.min((spent / b.amount) * 100, 100) };
      })
      .filter(r => r.cat)
      .sort((a, b) => {
        const ratioA = a.budget.amount > 0 ? a.spent / a.budget.amount : 0;
        const ratioB = b.budget.amount > 0 ? b.spent / b.budget.amount : 0;
        return ratioB - ratioA;
      });
  }, [budgets, monthTransactions, categories]);

  const TOP_BUDGETS = 5;
  const visibleBudgetRows = showAllBudgets ? budgetRows : budgetRows.slice(0, TOP_BUDGETS);
  const hiddenBudgetCount = budgetRows.length - TOP_BUDGETS;

  const incomeBudget = budgets.find(b => b.categoryId === '__income__');
  const debtBudget = budgets.find(b => b.categoryId === '__debts__');
  const debtSpentThisMonth = monthTransactions
    .filter(t => t.source === 'debt_payment' && t.currency === 'UZS' && t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0);

  const subscriptionBudget = budgets.find(b => b.categoryId === '__subscription__');
  const subscriptionSpentThisMonth = monthTransactions
    .filter(t => t.source === 'subscription' && t.currency === 'UZS')
    .reduce((s, t) => s + t.amount, 0);
  const daysElapsed = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const totalSpentUZS = monthTransactions
    .filter(t => t.type === 'expense' && t.currency === 'UZS' && t.source !== 'transfer')
    .reduce((s, t) => s + t.amount, 0);
  const dailyRate = daysElapsed > 0 ? totalSpentUZS / daysElapsed : 0;
  const projectedTotal = Math.round(dailyRate * daysInMonth);
  const totalBudget = budgets.filter(b => b.categoryId !== '__income__').reduce((s, b) => s + b.amount, 0);
  const expenseBudgetRatio = totalBudget > 0 ? Math.min(monthStats.expense / totalBudget, 1) : 0;
  const expenseSummaryColor = (() => {
    if (theme === 'light') return "black"
    else {
      const start = { r: 255, g: 255, b: 255 };
      const end = { r: 255, g: 107, b: 107 };
      const mix = (from: number, to: number) => Math.round(from + (to - from) * expenseBudgetRatio);
      return `rgb(${mix(start.r, end.r)}, ${mix(start.g, end.g)}, ${mix(start.b, end.b)})`;
    }
  })();

  const handleForecast = async () => {
    setForecastLoading(true);
    setForecast(null);
    try {
      const language = i18n.language === 'ru' ? 'Russian' : i18n.language === 'uz' ? 'Uzbek' : 'English';
      const text = await getBudgetForecast(language);
      setForecast(text);
    } finally {
      setForecastLoading(false);
    }
  };

  const greeting = () => {
    const h = now.getHours();
    if (h < 12) return t('home.greeting_morning');
    if (h < 17) return t('home.greeting_afternoon');
    return t('home.greeting_evening');
  };

  const handleReturn = async (returnAmount: number, originalTxId: string, accountId: string, date: number) => {
    // Atomic server-side return (income transaction + returnedAmount + balance).
    await returnTransaction(originalTxId, { returnAmount, accountId: accountId || undefined, date });
  };

  if (txLoading || catLoading || budgetLoading) return <PageLoader />;

  const monthName = dayjs(now).format('MMMM');

  const widgets = resolveHomeWidgets(profile?.homeWidgets);

  const renderWidget = (id: HomeWidgetId) => {
    switch (id) {
      case 'balance':
        return renderBalance();
      case 'budget':
        return renderBudget();
      case 'forecast':
        return renderForecast();
      case 'askAi':
        return <AskAIWidget onOpen={() => setShowAskAi(true)} />;
      case 'exchangeRates':
        return <ExchangeRatesWidget />;
      case 'recent':
        return renderRecent();
      default:
        return null;
    }
  };

  const renderBalance = () => (
      <div className={styles.balanceCard}>
        <p className={styles.balanceLabel}>{t('home.current_balance_label')}</p>
        {includedBalances.length > 0 ? (
          <div className={styles.balanceAmounts}>
            {includedBalances.map(([currency, amount]) => (
              <p key={currency} className={styles.balance}>
                {formatAmount(amount, currency)}
              </p>
            ))}
          </div>
        ) : (
          <p className={styles.balanceEmpty}>{t('home.current_balance_empty')}</p>
        )}
        <p className={styles.balanceHint}>{t('home.current_balance_hint')}</p>
      </div>
  );

  const renderBudget = () => {
    if (!(budgetRows.length > 0 || incomeBudget || debtBudget || subscriptionBudget)) return null;
    return (
        <div className={styles.budgetCard}>
          <p className={styles.budgetTitle}>{t('home.budget_title', { month: monthName })}</p>

          {visibleBudgetRows.map(({ budget, cat, spent, pct }) => {
            const over = spent > budget.amount;
            return (
              <div
                key={budget.categoryId}
                className={styles.budgetRow}
                onClick={() => { setCategoryFilter(budget.categoryId); setActiveTab('transactions'); }}
                style={{ cursor: 'pointer' }}
              >
                <div className={styles.budgetRowTop}>
                  <span className={styles.budgetCatIcon}>{cat!.icon}</span>
                  <span className={styles.budgetCatName}>{cat!.name}</span>
                  <span className={`${styles.budgetAmt} ${over ? styles.budgetOver : ''}`}>
                    {formatAmount(spent)} / {formatAmount(budget.amount)}
                  </span>
                  <HiChevronRight size={14} className={styles.budgetChevron} />
                </div>
                <div className={styles.budgetBar}>
                  <div
                    className={`${styles.budgetFill} ${over ? styles.budgetFillOver : ''}`}
                    style={{ width: `${pct}%`, background: over ? 'var(--expense)' : cat!.color }}
                  />
                </div>
              </div>
            );
          })}

          {debtBudget && debtBudget.amount > 0 && (
            <div
              className={styles.budgetRow}
              onClick={() => { setCategoryFilter('__debts__'); setActiveTab('transactions'); }}
              style={{ cursor: 'pointer' }}
            >
              <div className={styles.budgetRowTop}>
                <span className={styles.budgetCatIcon}>💳</span>
                <span className={styles.budgetCatName}>{t('home.debt_payments')}</span>
                <span className={`${styles.budgetAmt} ${debtSpentThisMonth > debtBudget.amount ? styles.budgetOver : ''}`}>
                  {formatAmount(debtSpentThisMonth)} / {formatAmount(debtBudget.amount)}
                </span>
                <HiChevronRight size={14} className={styles.budgetChevron} />
              </div>
              <div className={styles.budgetBar}>
                <div
                  className={styles.budgetFill}
                  style={{
                    width: `${Math.min((debtSpentThisMonth / debtBudget.amount) * 100, 100)}%`,
                    background: debtSpentThisMonth > debtBudget.amount ? 'var(--expense)' : 'var(--accent)',
                  }}
                />
              </div>
            </div>
          )}

          {subscriptionBudget && subscriptionBudget.amount > 0 && (
            <div
              className={styles.budgetRow}
              onClick={() => setActiveTab('subscriptions')}
              style={{ cursor: 'pointer' }}
            >
              <div className={styles.budgetRowTop}>
                <span className={styles.budgetCatIcon}>📡</span>
                <span className={styles.budgetCatName}>{t('home.subscription_payments')}</span>
                <span className={`${styles.budgetAmt} ${subscriptionSpentThisMonth > subscriptionBudget.amount ? styles.budgetOver : ''}`}>
                  {formatAmount(subscriptionSpentThisMonth)} / {formatAmount(subscriptionBudget.amount)}
                </span>
                <HiChevronRight size={14} className={styles.budgetChevron} />
              </div>
              <div className={styles.budgetBar}>
                <div
                  className={styles.budgetFill}
                  style={{
                    width: `${Math.min((subscriptionSpentThisMonth / subscriptionBudget.amount) * 100, 100)}%`,
                    background: subscriptionSpentThisMonth > subscriptionBudget.amount ? 'var(--expense)' : 'var(--accent)',
                  }}
                />
              </div>
            </div>
          )}
          {hiddenBudgetCount > 0 && (
              <button
                  className={styles.budgetShowMore}
                  onClick={() => setShowAllBudgets(v => !v)}
                  type="button"
              >
                {showAllBudgets
                    ? t('home.budget_show_less')
                    : t('home.budget_show_more', { count: hiddenBudgetCount })}
              </button>
          )}
          <div className={styles.budgetSummary}>
            <div className={styles.budgetSummaryItem}>
              <p className={styles.budgetSummaryLabel}>{t('common.expenses')}</p>
              <p
                className={styles.budgetSummaryAmount}
                style={{ color: expenseSummaryColor }}
              >
                {formatAmount(monthStats.expense)}
              </p>
            </div>
            <div className={styles.budgetSummaryItem}>
              <p className={styles.budgetSummaryLabel}>{t('common.budget')}</p>
              <p className={styles.budgetSummaryAmount}>{formatAmount(totalBudget)}</p>
            </div>
          </div>
        </div>
    );
  };

  const renderForecast = () => {
    if (!(totalBudget > 0)) return null;
    return (
        <div className={styles.forecastCard}>
          <div className={styles.forecastTop}>
            <div>
              <p className={styles.forecastLabel}>{t('home.forecast_label')}</p>
              <p className={`${styles.forecastAmt} ${projectedTotal > totalBudget ? styles.forecastOver : styles.forecastOk}`}>
                {formatAmount(projectedTotal)}
              </p>
              <p className={styles.forecastSub}>
                {projectedTotal > totalBudget
                  ? t('home.forecast_over', { amount: formatAmount(projectedTotal - totalBudget) })
                  : t('home.forecast_under', { amount: formatAmount(totalBudget - projectedTotal) })}
              </p>
            </div>
            <div className={styles.forecastMeta}>
              <p className={styles.forecastDay}>{t('home.forecast_day', { elapsed: daysElapsed, total: daysInMonth })}</p>
              <p className={styles.forecastRate}>{t('home.forecast_rate', { amount: formatAmount(Math.round(dailyRate)) })}</p>
              <button
                className={`${styles.forecastBtn} ${forecastLoading ? styles.insightBtnLoading : ''}`}
                onClick={handleForecast}
                disabled={forecastLoading}
              >
                {forecastLoading ? '…' : t('home.forecast_ai_btn')}
              </button>
            </div>
          </div>
          {forecast && <p className={styles.forecastText}>{forecast}</p>}
        </div>
    );
  };

  const renderRecent = () => (
      <div className={styles.section}>
        <p className={styles.sectionTitle}>{t('home.recent_title')}</p>
        {recentGrouped.length === 0 ? (
          <div className={styles.empty}>
            <p>🪙</p>
            <p>{t('home.empty_transactions')}</p>
            <p>{t('home.empty_transactions_hint')}</p>
          </div>
        ) : (
          <div className={styles.groups}>
            {recentGrouped.map(([dateLabel, txs]) => (
              <div key={dateLabel} className={styles.dateGroup}>
                <div className={styles.dateHeader}>
                  <span>{dateLabel}</span>
                </div>
                <div className={styles.list}>
                  {txs.map(tx => {
                    const isReturn = tx.source === 'return';
                    const cat = getCategory(tx.categoryId);
                    const icon = isReturn ? '↩' : tx.source === 'debt_payment' ? '💳' : tx.source === 'savings' ? '🐷' : tx.source === 'transfer' ? '🔄' : cat?.icon ?? '📦';
                    const color = isReturn ? '#30d158' : tx.source ? '#636366' : cat?.color ?? '#636366';
                    const name = isReturn ? t('return.history_label') : (tx.sourceLabel ?? cat?.name ?? 'Unknown');
                    return (
                      <div key={tx.id} className={styles.txRow}>
                        <div className={styles.txIcon} style={{ background: color + '22' }}>
                          <span>{icon}</span>
                        </div>
                        <div className={styles.txMid}>
                          <p className={styles.txName}>{name}</p>
                          {tx.comment && <p className={styles.txComment2}>{tx.comment}</p>}
                        </div>
                        <div className={styles.txRight}>
                          <p className={`${styles.txAmount} ${tx.source === 'transfer' ? styles.transfer : tx.type === 'income' ? styles.inc : styles.exp}`}>
                            {tx.source === 'transfer'
                                ? tx.toAmount && tx.toCurrency && tx.toCurrency !== tx.currency
                                    ? `${formatAmount(tx.amount, tx.currency)} → ${formatAmount(tx.toAmount, tx.toCurrency)}`
                                    : formatAmount(tx.amount, tx.currency)
                                : `${tx.type === 'income' ? '+' : '−'}${formatAmount(tx.amount, tx.currency)}`}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
  );

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <p className={styles.greeting}>{greeting()}</p>
          <h1 className={styles.name}>{userName}</h1>
        </div>
        <span className={styles.monthPill}>{formatMonth(now)}</span>
      </div>

      {widgets.filter(w => w.enabled).map(w => (
        <div key={w.id}>{renderWidget(w.id)}</div>
      ))}

      {/* FAB */}
      <button className={styles.fab} onClick={() => setShowAdd(true)}>
        <HiPlus size={26} />
      </button>

      {showAdd && (
        <AddTransactionModal
          categories={categories}
          subcategories={subcategories}
          cards={cards}
          cardOrder={cardOrder}
          onSaveCardOrder={saveCardOrder}
          userId={user?.uid}
          onAdd={async (data: NewTransaction) => {
            // The server adjusts the card balance when cardId is present.
            await add(data);
          }}
          onClose={() => setShowAdd(false)}
          onReturn={() => { setShowAdd(false); setShowReturn(true); }}
        />
      )}

      {showReturn && (
        <ReturnModal
          transactions={transactions}
          categories={categories}
          cards={cards}
          onSave={handleReturn}
          onClose={() => setShowReturn(false)}
        />
      )}

      {showAskAi && <AskAIChat onClose={() => setShowAskAi(false)} />}
    </div>
  );
};

export default Home;
