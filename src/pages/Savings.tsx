import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { HiPlus, HiTrash, HiPlusCircle } from 'react-icons/hi2';
import { useApp } from '../context';
import { useSavingsGoals } from '../hooks/useSavingsGoals';
import type { NewSavingsGoal } from '../hooks/useSavingsGoals';
import { useCards } from '../hooks/useCards';
import { useEntitlements } from '../hooks/useEntitlements';
import { usePremiumGate, PremiumBanner } from '../components/PremiumLock';
import type { SavingsGoal, Currency, Card } from '../types';
import { CURRENCIES } from '../utils/currencies';
import { formatAmount, formatFullDate } from '../utils/format';
import Modal from '../components/Modal';
import { Input, Select } from '../components/FormField';
import { NumberInput } from '../components/NumberInput';
import PageLoader from '../components/PageLoader';
import EmojiInput from '../components/EmojiInput';
import styles from './Savings.module.css';

const SUGGESTED_ICONS = ['🎯', '🏠', '🚗', '✈️', '💻', '📱', '👗', '🎓', '💍', '🏖️', '🛋️', '🎮', '⌚', '📷', '🏋️', '🐕'];

const daysUntil = (deadline: number) => {
  const diff = deadline - Date.now();
  return Math.ceil(diff / 86400000);
};

const monthsUntil = (deadline: number) => {
  const now = new Date();
  const end = new Date(deadline);
  return (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());
};

// ── Add Goal Modal ──────────────────────────────────────────
const AddGoalModal = ({ onSave, onClose }: { onSave: (d: NewSavingsGoal) => Promise<void>; onClose: () => void }) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🎯');
  const [targetAmount, setTargetAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>('UZS');
  const [deadline, setDeadline] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canSave = name.trim() && parseFloat(targetAmount) > 0 && !!deadline;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError('');
    try {
      await onSave({
        name: name.trim(),
        icon,
        targetAmount: parseFloat(targetAmount),
        currency,
        deadline: new Date(deadline).getTime(),
      });
      onClose();
    } catch (err: unknown) {
      setError((err as { message?: string }).message ?? t('common.error_save'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={t('savings.modal_new')}
      onClose={onClose}
      footer={
        <>
          {error && <p className={styles.errorMsg}>{error}</p>}
          <button
            className={`${styles.saveBtn} ${!canSave || saving ? styles.disabled : ''}`}
            onClick={handleSave}
            disabled={!canSave || saving}
          >
            {saving ? t('common.saving') : t('savings.btn_create')}
          </button>
        </>
      }
    >
      <EmojiInput
        label={t('savings.icon_label')}
        value={icon}
        onChange={setIcon}
        suggestions={SUGGESTED_ICONS}
      />

      <Input label={t('savings.goal_name_label')} placeholder={t('savings.goal_name_placeholder')} value={name} onChange={e => setName(e.target.value)} />

      <div>
        <p className={styles.fieldLabel}>{t('savings.target_label')}</p>
        <div className={styles.amountRow}>
          <NumberInput
            className={styles.amountInput}
            placeholder="0"
            value={targetAmount}
            onChange={setTargetAmount}
          />
          <select
            className={styles.currencyPick}
            value={currency}
            onChange={e => setCurrency(e.target.value as Currency)}
          >
            {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
          </select>
        </div>
      </div>

      <Input
        label={t('savings.deadline_label')}
        type="date"
        value={deadline}
        onChange={e => setDeadline(e.target.value)}
      />
    </Modal>
  );
};

// ── Contribute Modal ────────────────────────────────────────
const ContributeModal = ({
  goal,
  cards,
  onContribute,
  onClose,
}: {
  goal: SavingsGoal;
  cards: Card[];
  onContribute: (amount: number, cardId: string) => Promise<void>;
  onClose: () => void;
}) => {
  const { t } = useTranslation();
  const [amount, setAmount] = useState('');
  const [cardId, setCardId] = useState(cards[0]?.id ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const remaining = goal.targetAmount - goal.savedAmount;
  const canSave = parseFloat(amount) > 0 && !!cardId;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError('');
    try {
      await onContribute(parseFloat(amount), cardId);
      onClose();
    } catch (err: unknown) {
      setError((err as { message?: string }).message ?? t('common.error_save'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={t('savings.modal_contribute', { name: goal.name })}
      onClose={onClose}
      footer={
        <>
          {error && <p className={styles.errorMsg}>{error}</p>}
          <button
            className={`${styles.saveBtn} ${!canSave || saving ? styles.disabled : ''}`}
            onClick={handleSave}
            disabled={!canSave || saving}
          >
            {saving ? t('common.saving') : t('savings.btn_add_funds')}
          </button>
        </>
      }
    >
      <div className={styles.contributeInfo}>
        <div className={styles.contributeRow}>
          <span>{t('savings.saved_label')}</span>
          <strong className={styles.savedColor}>{formatAmount(goal.savedAmount, goal.currency)}</strong>
        </div>
        <div className={styles.contributeRow}>
          <span>{t('savings.needed_label')}</span>
          <strong>{formatAmount(remaining > 0 ? remaining : 0, goal.currency)}</strong>
        </div>
      </div>

      <div>
        <p className={styles.fieldLabel}>{t('savings.amount_label', { currency: goal.currency })}</p>
        <div className={styles.amountRow}>
          <NumberInput
            className={styles.amountInput}
            placeholder="0"
            value={amount}
            onChange={setAmount}
            autoFocus
          />
          <span className={styles.currencyLabel}>{goal.currency}</span>
        </div>
      </div>

      <div className={styles.quickRow}>
        {[100000, 500000, 1000000].filter(v => v <= remaining * 2).map(v => (
          <button key={v} className={styles.quickBtn} onClick={() => setAmount(String(v))}>
            +{(v / 1000).toFixed(0)}K
          </button>
        ))}
        {remaining > 0 && (
          <button className={styles.quickBtn} onClick={() => setAmount(String(Math.ceil(remaining)))}>
            Full
          </button>
        )}
      </div>

      {cards.length > 0 && (
        <Select
          label={t('savings.from_card')}
          value={cardId}
          onChange={e => setCardId(e.target.value)}
          options={cards.map(c => ({ value: c.id, label: `${c.name} (${formatAmount(c.balance, c.currency)})` }))}
        />
      )}
    </Modal>
  );
};

// ── Main Page ───────────────────────────────────────────────
const Savings = ({ embedded, addTrigger }: { embedded?: boolean; addTrigger?: number }) => {
  const { t, i18n } = useTranslation();
  const { user } = useApp();
  const { goals, loading, add, contribute, remove } = useSavingsGoals(user?.uid ?? null);
  const { cards } = useCards(user?.uid ?? null);
  const { isPremium } = useEntitlements();
  const premiumGate = usePremiumGate();
  const [showAdd, setShowAdd] = useState(false);
  const [contributing, setContributing] = useState<SavingsGoal | null>(null);

  useEffect(() => {
    if (addTrigger && addTrigger > 0) {
      if (!isPremium) { premiumGate.open('savings'); return; }
      setShowAdd(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addTrigger]);

  const handleDelete = (id: string) => {
    if (confirm(t('savings.confirm_delete'))) remove(id);
  };

  const handleContribute = async (goal: SavingsGoal, amount: number, cardId: string) => {
    // Atomic: increment savedAmount + optional account debit + transaction, server-side.
    await contribute(goal.id, amount, cardId || undefined);
  };

  const totalGoals = goals.length;
  const completedGoals = goals.filter(g => g.savedAmount >= g.targetAmount).length;

  if (loading) return <PageLoader />;

  const content = (
    <>
      {!embedded && (
        <div className={styles.header}>
          <div>
            <h1>{t('savings.heading')}</h1>
            {totalGoals > 0 && (
              <p className={styles.headerSub}>{t('savings.goals_progress', { done: completedGoals, total: totalGoals })}</p>
            )}
          </div>
          <button className={styles.addBtn} onClick={() => { if (!isPremium) { premiumGate.open('savings'); return; } setShowAdd(true); }}>
            <HiPlus size={18} /> {t('accounts.fab_goal')}
          </button>
        </div>
      )}
      {embedded && totalGoals > 0 && (
        <p className={styles.headerSub} style={{ padding: '0 20px 8px' }}>
          {t('savings.goals_progress', { done: completedGoals, total: totalGoals })}
        </p>
      )}

      {!isPremium && <PremiumBanner feature="savings" />}

      {goals.length === 0 ? (
        <div className={styles.empty}>
          <p>🐷</p>
          <p>{t('savings.empty')}</p>
          <p>{t('savings.empty_hint')}</p>
        </div>
      ) : (
        <div className={styles.list}>
          {goals.map(goal => {
            const pct = Math.min((goal.savedAmount / goal.targetAmount) * 100, 100);
            const days = daysUntil(goal.deadline);
            const months = monthsUntil(goal.deadline);
            const done = goal.savedAmount >= goal.targetAmount;
            const overdue = days < 0 && !done;

            const timeLabel = done
              ? t('savings.status_reached')
              : days <= 0
              ? t('savings.status_overdue')
              : days === 1
              ? t('savings.status_day_left')
              : days < 31
              ? t('savings.status_days_left', { n: days })
              : months === 1
              ? t('savings.status_month_left')
              : t('savings.status_months_left', { n: months });

            const dailyNeeded = days > 0 && !done
              ? (goal.targetAmount - goal.savedAmount) / days
              : 0;

            return (
              <div key={goal.id} className={`${styles.goalCard} ${done ? styles.goalDone : ''}`}>
                <div className={styles.goalTop}>
                  <div className={styles.goalIcon}>{goal.icon}</div>
                  <div className={styles.goalInfo}>
                    <p className={styles.goalName}>{goal.name}</p>
                    <p className={`${styles.goalTime} ${overdue ? styles.overdue : ''}`}>{timeLabel}</p>
                  </div>
                  <button className={styles.deleteBtn} onClick={() => handleDelete(goal.id)}>
                    <HiTrash size={14} />
                  </button>
                </div>

                <div className={styles.progressBg}>
                  <div
                    className={`${styles.progressFill} ${done ? styles.progressDone : ''}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <div className={styles.goalAmounts}>
                  <div>
                    <p className={styles.amtLabel}>{t('savings.label_saved')}</p>
                    <p className={styles.amtSaved}>{formatAmount(goal.savedAmount, goal.currency)}</p>
                  </div>
                  <div className={styles.pctBadge}>{Math.round(pct)}%</div>
                  <div style={{ textAlign: 'right' }}>
                    <p className={styles.amtLabel}>{t('savings.label_goal')}</p>
                    <p className={styles.amtTarget}>{formatAmount(goal.targetAmount, goal.currency)}</p>
                  </div>
                </div>

                <div className={styles.goalFooter}>
                  <div>
                    <p className={styles.amtLabel}>{t('savings.label_deadline')}</p>
                    <p className={styles.deadlineVal}>{formatFullDate(goal.deadline, i18n.language)}</p>
                  </div>
                  {dailyNeeded > 0 && (
                    <div style={{ textAlign: 'right' }}>
                      <p className={styles.amtLabel}>{t('savings.label_daily')}</p>
                      <p className={styles.dailyVal}>{formatAmount(dailyNeeded, goal.currency)}/day</p>
                    </div>
                  )}
                </div>

                {!done && (
                  <button className={styles.contributeBtn} onClick={() => setContributing(goal)}>
                    <HiPlusCircle size={16} />
                    {t('savings.btn_contribute')}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showAdd && (
        <AddGoalModal onSave={add} onClose={() => setShowAdd(false)} />
      )}

      {contributing && (
        <ContributeModal
          goal={contributing}
          cards={cards}
          onContribute={(amount, cardId) => handleContribute(contributing, amount, cardId)}
          onClose={() => setContributing(null)}
        />
      )}
      {premiumGate.node}
    </>
  );

  return embedded ? content : <div className={styles.page}>{content}</div>;
};

export default Savings;
