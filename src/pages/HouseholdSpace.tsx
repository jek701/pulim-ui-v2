import { useMemo, useState } from 'react';
import {
  HiArrowTrendingDown,
  HiBanknotes,
  HiChevronRight,
  HiCreditCard,
  HiEye,
  HiEyeSlash,
  HiFlag,
  HiPlus,
  HiPencil,
  HiShieldCheck,
  HiTrash,
  HiUsers,
} from 'react-icons/hi2';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context';
import { useHousehold } from '../hooks/useHousehold';
import { useCards } from '../hooks/useCards';
import { FREE_LIMITS, useEntitlements } from '../hooks/useEntitlements';
import { useCategoryName } from '../utils/categoryName';
import { formatAmount, formatDate, formatMonth, formatTime } from '../utils/format';
import type { Budget, Card, Category, Transaction } from '../types';
import AddTransactionModal from '../components/AddTransactionModal';
import AccountFormModal from '../components/accounts/AccountFormModal';
import AccountPlastic, { HIDDEN_AMOUNT } from '../components/accounts/AccountPlastic';
import PageLoader from '../components/PageLoader';
import { useConfirm } from '../components/ConfirmDialog';
import { usePremiumGate } from '../components/PremiumLock';
import GoalPlastic from '../components/savings/GoalPlastic';
import GoalSheet from '../components/savings/GoalSheet';
import GoalFormModal from '../components/savings/GoalFormModal';
import ContributeModal from '../components/savings/ContributeModal';
import WorkspaceSwitcher from '../components/WorkspaceSwitcher';
import styles from './HouseholdSpace.module.css';

const HouseholdSpace = () => {
  const { user, activeTab } = useApp();
  const family = useHousehold(user?.uid ?? null);
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  if (family.householdLoading || (family.household && family.spaceLoading)) return <PageLoader />;
  if (!family.household) return null;

  const transactionModal = (showAddTransaction || editingTransaction) && (
    <AddTransactionModal
      categories={family.categories}
      subcategories={[]}
      transactions={family.transactions}
      cards={family.cards}
      cardOrder={[]}
      initialData={editingTransaction ?? undefined}
      onAdd={editingTransaction
        ? data => family.updateTransaction(editingTransaction.id, data)
        : family.addTransaction}
      onClose={() => { setShowAddTransaction(false); setEditingTransaction(null); }}
      onSaveCardOrder={async () => undefined}
    />
  );

  if (activeTab === 'transactions') return <><FamilyTransactions family={family} onAdd={() => setShowAddTransaction(true)} onEdit={setEditingTransaction} />{transactionModal}</>;
  if (activeTab === 'cards') return <FamilyAccounts family={family} />;
  if (activeTab === 'settings') return <FamilySettings family={family} />;
  return <><FamilyHome family={family} onAdd={() => setShowAddTransaction(true)} />{transactionModal}</>;
};

type FamilyState = ReturnType<typeof useHousehold>;

const currentMonthTransactions = (transactions: Transaction[]) => {
  const now = new Date();
  return transactions.filter(transaction => {
    const date = new Date(transaction.date);
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  });
};

const transactionValue = (transaction: Transaction) => transaction.currency === 'UZS'
  ? transaction.amount
  : transaction.baseAmount ?? 0;

const expenseTotal = (transactions: Transaction[]) => transactions.reduce((sum, transaction) => {
  if (transaction.source === 'transfer') return sum;
  if (transaction.source === 'return') return sum - transactionValue(transaction);
  return transaction.type === 'expense' ? sum + transactionValue(transaction) : sum;
}, 0);

const FamilyHome = ({ family, onAdd }: { family: FamilyState; onAdd: () => void }) => {
  const { t, i18n } = useTranslation();
  const categoryName = useCategoryName();
  const monthTransactions = useMemo(() => currentMonthTransactions(family.transactions), [family.transactions]);
  const spent = expenseTotal(monthTransactions);
  const budgetTotal = family.budgets
    .filter(budget => budget.categoryId !== '__income__')
    .reduce((sum, budget) => sum + budget.amount, 0);
  const sharedAccounts = family.cards.filter(card => card.isHouseholdAccount);
  const sharedFunds = sharedAccounts.reduce((sum, card) => sum + (card.currency === 'UZS' ? card.balance : 0), 0);
  const progress = budgetTotal > 0 ? Math.min(100, (spent / budgetTotal) * 100) : 0;
  const recent = family.transactions.slice(0, 6);
  const monthLabel = formatMonth(new Date(), i18n.language);

  const budgetRows = family.budgets
    .filter(budget => budget.amount > 0 && budget.categoryId !== '__income__')
    .map(budget => {
      const category = family.categories.find(item => item.id === budget.categoryId);
      const categorySpent = expenseTotal(monthTransactions.filter(item => item.categoryId === budget.categoryId));
      return { budget, category, spent: categorySpent };
    })
    .filter((row): row is { budget: Budget; category: Category; spent: number } => Boolean(row.category))
    .sort((a, b) => (b.spent / b.budget.amount) - (a.spent / a.budget.amount))
    .slice(0, 4);

  return (
    <div className={styles.page}>
      <header className={styles.heroHeader}>
        <div>
          <p>{t('family.shared_budget')}</p>
          <h1>{family.household?.name}</h1>
        </div>
        <div className={styles.avatars}>
          {family.household?.members.map(member => (
            <span key={member.userId} title={member.name}>{member.name.slice(0, 1).toUpperCase()}</span>
          ))}
        </div>
      </header>

      <section className={styles.overviewCard}>
        <div className={styles.overviewTop}>
          <span>{t('family.month_plan', { month: monthLabel })}</span>
          <HiUsers size={18} />
        </div>
        <strong>{budgetTotal > 0 ? formatAmount(Math.max(0, budgetTotal - spent)) : formatAmount(spent)}</strong>
        <p>{budgetTotal > 0 ? t('family.left_from_budget', { total: formatAmount(budgetTotal) }) : t('family.spent_without_plan')}</p>
        <div className={styles.progress}><i style={{ width: `${progress}%` }} /></div>
        <div className={styles.overviewStats}>
          <div><span>{t('common.expenses')}</span><b>−{formatAmount(spent)}</b></div>
          <div><span>{t('family.shared_money')}</span><b>{formatAmount(sharedFunds)}</b></div>
        </div>
      </section>

      <div className={styles.quickActions}>
        <button type="button" onClick={onAdd}><span><HiPlus size={19} /></span><b>{t('family.add_expense')}</b><small>{t('family.any_payment_source')}</small></button>
        <button type="button" onClick={() => document.getElementById('family-budget-progress')?.scrollIntoView({ behavior: 'smooth' })}>
          <span><HiArrowTrendingDown size={19} /></span><b>{t('family.check_limits')}</b><small>{t('family.month_control')}</small>
        </button>
      </div>

      {budgetRows.length > 0 && (
        <section id="family-budget-progress" className={styles.section}>
          <div className={styles.sectionHeader}><h2>{t('family.category_limits')}</h2><span>{monthLabel}</span></div>
          <div className={styles.budgetList}>
            {budgetRows.map(({ budget, category, spent: categorySpent }) => {
              const ratio = Math.min(100, (categorySpent / budget.amount) * 100);
              const over = categorySpent > budget.amount;
              return (
                <div className={styles.budgetRow} key={budget.id}>
                  <span className={styles.categoryIcon} style={{ background: `${category.color}22` }}>{category.icon}</span>
                  <div className={styles.budgetMain}>
                    <div><b>{categoryName(category)}</b><span className={over ? styles.negative : ''}>{formatAmount(categorySpent)} / {formatAmount(budget.amount)}</span></div>
                    <div className={styles.budgetBar}><i style={{ width: `${ratio}%`, background: over ? 'var(--expense)' : category.color }} /></div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className={styles.section}>
        <div className={styles.sectionHeader}><h2>{t('family.recent_activity')}</h2></div>
        {recent.length === 0 ? (
          <div className={styles.empty}><span>👋</span><b>{t('family.no_activity')}</b><p>{t('family.no_activity_hint')}</p></div>
        ) : (
          <div className={styles.transactionList}>
            {recent.map(transaction => <FamilyTransactionRow key={transaction.id} transaction={transaction} cards={family.cards} categories={family.categories} />)}
          </div>
        )}
      </section>
    </div>
  );
};

const FamilyTransactionRow = ({ transaction, cards, categories, onEdit, onDelete }: {
  transaction: Transaction;
  cards: Card[];
  categories: Category[];
  onEdit?: () => void;
  onDelete?: () => void;
}) => {
  const { t, i18n } = useTranslation();
  const categoryName = useCategoryName();
  const category = categories.find(item => item.id === transaction.categoryId);
  const card = cards.find(item => item.id === transaction.cardId);
  const source = card?.isHouseholdAccount
    ? card.name
    : transaction.accountOwnerName
      ? t('family.member_card', { name: transaction.accountOwnerName })
      : t('family.personal_money');
  return (
    <div className={styles.transactionRow}>
      <span className={styles.categoryIcon} style={{ background: `${category?.color ?? '#7c3aed'}22` }}>{category?.icon ?? '💸'}</span>
      <div className={styles.transactionMain}>
        <div><b>{category ? categoryName(category) : transaction.sourceLabel || t('common.transaction')}</b><span>{formatTime(transaction.createdAt, i18n.language)}</span></div>
        <p>{source} · {transaction.createdByName || t('family.member')}</p>
        {transaction.comment && <small>{transaction.comment}</small>}
      </div>
      <div className={styles.transactionAmount}>
        <b className={transaction.type === 'income' ? styles.positive : styles.negative}>
          {transaction.type === 'income' ? '+' : '−'}{formatAmount(transaction.amount, transaction.currency)}
        </b>
        {(onEdit || onDelete) && <div className={styles.transactionActions}>
          {onEdit && <button type="button" aria-label={t('common.edit')} onClick={onEdit}><HiPencil size={14} /></button>}
          {onDelete && <button type="button" aria-label={t('common.delete')} onClick={onDelete}><HiTrash size={14} /></button>}
        </div>}
      </div>
    </div>
  );
};

const FamilyTransactions = ({ family, onAdd, onEdit }: {
  family: FamilyState;
  onAdd: () => void;
  onEdit: (transaction: Transaction) => void;
}) => {
  const { t, i18n } = useTranslation();
  const { confirm, node } = useConfirm();
  const [monthOffset, setMonthOffset] = useState(0);
  const viewDate = useMemo(() => {
    const date = new Date();
    date.setMonth(date.getMonth() + monthOffset);
    return date;
  }, [monthOffset]);
  const visible = family.transactions.filter(transaction => {
    const date = new Date(transaction.date);
    return date.getMonth() === viewDate.getMonth() && date.getFullYear() === viewDate.getFullYear();
  });
  const income = visible.filter(item => item.type === 'income' && item.source !== 'return').reduce((sum, item) => sum + transactionValue(item), 0);
  const expense = expenseTotal(visible);
  const groups = new Map<string, Transaction[]>();
  visible.forEach(transaction => {
    const key = formatDate(transaction.date, i18n.language, t('common.today_label'), t('common.yesterday_label'));
    groups.set(key, [...(groups.get(key) ?? []), transaction]);
  });
  const remove = async (transaction: Transaction) => {
    const ok = await confirm({ title: t('family.delete_transaction'), message: formatAmount(transaction.amount, transaction.currency), confirmLabel: t('common.delete') });
    if (ok) await family.removeTransaction(transaction.id);
  };

  return (
    <div className={styles.page}>
      <div className={styles.monthNav}>
        <button type="button" onClick={() => setMonthOffset(value => value - 1)}>‹</button>
        <strong>{formatMonth(viewDate, i18n.language)}</strong>
        <button type="button" onClick={() => setMonthOffset(value => value + 1)}>›</button>
      </div>
      <div className={styles.summaryStrip}>
        <div><span>{t('common.income')}</span><b className={styles.positive}>+{formatAmount(income)}</b></div>
        <i />
        <div><span>{t('common.expenses')}</span><b className={styles.negative}>−{formatAmount(expense)}</b></div>
        <i />
        <div><span>{t('common.net')}</span><b>{formatAmount(income - expense)}</b></div>
      </div>
      {groups.size === 0 ? (
        <div className={styles.emptyPage}><span>🧾</span><h2>{t('family.no_transactions')}</h2><p>{t('family.no_transactions_hint')}</p></div>
      ) : Array.from(groups.entries()).map(([label, items]) => (
        <section className={styles.transactionGroup} key={label}>
          <p>{label}</p>
          <div className={styles.transactionList}>
            {items.map(transaction => (
              <FamilyTransactionRow
                key={transaction.id}
                transaction={transaction}
                cards={family.cards}
                categories={family.categories}
                onEdit={transaction.source ? undefined : () => onEdit(transaction)}
                onDelete={transaction.source ? undefined : () => remove(transaction)}
              />
            ))}
          </div>
        </section>
      ))}
      <button className={styles.fab} type="button" onClick={onAdd}><HiPlus size={20} />{t('family.add_operation')}</button>
      {node}
    </div>
  );
};

type FamilyGoalOverlay =
  | { kind: 'sheet'; id: string }
  | { kind: 'add' }
  | { kind: 'edit'; id: string }
  | { kind: 'contribute'; id: string }
  | null;

const FamilyAccounts = ({ family }: { family: FamilyState }) => {
  const { t } = useTranslation();
  const { isPremium } = useEntitlements();
  const premiumGate = usePremiumGate();
  const { confirm, node: confirmNode } = useConfirm();
  const [showAdd, setShowAdd] = useState(false);
  const [goalOverlay, setGoalOverlay] = useState<FamilyGoalOverlay>(null);
  const shared = family.cards.filter(card => card.isHouseholdAccount);
  const personal = family.cards.filter(card => !card.isHouseholdAccount);
  const selectedGoal = goalOverlay && 'id' in goalOverlay
    ? family.goals.find(goal => goal.id === goalOverlay.id)
    : undefined;
  const contributionCards = selectedGoal
    ? family.cards.filter(card => card.currency === selectedGoal.currency)
    : [];

  // Shared accounts follow the same free-plan limits as personal ones.
  const requestAdd = () => {
    if (!isPremium && shared.length >= FREE_LIMITS.cards) {
      premiumGate.open('cards');
      return;
    }
    setShowAdd(true);
  };

  const removeGoal = async (id: string) => {
    const goal = family.goals.find(item => item.id === id);
    if (!goal) return;
    setGoalOverlay(null);
    const ok = await confirm({
      title: t('savings.confirm_delete'),
      message: `${goal.name} · ${formatAmount(goal.savedAmount, goal.currency)} / ${formatAmount(goal.targetAmount, goal.currency)}`,
      warning: t('common.action_irreversible'),
      confirmLabel: t('common.delete'),
    });
    if (ok) await family.removeGoal(id);
  };

  return (
    <div className={styles.page}>
      <header className={styles.pageTitle}><div><p>{t('family.shared_budget')}</p><h1>{t('family.payment_sources')}</h1></div><HiShieldCheck size={24} /></header>
      <div className={styles.infoBanner}><HiShieldCheck size={20} /><p><b>{t('family.accounts_private_title')}</b>{t('family.accounts_private_desc')}</p></div>

      <section className={styles.accountSection}>
        <div className={styles.sectionHeader}><h2>{t('family.common_accounts')}</h2><span>{shared.length}</span></div>
        {shared.length ? shared.map(card => <AccountPlastic key={card.id} card={card} />) : (
          <button className={styles.addAccountEmpty} type="button" onClick={requestAdd}><HiBanknotes size={25} /><b>{t('family.add_common_account')}</b><span>{t('family.add_common_account_hint')}</span></button>
        )}
      </section>

      <section className={styles.accountSection}>
        <div className={styles.sectionHeader}><h2>{t('family.available_personal_cards')}</h2><span>{personal.length}</span></div>
        {personal.length ? <div className={styles.personalCards}>{personal.map(card => (
          <div className={styles.personalCard} key={card.id}>
            <span className={styles.cardIcon}><HiCreditCard size={20} /></span>
            <div><b>{card.name}</b><p>{card.ownerName} · {card.bank || card.currency}</p></div>
            <strong>{card.balanceHidden ? HIDDEN_AMOUNT : formatAmount(card.balance, card.currency)}</strong>
          </div>
        ))}</div> : <p className={styles.mutedHint}>{t('family.no_shared_cards')}</p>}
      </section>

      <section className={styles.accountSection}>
        <div className={styles.sectionHeader}>
          <div><h2>{t('family.shared_goals')}</h2><p>{t('family.shared_goals_hint')}</p></div>
          <button className={styles.sectionAction} type="button" onClick={() => setGoalOverlay({ kind: 'add' })}>
            <HiPlus size={15} />{t('common.add')}
          </button>
        </div>
        {family.goals.length ? (
          <div className={styles.goalList}>
            {family.goals.map(goal => (
              <button key={goal.id} type="button" onClick={() => setGoalOverlay({ kind: 'sheet', id: goal.id })}>
                <GoalPlastic goal={goal} />
              </button>
            ))}
          </div>
        ) : (
          <button className={styles.goalEmpty} type="button" onClick={() => setGoalOverlay({ kind: 'add' })}>
            <HiFlag size={24} /><b>{t('family.add_shared_goal')}</b><span>{t('family.add_shared_goal_hint')}</span>
          </button>
        )}
      </section>

      {shared.length > 0 && <button className={styles.fab} type="button" onClick={requestAdd}><HiPlus size={20} />{t('family.add_common_account')}</button>}
      {showAdd && <AccountFormModal isPremium={isPremium} onLockedType={() => premiumGate.open('credit_cash')} onAdd={family.addSharedCard} onClose={() => setShowAdd(false)} />}
      {goalOverlay?.kind === 'sheet' && selectedGoal && (
        <GoalSheet
          goal={selectedGoal}
          onContribute={() => setGoalOverlay({ kind: 'contribute', id: selectedGoal.id })}
          onEdit={() => setGoalOverlay({ kind: 'edit', id: selectedGoal.id })}
          onDelete={() => void removeGoal(selectedGoal.id)}
          onClose={() => setGoalOverlay(null)}
        />
      )}
      {goalOverlay?.kind === 'add' && <GoalFormModal onAdd={family.addGoal} onClose={() => setGoalOverlay(null)} />}
      {goalOverlay?.kind === 'edit' && selectedGoal && (
        <GoalFormModal goal={selectedGoal} onUpdate={family.updateGoal} onClose={() => setGoalOverlay(null)} />
      )}
      {goalOverlay?.kind === 'contribute' && selectedGoal && (
        <ContributeModal
          goal={selectedGoal}
          cards={contributionCards}
          onContribute={(amount, cardId) => family.contributeGoal(selectedGoal.id, amount, cardId)}
          onClose={() => setGoalOverlay(null)}
        />
      )}
      {premiumGate.node}
      {confirmNode}
    </div>
  );
};

const FamilySettings = ({ family }: { family: FamilyState }) => {
  const { t } = useTranslation();
  const { user, saveProfile } = useApp();
  const personalCards = useCards(user?.uid ?? null);
  const ownMember = family.household?.members.find(member => member.userId === user?.uid);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(ownMember?.name ?? '');
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState(false);

  const saveName = async () => {
    const name = nameDraft.trim();
    if (!name || nameSaving) return;
    setNameSaving(true);
    setNameError(false);
    try {
      await saveProfile({ name });
      await family.refresh();
      setEditingName(false);
    } catch {
      setNameError(true);
    } finally {
      setNameSaving(false);
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.pageTitle}><div><p>{t('family.shared_budget')}</p><h1>{t('family.settings')}</h1></div><HiUsers size={24} /></header>

      <section className={styles.workspaceSettings}>
        <WorkspaceSwitcher />
      </section>

      <section className={styles.settingsCard}>
        <div className={styles.settingsHeading}><div><h2>{t('family.members')}</h2><p>{t('family.members_hint')}</p></div><span>{family.household?.members.length}/2</span></div>
        <div className={styles.memberGrid}>{family.household?.members.map(member => (
          <div key={member.userId}>
            <span>{member.name.slice(0, 1).toUpperCase()}</span>
            <b>{member.name}</b>
            <small>{t(`family.role_${member.role}`)}</small>
            {member.userId === user?.uid && (
              <button
                className={styles.memberEdit}
                type="button"
                aria-label={t('family.edit_your_name')}
                onClick={() => {
                  setNameDraft(member.name);
                  setNameError(false);
                  setEditingName(value => !value);
                }}
              ><HiPencil size={13} />{t('common.edit')}</button>
            )}
          </div>
        ))}</div>
        {editingName && (
          <div className={styles.memberNameEditor}>
            <p>{t('family.member_name_hint')}</p>
            <div>
              <input
                autoFocus
                value={nameDraft}
                maxLength={60}
                onChange={event => setNameDraft(event.target.value)}
                onKeyDown={event => { if (event.key === 'Enter') void saveName(); }}
              />
              <button type="button" disabled={!nameDraft.trim() || nameSaving} onClick={() => void saveName()}>
                {nameSaving ? t('common.saving') : t('common.save')}
              </button>
            </div>
            {nameError && <span>{t('common.error_save')}</span>}
          </div>
        )}
      </section>

      <section className={styles.settingsCard}>
        <div className={styles.settingsHeading}><div><h2>{t('family.personal_card_access')}</h2><p>{t('family.personal_card_access_hint')}</p></div><HiShieldCheck size={21} /></div>
        <div className={styles.accessList}>
          {personalCards.cards.map(card => {
            const enabled = card.familyAccess?.householdId === family.household?.id && card.familyAccess?.enabled === true;
            const showBalance = enabled && card.familyAccess?.showBalance === true;
            return (
              <div className={styles.accessCard} key={card.id}>
                <span className={styles.cardIcon}><HiCreditCard size={20} /></span>
                <div><b>{card.name}</b><p>{card.bank || t(`accounts.type_${card.cardType}_title`)}</p></div>
                <button
                  type="button"
                  className={`${styles.accessToggle} ${enabled ? styles.accessToggleOn : ''}`}
                  aria-pressed={enabled}
                  onClick={() => family.setCardAccess(card.id, !enabled, false)}
                ><i /></button>
                {enabled && (
                  <button
                    type="button"
                    className={`${styles.balancePermission} ${showBalance ? styles.balancePermissionOn : ''}`}
                    onClick={() => family.setCardAccess(card.id, true, !showBalance)}
                    title={showBalance ? t('family.hide_balance') : t('family.show_balance')}
                  >{showBalance ? <HiEye size={16} /> : <HiEyeSlash size={16} />}</button>
                )}
              </div>
            );
          })}
          {personalCards.cards.length === 0 && <p className={styles.mutedHint}>{t('family.no_personal_cards')}</p>}
        </div>
        <div className={styles.privacyFooter}><span>🔒</span><p>{t('family.card_privacy_note')}</p></div>
      </section>

      <BudgetSettings family={family} />
    </div>
  );
};

const BudgetSettings = ({ family }: { family: FamilyState }) => {
  const { t } = useTranslation();
  const categoryName = useCategoryName();
  const initial = Object.fromEntries(family.budgets.map(item => [item.categoryId, String(item.amount || '')]));
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [savingId, setSavingId] = useState<string | null>(null);
  const categories = family.categories.filter(category => category.type === 'expense' || category.type === 'both');
  const save = async (category: Category) => {
    const amount = Number(values[category.id] || 0);
    setSavingId(category.id);
    try { await family.setBudget(category.id, amount, family.household?.currency ?? 'UZS'); }
    finally { setSavingId(null); }
  };
  return (
    <section className={styles.settingsCard}>
      <div className={styles.settingsHeading}><div><h2>{t('family.monthly_limits')}</h2><p>{t('family.monthly_limits_hint')}</p></div><HiArrowTrendingDown size={21} /></div>
      <div className={styles.limitEditor}>{categories.map(category => (
        <div key={category.id}>
          <span className={styles.categoryIcon} style={{ background: `${category.color}22` }}>{category.icon}</span>
          <label><b>{categoryName(category)}</b><input inputMode="numeric" placeholder="0" value={values[category.id] ?? ''} onChange={event => setValues(current => ({ ...current, [category.id]: event.target.value.replace(/[^0-9]/g, '') }))} /></label>
          <button type="button" disabled={savingId === category.id} onClick={() => save(category)}>{savingId === category.id ? '…' : <HiChevronRight size={17} />}</button>
        </div>
      ))}</div>
    </section>
  );
};

export default HouseholdSpace;
