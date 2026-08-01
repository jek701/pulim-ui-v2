import { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { HiPlus, HiTrash, HiPencil, HiCheck, HiCreditCard } from 'react-icons/hi2';
import { useApp } from '../context';
import { useSubscriptions } from '../hooks/useSubscriptions';
import type { NewSubscription } from '../hooks/useSubscriptions';
import type { BillingCycle, Currency, Subscription } from '../types';
import { useCards } from '../hooks/useCards';
import { useBudgets } from '../hooks/useBudgets';
import { useEntitlements } from '../hooks/useEntitlements';
import { usePremiumGate, PremiumBanner } from '../components/PremiumLock';
import { useConfirm } from '../components/ConfirmDialog';
import { NumberInput } from '../components/NumberInput';
import Modal from '../components/Modal';
import { Input, Select } from '../components/FormField';
import PageLoader from '../components/PageLoader';
import { formatAmount, fromDateInput, toDateInput } from '../utils/format';
import { CURRENCIES } from '../utils/currencies';
import { BASE_CURRENCY, getRateToBase } from '../utils/nbuRates';
import dayjs from '../utils/dayjs';
import EmojiInput from '../components/EmojiInput';
import styles from './Subscriptions.module.css';

const PRESET_SERVICES = [
  { name: 'Netflix',          icon: '🎬' },
  { name: 'Spotify',          icon: '🎵' },
  { name: 'YouTube Premium',  icon: '📺' },
  { name: 'Apple Music',      icon: '🍎' },
  { name: 'iCloud+',          icon: '☁️' },
  { name: 'ChatGPT Plus',     icon: '🤖' },
  { name: 'Google One',       icon: '🔷' },
  { name: 'Amazon Prime',     icon: '📦' },
  { name: 'Disney+',          icon: '🏰' },
  { name: 'Telegram Premium', icon: '✈️' },
  { name: 'Notion',           icon: '📝' },
  { name: 'Adobe',            icon: '🅰️' },
];

const ICONS = ['🎬','🎵','📺','🍎','☁️','🤖','🔷','📦','🏰','✈️','📝','🅰️','🎮','📡','💊','🏋️','📰','🔒','💻','🌐'];


const toMonthly = (amount: number, cycle: BillingCycle) => {
  if (cycle === 'weekly')  return (amount * 52) / 12;
  if (cycle === 'yearly')  return amount / 12;
  return amount;
};

const daysUntil = (ts: number) => {
  const diff = ts - Date.now();
  return Math.ceil(diff / 86400000);
};

const fmtDate = (ts: number) => dayjs(ts).format('D MMM YYYY');

const EMPTY = (): NewSubscription => ({
  name: '',
  icon: '📦',
  amount: 0,
  currency: 'UZS',
  cycle: 'monthly',
  nextBillingDate: Date.now(),
  isActive: true,
});

const Subscriptions = () => {
  const { t } = useTranslation();
  const { user } = useApp();
  const { subscriptions, loading, add, update, remove, pay } = useSubscriptions(user?.uid ?? null);
  const { cards } = useCards(user?.uid ?? null);
  const { setBudget } = useBudgets(user?.uid ?? null);
  const { isPremium, canUse } = useEntitlements();
  const premiumGate = usePremiumGate();
  const { confirm, node: confirmNode } = useConfirm();

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<NewSubscription>(EMPTY());
  const [amtStr, setAmtStr] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [payingId, setPayingId] = useState<string | null>(null);
  const [payCardId, setPayCardId] = useState('');
  const [payConfirming, setPayConfirming] = useState(false);

  const cycleShort = (cycle: BillingCycle) => t(`subscriptions.cycle_short_${cycle}`);

  const set = <K extends keyof NewSubscription>(k: K, v: NewSubscription[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const openAdd = () => {
    if (!canUse('extra_subscriptions', subscriptions.length)) {
      premiumGate.open('subscriptions');
      return;
    }
    setEditing(null);
    setForm(EMPTY());
    setAmtStr('');
    setError('');
    setShowModal(true);
  };

  const openEdit = (id: string) => {
    const s = subscriptions.find(s => s.id === id)!;
    setEditing(id);
    setForm({ name: s.name, icon: s.icon, amount: s.amount, currency: s.currency, cycle: s.cycle, nextBillingDate: s.nextBillingDate, note: s.note, isActive: s.isActive });
    setAmtStr(String(s.amount));
    setError('');
    setShowModal(true);
  };

  const applyPreset = (name: string, icon: string) => {
    setForm(f => ({ ...f, name, icon }));
  };

  const handleSave = async () => {
    const amt = parseFloat(amtStr.replace(/,/g, ''));
    if (!form.name.trim() || !amt || amt <= 0) { setError(t('subscriptions.err_required')); return; }
    setSaving(true);
    setError('');
    try {
      const data = { ...form, amount: amt };
      if (editing) await update(editing, data);
      else await add(data);
      setShowModal(false);
    } catch (e: unknown) {
      setError((e as { message?: string }).message ?? t('common.error_save'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (s: Subscription) => {
    const ok = await confirm({
      title: t('subscriptions.confirm_delete'),
      message: `${s.icon} ${s.name} · ${formatAmount(s.amount, s.currency)} ${cycleShort(s.cycle)}`,
      warning: t('common.action_irreversible'),
      confirmLabel: t('common.delete'),
    });
    if (ok) remove(s.id);
  };

  const handleMarkPaid = (id: string) => {
    setPayingId(id);
    setPayCardId('');
  };

  const handleConfirmPayment = async () => {
    if (!payingId || !payCardId) return;
    setPayConfirming(true);
    try {
      // Atomic: expense transaction + balance + advance nextBillingDate, server-side.
      await pay(payingId, payCardId);
      setPayingId(null);
    } finally {
      setPayConfirming(false);
    }
  };

  const active = subscriptions.filter(s => s.isActive);
  const inactive = subscriptions.filter(s => !s.isActive);

  const upcomingThisWeek = useMemo(
    () => active.filter(s => { const d = daysUntil(s.nextBillingDate); return d >= 0 && d <= 7; }),
    [active]
  );

  /** Monthly cost per currency — the raw figures, never summed across currencies. */
  const monthlyByCurrency = useMemo(() => {
    const totals = new Map<Currency, number>();
    for (const s of active) {
      totals.set(s.currency, (totals.get(s.currency) ?? 0) + toMonthly(s.amount, s.cycle));
    }
    return totals;
  }, [active]);

  /**
   * The header total used to add USD straight onto UZS and label the result "UZS"
   * (99,999,999,999 USD showed as 99,999,999,999 UZS). Convert through NBU rates
   * first; if a rate is missing we say so rather than printing a fake number.
   */
  const [totalMonthlyUZS, setTotalMonthlyUZS] = useState<number | null>(null);
  const [hasUnconvertedTotal, setHasUnconvertedTotal] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let sum = 0;
      let missing = false;
      for (const [currency, amount] of monthlyByCurrency) {
        if (currency === BASE_CURRENCY) { sum += amount; continue; }
        const rate = await getRateToBase(currency);
        if (rate == null) { missing = true; continue; }
        sum += amount * rate;
      }
      if (cancelled) return;
      setTotalMonthlyUZS(Math.round(sum));
      setHasUnconvertedTotal(missing);
    })();
    return () => { cancelled = true; };
  }, [monthlyByCurrency]);

  const isMultiCurrency = monthlyByCurrency.size > 1 || !monthlyByCurrency.has(BASE_CURRENCY);

  const setBudgetRef = useRef(setBudget);
  setBudgetRef.current = setBudget;
  useEffect(() => {
    // Budgets are kept in UZS, so feed the converted total — the previous UZS-only
    // filter made foreign-currency subscriptions vanish from the budget entirely.
    if (loading || !user?.uid || totalMonthlyUZS == null) return;
    setBudgetRef.current('__subscription__', totalMonthlyUZS, 'UZS');
  }, [totalMonthlyUZS, loading, user?.uid]);

  if (loading) return <PageLoader />;

  const dateInputValue = toDateInput(form.nextBillingDate);

  const CYCLES: { value: BillingCycle; label: string }[] = [
    { value: 'monthly', label: t('subscriptions.cycle_monthly') },
    { value: 'yearly',  label: t('subscriptions.cycle_yearly')  },
    { value: 'weekly',  label: t('subscriptions.cycle_weekly')  },
  ];

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <h1>{t('subscriptions.heading')}</h1>
        <button className={styles.headerAddBtn} onClick={openAdd}>
          <HiPlus size={17} />
          {t('common.add')}
        </button>
      </header>

      {!isPremium && subscriptions.length >= 2 && (
        <div style={{ padding: '0 16px' }}>
          <PremiumBanner feature="subscriptions" />
        </div>
      )}
      {/* Summary */}
      <div className={styles.summary}>
        <div className={styles.summaryMain}>
          <p className={styles.summaryLabel}>{t('subscriptions.monthly_total')}</p>
          <p className={styles.summaryAmount}>
            {totalMonthlyUZS == null
              ? '…'
              : `${isMultiCurrency ? '≈ ' : ''}${formatAmount(totalMonthlyUZS, 'UZS')}`}
          </p>
          {isMultiCurrency && (
            <p className={styles.summaryBreakdown}>
              {Array.from(monthlyByCurrency.entries())
                .map(([currency, amount]) => formatAmount(Math.round(amount), currency))
                .join(' + ')}
            </p>
          )}
          {hasUnconvertedTotal && (
            <p className={styles.summaryNote}>{t('subscriptions.total_unconverted_note')}</p>
          )}
        </div>
        <div className={styles.summarySide}>
          <div className={styles.summaryPill}>
            <span>{active.length} {t('subscriptions.pill_active', {count: active.length})}</span>
          </div>
          {upcomingThisWeek.length > 0 && (
            <div className={`${styles.summaryPill} ${styles.pillWarn}`}>
              <span>{t('subscriptions.pill_due_soon')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Active */}
      {active.length > 0 && (
        <div className={styles.section}>
          <p className={styles.sectionLabel}>{t('subscriptions.section_active')}</p>
          <div className={styles.list}>
            {active.map(s => {
              const days = daysUntil(s.nextBillingDate);
              const overdue = days < 0;
              const soon = days >= 0 && days <= 3;
              const dueLabel = overdue
                ? t('subscriptions.overdue', { n: Math.abs(days) })
                : days === 0 ? t('subscriptions.due_today')
                : days === 1 ? t('subscriptions.due_tomorrow')
                : t('subscriptions.due_in', { n: days });
              return (
                <div key={s.id} className={styles.card}>
                  <div className={styles.cardLeft}>
                    <div className={styles.iconWrap}>{s.icon}</div>
                    <div className={styles.info}>
                      <p className={styles.name}>{s.name}</p>
                      <p className={styles.meta}>
                        {formatAmount(s.amount, s.currency)} {cycleShort(s.cycle)}
                        {s.cycle !== 'monthly' && (
                          <span className={styles.normalized}> · {t('subscriptions.per_month_short', {amount: formatAmount(Math.round(toMonthly(s.amount, s.cycle)))})}</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className={styles.cardRight}>
                    <p className={`${styles.dueDate} ${overdue ? styles.overdue : soon ? styles.soon : ''}`}>
                      {dueLabel}
                    </p>
                    <p className={styles.dueFull}>{fmtDate(s.nextBillingDate)}</p>
                    <div className={styles.actions}>
                      <button className={styles.paidBtn} title={t('subscriptions.mark_paid_title')} onClick={() => handleMarkPaid(s.id)}>
                        <HiCheck size={13} />
                      </button>
                      <button className={styles.editBtn} aria-label={t('common.edit')} onClick={() => openEdit(s.id)}>
                        <HiPencil size={13} />
                      </button>
                      <button className={styles.delBtn} aria-label={t('common.delete')} onClick={() => handleDelete(s)}>
                        <HiTrash size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Inactive */}
      {inactive.length > 0 && (
        <div className={styles.section}>
          <p className={styles.sectionLabel}>{t('subscriptions.section_paused')}</p>
          <div className={styles.list}>
            {inactive.map(s => (
              <div key={s.id} className={`${styles.card} ${styles.cardInactive}`}>
                <div className={styles.cardLeft}>
                  <div className={styles.iconWrap}>{s.icon}</div>
                  <div className={styles.info}>
                    <p className={styles.name}>{s.name}</p>
                    <p className={styles.meta}>{formatAmount(s.amount, s.currency)} {cycleShort(s.cycle)}</p>
                  </div>
                </div>
                <div className={styles.actions}>
                  <button className={styles.editBtn} onClick={() => openEdit(s.id)}>
                    <HiPencil size={13} />
                  </button>
                  <button className={styles.delBtn} aria-label={t('common.delete')} onClick={() => handleDelete(s)}>
                    <HiTrash size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {subscriptions.length === 0 && (
        <div className={styles.empty}>
          <p>📡</p>
          <p>{t('subscriptions.empty')}</p>
          <p>{t('subscriptions.empty_hint')}</p>
        </div>
      )}

      {payingId && (() => {
        const s = subscriptions.find(s => s.id === payingId)!;
        const matchingCards = cards.filter(c => c.currency === s.currency);
        const displayCards = matchingCards.length > 0 ? matchingCards : cards;
        return (
          <Modal
            title={t('subscriptions.pay_modal_title')}
            onClose={() => setPayingId(null)}
            footer={
              <button
                className={`${styles.saveBtn} ${(!payCardId || payConfirming) ? styles.disabled : ''}`}
                onClick={handleConfirmPayment}
                disabled={!payCardId || payConfirming}
              >
                <HiCheck size={16} /> {payConfirming ? t('common.saving') : t('subscriptions.pay_modal_confirm')}
              </button>
            }
          >
            <div className={styles.paySubInfo}>
              <span className={styles.paySubIcon}>{s.icon}</span>
              <div>
                <p className={styles.paySubName}>{s.name}</p>
                <p className={styles.paySubMeta}>{formatAmount(s.amount, s.currency)} {cycleShort(s.cycle)}</p>
              </div>
            </div>
            <label className={styles.payCardLabel}>{t('subscriptions.pay_modal_label')}</label>
            {displayCards.length === 0 ? (
              <p className={styles.payNoCards}>{t('subscriptions.pay_modal_no_cards')}</p>
            ) : (
              <div className={styles.payCardGrid}>
                {displayCards.map(card => (
                  <button
                    key={card.id}
                    className={`${styles.payCardBtn} ${payCardId === card.id ? styles.payCardActive : ''}`}
                    onClick={() => setPayCardId(card.id)}
                  >
                    <HiCreditCard size={18} />
                    <div className={styles.payCardInfo}>
                      <p className={styles.payCardName}>{card.name}</p>
                      <p className={styles.payCardBank}>{card.bank}</p>
                    </div>
                    <span className={styles.payCardCur}>{card.currency}</span>
                  </button>
                ))}
              </div>
            )}
          </Modal>
        );
      })()}

      {showModal && (
        <Modal
          title={editing ? t('subscriptions.modal_edit') : t('subscriptions.modal_new')}
          onClose={() => setShowModal(false)}
          footer={
            <>
              {error && <p className={styles.errorMsg}>{error}</p>}
              <button
                className={`${styles.saveBtn} ${saving ? styles.disabled : ''}`}
                onClick={handleSave}
                disabled={saving}
              >
                <HiCheck size={16} /> {saving ? t('common.saving') : t('subscriptions.btn_save')}
              </button>
            </>
          }
        >
          {!editing && (
            <div>
              <p className={styles.pickLabel}>{t('subscriptions.quick_pick')}</p>
              <div className={styles.presetRow}>
                {PRESET_SERVICES.map(p => (
                  <button
                    key={p.name}
                    className={`${styles.presetBtn} ${form.name === p.name ? styles.presetActive : ''}`}
                    onClick={() => applyPreset(p.name, p.icon)}
                  >
                    <span>{p.icon}</span>
                    <span>{p.name.split(' ')[0]}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <Input
            label={t('subscriptions.name_label')}
            placeholder={t('subscriptions.name_placeholder')}
            value={form.name}
            onChange={e => set('name', e.target.value)}
          />

          <EmojiInput
            label={t('subscriptions.icon_label')}
            value={form.icon}
            onChange={ic => set('icon', ic)}
            suggestions={ICONS}
          />

          <div className={styles.rowFields}>
            <div className={styles.amountWrap}>
              <label className={styles.fieldLabel}>{t('common.amount')}</label>
              <NumberInput
                className={styles.amountInput}
                placeholder={t('subscriptions.amount_placeholder')}
                value={amtStr}
                onChange={setAmtStr}
              />
            </div>
            <Select
              label={t('common.currency')}
              value={form.currency}
              onChange={e => set('currency', e.target.value as Currency)}
              options={CURRENCIES.map(c => ({ value: c.code, label: c.code }))}
            />
          </div>

          <Select
            label={t('subscriptions.cycle_label')}
            value={form.cycle}
            onChange={e => set('cycle', e.target.value as BillingCycle)}
            options={CYCLES.map(c => ({ value: c.value, label: c.label }))}
          />

          <Input
            label={t('subscriptions.next_billing')}
            type="date"
            value={dateInputValue}
            onChange={e => set('nextBillingDate', fromDateInput(e.target.value))}
          />

          <Input
            label={t('subscriptions.note_label')}
            placeholder={t('subscriptions.note_placeholder')}
            value={form.note ?? ''}
            onChange={e => set('note', e.target.value || undefined)}
          />

          <div className={styles.toggleRow}>
            <span className={styles.toggleLabel}>{t('subscriptions.active_label')}</span>
            <button
              className={`${styles.toggle} ${form.isActive ? styles.toggleOn : ''}`}
              onClick={() => set('isActive', !form.isActive)}
            >
              <span className={styles.toggleThumb} />
            </button>
          </div>
        </Modal>
      )}
      {premiumGate.node}
      {confirmNode}
    </div>
  );
};

export default Subscriptions;
