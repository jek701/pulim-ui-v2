import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { HiPlus, HiTrash, HiBanknotes, HiArrowDownTray, HiCurrencyDollar, HiArrowUpTray, HiMinus } from 'react-icons/hi2';
import { useApp } from '../context';
import { useDeposits } from '../hooks/useDeposits';
import type { NewDeposit } from '../hooks/useDeposits';
import { useCards } from '../hooks/useCards';
import { useEntitlements } from '../hooks/useEntitlements';
import { usePremiumGate, PremiumBanner } from '../components/PremiumLock';
import { formatAmount, formatFullDate } from '../utils/format';
import { CURRENCIES } from '../utils/currencies';
import type { Currency, CapitalizationType, Deposit, Card } from '../types';
import Modal from '../components/Modal';
import { Input, Select } from '../components/FormField';
import { NumberInput } from '../components/NumberInput';
import PageLoader from '../components/PageLoader';
import styles from './Deposits.module.css';

// ── Interest helpers ────────────────────────────────────────────────────────

function trancheSum(deposit: Deposit): number {
  return (deposit.tranches ?? []).reduce((s, t) => s + t.amount, 0);
}

function calcCurrentPrincipal(deposit: Deposit): number {
  return deposit.amount + trancheSum(deposit);
}

function calcTotalAccrued(deposit: Deposit, now = Date.now()): number {
  const rate  = deposit.interestRate / 100;
  const ms365 = 365 * 86400000;
  const end   = Math.min(now, deposit.endDate);

  let interest = deposit.amount * rate * Math.max(0, end - deposit.startDate) / ms365;

  for (const t of deposit.tranches ?? []) {
    if (t.date < end) {
      interest += t.amount * rate * (end - t.date) / ms365;
    }
  }

  return Math.max(0, interest);
}

function calcRemainingInterest(deposit: Deposit, now = Date.now()): number {
  return Math.max(0, calcTotalAccrued(deposit, now) - deposit.interestPaidOut);
}

function calcPeriodInterest(deposit: Deposit, now = Date.now()): number {
  return calcRemainingInterest(deposit, now);
}

function nextPayoutTs(deposit: Deposit): number {
  const base = deposit.lastInterestPaidAt ?? deposit.startDate;
  if (deposit.capitalization === 'monthly')   return base + 30  * 86400000;
  if (deposit.capitalization === 'quarterly') return base + 90  * 86400000;
  if (deposit.capitalization === 'custom')    return base + (deposit.customCapitalizationDays ?? 30) * 86400000;
  return deposit.endDate;
}

function isMatured(d: Deposit, now = Date.now())          { return !d.isClosed && now >= d.endDate; }
function canCollectPeriodic(d: Deposit, now = Date.now()) {
  return !d.isClosed && d.capitalization !== 'at_end' && now >= nextPayoutTs(d) && now < d.endDate;
}
function daysLeft(ts: number) { return Math.ceil((ts - Date.now()) / 86400000); }

function accountLabel(card: Card) {
  const prefix = card.cardType === 'cash' ? '💵' : card.cardType === 'credit' ? '💳' : '🏦';
  return `${prefix} ${card.name} (${formatAmount(card.balance, card.currency)})`;
}

// ── Add Deposit Modal ───────────────────────────────────────────────────────

type FormState = {
  bank: string; amountStr: string; currency: Currency; rateStr: string;
  startDate: string; endDate: string; capitalization: CapitalizationType;
  customDaysStr: string; showInterest: boolean; interestToAccountId: string;
  isReplenishable: boolean;
};
const EMPTY_FORM: FormState = {
  bank: '', amountStr: '', currency: 'UZS', rateStr: '', startDate: '', endDate: '',
  capitalization: 'at_end', customDaysStr: '', showInterest: true, interestToAccountId: '',
  isReplenishable: false,
};

const AddDepositModal = ({ accounts, onSave, onClose }: {
  accounts: Card[]; onSave: (d: NewDeposit) => Promise<void>; onClose: () => void;
}) => {
  const { t } = useTranslation();
  const [f, setF] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF(p => ({ ...p, [k]: v }));

  const isPeriodic = f.capitalization !== 'at_end';
  const canSave = f.bank.trim() && parseFloat(f.amountStr) > 0 && parseFloat(f.rateStr) > 0 &&
    f.startDate && f.endDate && (!isPeriodic || !!f.interestToAccountId) &&
    (f.capitalization !== 'custom' || parseInt(f.customDaysStr) > 0);

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true); setError('');
    try {
      await onSave({
        bank: f.bank.trim(),
        amount: parseFloat(f.amountStr),
        currency: f.currency,
        interestRate: parseFloat(f.rateStr),
        startDate: new Date(f.startDate).getTime(),
        endDate:   new Date(f.endDate).getTime(),
        capitalization: f.capitalization,
        customCapitalizationDays: f.capitalization === 'custom' ? parseInt(f.customDaysStr) : undefined,
        showInterest: f.showInterest,
        interestToAccountId: isPeriodic ? f.interestToAccountId : undefined,
        isReplenishable: f.isReplenishable,
      });
      onClose();
    } catch (err: unknown) {
      setError((err as { message?: string }).message ?? t('common.error_save'));
    } finally { setSaving(false); }
  };

  return (
    <Modal
      title={t('deposits.modal_new')}
      onClose={onClose}
      footer={
        <>
          {error && <p className={styles.errorMsg}>{error}</p>}
          <button className={`${styles.saveBtn} ${!canSave || saving ? styles.disabled : ''}`} onClick={handleSave} disabled={!canSave || saving}>
            {saving ? t('common.saving') : t('deposits.btn_open')}
          </button>
        </>
      }
    >
      <Input label={t('common.bank')} placeholder={t('deposits.bank_placeholder')} value={f.bank} onChange={e => set('bank', e.target.value)} />
      <div>
        <p className={styles.fieldLabel}>{t('deposits.principal_label')}</p>
        <div className={styles.amountRow}>
          <NumberInput className={styles.amountInput} placeholder="0" value={f.amountStr} onChange={v => set('amountStr', v)} />
          <select className={styles.currencyPick} value={f.currency} onChange={e => set('currency', e.target.value as Currency)}>
            {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
          </select>
        </div>
      </div>
      <div>
        <p className={styles.fieldLabel}>{t('deposits.rate_label')}</p>
        <NumberInput className={styles.numInput} placeholder={t('deposits.rate_placeholder')} value={f.rateStr} onChange={v => set('rateStr', v)} />
      </div>
      <div className={styles.dateRow}>
        <Input label={t('deposits.start_date')} type="date" value={f.startDate} onChange={e => set('startDate', e.target.value)} />
        <Input label={t('deposits.end_date')}   type="date" value={f.endDate}   onChange={e => set('endDate',   e.target.value)} />
      </div>
      <Select
        label={t('deposits.payout_label')}
        value={f.capitalization}
        onChange={e => set('capitalization', e.target.value as CapitalizationType)}
        options={[
          { value: 'at_end',    label: t('deposits.cap_at_end') },
          { value: 'monthly',   label: t('deposits.cap_monthly') },
          { value: 'quarterly', label: t('deposits.cap_quarterly') },
          { value: 'custom',    label: t('deposits.cap_custom') },
        ]}
      />
      {f.capitalization === 'custom' && (
        <div>
          <p className={styles.fieldLabel}>{t('deposits.every_n_days')}</p>
          <NumberInput className={styles.numInput} placeholder={t('deposits.every_n_placeholder')} value={f.customDaysStr} onChange={v => set('customDaysStr', v)} />
        </div>
      )}
      {isPeriodic && (
        <Select
          label={t('deposits.interest_account_label')}
          value={f.interestToAccountId}
          onChange={e => set('interestToAccountId', e.target.value)}
          options={[
            { value: '', label: t('deposits.interest_account_placeholder') },
            ...accounts.map(c => ({ value: c.id, label: accountLabel(c) })),
          ]}
        />
      )}
      <label className={styles.toggleRow}>
        <input type="checkbox" checked={f.showInterest} onChange={e => set('showInterest', e.target.checked)} />
        <span>{t('deposits.show_interest_toggle')}</span>
      </label>
      <label className={styles.toggleRow}>
        <input type="checkbox" checked={f.isReplenishable} onChange={e => set('isReplenishable', e.target.checked)} />
        <span>{t('deposits.replenishable_toggle')}</span>
      </label>
    </Modal>
  );
};

// ── Close Deposit Modal ─────────────────────────────────────────────────────

const CloseDepositModal = ({ deposit, accounts, onClose, onConfirm }: {
  deposit: Deposit; accounts: Card[];
  onClose: () => void; onConfirm: (accountId: string) => Promise<void>;
}) => {
  const { t } = useTranslation();
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [saving, setSaving] = useState(false);
  const principal = calcCurrentPrincipal(deposit);
  const remaining = calcRemainingInterest(deposit);
  const total = principal + remaining;

  return (
    <Modal
      title={t('deposits.modal_close')}
      onClose={onClose}
      footer={
        <button className={`${styles.saveBtn} ${!accountId || saving ? styles.disabled : ''}`}
          onClick={async () => { setSaving(true); try { await onConfirm(accountId); } finally { setSaving(false); } }}
          disabled={!accountId || saving}>
          {saving ? t('common.processing') : t('deposits.btn_confirm_transfer')}
        </button>
      }
    >
      <div className={styles.infoBlock}>
        <div className={styles.infoRow}><span>{t('deposits.label_principal')}</span><strong>{formatAmount(principal, deposit.currency)}</strong></div>
        <div className={styles.infoRow}><span>{t('deposits.label_interest')}</span><strong className={styles.interestColor}>{formatAmount(remaining, deposit.currency)}</strong></div>
        <div className={`${styles.infoRow} ${styles.totalRow}`}><span>{t('common.total')}</span><strong>{formatAmount(total, deposit.currency)}</strong></div>
      </div>
      <Select
        label={t('deposits.transfer_to')}
        value={accountId}
        onChange={e => setAccountId(e.target.value)}
        options={accounts.map(c => ({ value: c.id, label: accountLabel(c) }))}
      />
    </Modal>
  );
};

// ── Collect Interest Modal ──────────────────────────────────────────────────

const CollectInterestModal = ({ deposit, accounts, onClose, onConfirm }: {
  deposit: Deposit; accounts: Card[];
  onClose: () => void; onConfirm: (amount: number) => Promise<void>;
}) => {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const amount = calcPeriodInterest(deposit);
  const dest = accounts.find(c => c.id === deposit.interestToAccountId);

  return (
    <Modal
      title={t('deposits.modal_collect')}
      onClose={onClose}
      footer={
        <button className={`${styles.saveBtn} ${saving ? styles.disabled : ''}`}
          onClick={async () => { setSaving(true); try { await onConfirm(amount); } finally { setSaving(false); } }}
          disabled={saving}>
          {saving ? t('common.processing') : t('common.collect')}
        </button>
      }
    >
      <div className={styles.infoBlock}>
        <div className={styles.infoRow}><span>{t('deposits.label_period_interest')}</span><strong className={styles.interestColor}>{formatAmount(amount, deposit.currency)}</strong></div>
        {dest && <div className={styles.infoRow}><span>{t('deposits.label_destination')}</span><strong>{dest.name}</strong></div>}
        <div className={styles.infoRow}><span>{t('deposits.label_next_period')}</span><strong>{t('common.today')}</strong></div>
      </div>
    </Modal>
  );
};

// ── Replenish Modal ─────────────────────────────────────────────────────────

const ReplenishModal = ({ deposit, accounts, onClose, onConfirm }: {
  deposit: Deposit; accounts: Card[];
  onClose: () => void; onConfirm: (accountId: string, amount: number) => Promise<void>;
}) => {
  const { t } = useTranslation();
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [amountStr, setAmountStr] = useState('');
  const [saving, setSaving] = useState(false);

  const amount = parseFloat(amountStr) || 0;
  const sourceAccount = accounts.find(c => c.id === accountId);
  const insufficient = !!sourceAccount && sourceAccount.cardType !== 'credit' && amount > sourceAccount.balance;
  const canConfirm = accountId && amount > 0 && !insufficient;

  return (
    <Modal
      title={t('deposits.modal_topup')}
      onClose={onClose}
      footer={
        <button
          className={`${styles.saveBtn} ${!canConfirm || saving ? styles.disabled : ''}`}
          onClick={async () => { setSaving(true); try { await onConfirm(accountId, amount); } finally { setSaving(false); } }}
          disabled={!canConfirm || saving}
        >
          {saving ? t('common.processing') : t('deposits.btn_topup')}
        </button>
      }
    >
      <div className={styles.infoBlock}>
        <div className={styles.infoRow}><span>{t('deposits.label_current_principal')}</span><strong>{formatAmount(calcCurrentPrincipal(deposit), deposit.currency)}</strong></div>
        {amount > 0 && <div className={styles.infoRow}><span>{t('deposits.label_new_principal')}</span><strong className={styles.interestColor}>{formatAmount(calcCurrentPrincipal(deposit) + amount, deposit.currency)}</strong></div>}
      </div>
      <Select
        label={t('deposits.from_account')}
        value={accountId}
        onChange={e => setAccountId(e.target.value)}
        options={accounts.map(c => ({ value: c.id, label: accountLabel(c) }))}
      />
      <div>
        <p className={styles.fieldLabel}>{t('deposits.topup_amount', { currency: deposit.currency })}</p>
        <NumberInput
          className={styles.numInput}
          placeholder="0"
          value={amountStr}
          onChange={setAmountStr}
          autoFocus
        />
        {insufficient && <p className={styles.errorMsg}>{t('deposits.err_insufficient')}</p>}
      </div>
    </Modal>
  );
};

// ── Withdraw Modal ──────────────────────────────────────────────────────────

const WithdrawModal = ({ deposit, accounts, onClose, onConfirm }: {
  deposit: Deposit; accounts: Card[];
  onClose: () => void; onConfirm: (accountId: string, amount: number) => Promise<void>;
}) => {
  const { t } = useTranslation();
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [amountStr, setAmountStr] = useState('');
  const [saving, setSaving] = useState(false);

  const amount    = parseFloat(amountStr) || 0;
  const principal = calcCurrentPrincipal(deposit);
  const exceeds   = amount > principal;
  const canConfirm = accountId && amount > 0 && !exceeds;

  return (
    <Modal
      title={t('deposits.modal_withdraw')}
      onClose={onClose}
      footer={
        <button
          className={`${styles.saveBtn} ${!canConfirm || saving ? styles.disabled : ''}`}
          onClick={async () => { setSaving(true); try { await onConfirm(accountId, amount); } finally { setSaving(false); } }}
          disabled={!canConfirm || saving}
        >
          {saving ? t('common.processing') : t('deposits.btn_withdraw')}
        </button>
      }
    >
      <div className={styles.infoBlock}>
        <div className={styles.infoRow}><span>{t('deposits.label_current_principal')}</span><strong>{formatAmount(principal, deposit.currency)}</strong></div>
        {amount > 0 && !exceeds && (
          <div className={styles.infoRow}><span>{t('deposits.label_remaining_after')}</span><strong>{formatAmount(principal - amount, deposit.currency)}</strong></div>
        )}
      </div>
      <Select
        label={t('deposits.to_account')}
        value={accountId}
        onChange={e => setAccountId(e.target.value)}
        options={accounts.map(c => ({ value: c.id, label: accountLabel(c) }))}
      />
      <div>
        <p className={styles.fieldLabel}>{t('deposits.withdraw_amount', { currency: deposit.currency })}</p>
        <NumberInput
          className={styles.numInput}
          placeholder="0"
          value={amountStr}
          onChange={setAmountStr}
          autoFocus
        />
        {exceeds && <p className={styles.errorMsg}>{t('deposits.err_exceed_principal')}</p>}
      </div>
    </Modal>
  );
};

// ── Main Page ───────────────────────────────────────────────────────────────

const Deposits = ({ embedded, addTrigger }: { embedded?: boolean; addTrigger?: number }) => {
  const { t } = useTranslation();
  const { user } = useApp();
  const { deposits, loading, add, remove, collectInterest, closeDeposit, replenish, withdraw } = useDeposits(user?.uid ?? null);
  const { cards } = useCards(user?.uid ?? null);
  const { isPremium } = useEntitlements();
  const premiumGate = usePremiumGate();

  const [showAdd, setShowAdd]           = useState(false);
  const [closing, setClosing]           = useState<Deposit | null>(null);
  const [collecting, setCollecting]     = useState<Deposit | null>(null);
  const [replenishing, setReplenishing] = useState<Deposit | null>(null);
  const [withdrawing, setWithdrawing]   = useState<Deposit | null>(null);
  const [showClosed, setShowClosed]     = useState(false);

  useEffect(() => {
    if (addTrigger && addTrigger > 0) {
      if (!isPremium) { premiumGate.open('deposits'); return; }
      setShowAdd(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addTrigger]);

  const active = deposits.filter(d => !d.isClosed);
  const closed  = deposits.filter(d =>  d.isClosed);

  // All deposit operations are atomic server-side (balance + transaction + deposit
  // fields commit together). The server computes interest/close totals.
  const handleClose = async (deposit: Deposit, accountId: string) => {
    await closeDeposit(deposit.id, accountId);
    setClosing(null);
  };

  const handleCollect = async (deposit: Deposit) => {
    // The server computes the collectible interest amount itself.
    await collectInterest(deposit.id);
    setCollecting(null);
  };

  const handleReplenish = async (deposit: Deposit, accountId: string, amount: number) => {
    await replenish(deposit.id, accountId, amount);
    setReplenishing(null);
  };

  const handleWithdraw = async (deposit: Deposit, accountId: string, amount: number) => {
    await withdraw(deposit.id, accountId, amount);
    setWithdrawing(null);
  };

  if (loading) return <PageLoader />;

  const totalDeposited = active.reduce((s, d) => s + calcCurrentPrincipal(d), 0);
  const totalInterest  = active.reduce((s, d) => s + calcRemainingInterest(d), 0);

  const CAP_LABELS: Record<CapitalizationType, string> = {
    monthly:   t('deposits.cap_monthly'),
    quarterly: t('deposits.cap_quarterly'),
    at_end:    t('deposits.cap_at_end'),
    custom:    t('deposits.cap_custom'),
  };

  const content = (
    <>
      {!embedded && (
        <div className={styles.ctaBar}>
          <button className={styles.addBtn} onClick={() => { if (!isPremium) { premiumGate.open('deposits'); return; } setShowAdd(true); }}>
            <HiPlus size={18} /> {t('accounts.fab_deposit')}
          </button>
        </div>
      )}

      {!isPremium && <PremiumBanner feature="deposits" />}

      {active.length > 0 && (
        <div className={styles.summary}>
          <div className={styles.summaryItem}>
            <p className={styles.summaryLabel}>{t('deposits.label_total_deposited')}</p>
            <p className={styles.summaryVal}>{formatAmount(totalDeposited, 'UZS')}</p>
          </div>
          <div className={styles.summaryItem}>
            <p className={styles.summaryLabel}>{t('deposits.label_accrued_interest')}</p>
            <p className={`${styles.summaryVal} ${styles.interestColor}`}>{formatAmount(totalInterest, 'UZS')}</p>
          </div>
        </div>
      )}

      {active.length === 0 ? (
        <div className={styles.empty}>
          <HiBanknotes size={40} color="var(--text3)" />
          <p>{t('deposits.empty')}</p>
          <p>{t('deposits.empty_hint')}</p>
        </div>
      ) : (
        <div className={styles.list}>
          {active.map(d => {
            const matured    = isMatured(d);
            const canCollect = canCollectPeriodic(d);
            const days       = daysLeft(d.endDate);
            const accrued    = calcRemainingInterest(d);
            const principal  = calcCurrentPrincipal(d);

            return (
              <div key={d.id} className={`${styles.depositCard} ${matured ? styles.maturedCard : ''}`}>
                <div className={styles.depositTop}>
                  <div className={styles.depositInfo}>
                    <p className={styles.depositBank}>{d.bank}</p>
                    <p className={styles.depositMeta}>{d.interestRate}% · {CAP_LABELS[d.capitalization]}</p>
                  </div>
                  <div className={styles.depositTopRight}>
                    {matured
                      ? <span className={styles.maturedBadge}>{t('deposits.badge_matured')}</span>
                      : <span className={styles.daysBadge} style={{ color: days <= 14 ? 'var(--expense)' : 'var(--text2)' }}>
                          {t('deposits.days_left', { n: days })}
                        </span>
                    }
                    <button className={styles.delBtn} onClick={() => confirm(t('deposits.confirm_delete')) && remove(d.id)}>
                      <HiTrash size={14} />
                    </button>
                  </div>
                </div>

                <div className={styles.depositAmounts}>
                  <div>
                    <p className={styles.amtLabel}>{t('deposits.label_principal')}</p>
                    <p className={styles.amtVal}>{formatAmount(principal, d.currency)}</p>
                  </div>
                  {d.showInterest && (
                    <div>
                      <p className={styles.amtLabel}>{t('deposits.label_accrued')}</p>
                      <p className={`${styles.amtVal} ${styles.interestColor}`}>{formatAmount(accrued, d.currency)}</p>
                    </div>
                  )}
                  <div>
                    <p className={styles.amtLabel}>{t('deposits.label_matures')}</p>
                    <p className={styles.amtVal}>{formatFullDate(d.endDate)}</p>
                  </div>
                </div>

                <div className={styles.depositActions}>
                  {!matured && principal > 0 && (
                    <div className={styles.depositActionsRow}>
                      {d.isReplenishable && (
                        <button className={styles.replenishBtn} onClick={() => setReplenishing(d)}>
                          <HiArrowUpTray size={15} /> {t('deposits.btn_topup_short')}
                        </button>
                      )}
                      <button className={styles.withdrawBtn} onClick={() => setWithdrawing(d)}>
                        <HiMinus size={15} /> {t('deposits.btn_withdraw_short')}
                      </button>
                    </div>
                  )}
                  {canCollect && (
                    <button className={styles.collectBtn} onClick={() => setCollecting(d)}>
                      <HiCurrencyDollar size={15} /> {t('deposits.btn_collect')}
                    </button>
                  )}
                  {matured && (
                    <button className={styles.closeBtn} onClick={() => setClosing(d)}>
                      <HiArrowDownTray size={15} /> {t('deposits.btn_close_collect')}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {closed.length > 0 && (
        <button className={styles.showClosedBtn} onClick={() => setShowClosed(v => !v)}>
          {showClosed
            ? t('deposits.hide_closed', { n: closed.length })
            : t('deposits.show_closed', { n: closed.length })
          }
        </button>
      )}
      {showClosed && (
        <div className={styles.list}>
          {closed.map(d => (
            <div key={d.id} className={`${styles.depositCard} ${styles.closedCard}`}>
              <div className={styles.depositTop}>
                <div className={styles.depositInfo}>
                  <p className={styles.depositBank}>{d.bank}</p>
                  <p className={styles.depositMeta}>{d.interestRate}% · {formatFullDate(d.startDate)} – {formatFullDate(d.endDate)}</p>
                </div>
                <span className={styles.closedBadge}>{t('deposits.badge_closed')}</span>
              </div>
              <div className={styles.depositAmounts}>
                <div><p className={styles.amtLabel}>{t('deposits.label_principal')}</p><p className={styles.amtVal}>{formatAmount(d.amount, d.currency)}</p></div>
                <div><p className={styles.amtLabel}>{t('deposits.label_interest_paid')}</p><p className={`${styles.amtVal} ${styles.interestColor}`}>{formatAmount(d.interestPaidOut, d.currency)}</p></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd      && <AddDepositModal accounts={cards} onSave={add} onClose={() => setShowAdd(false)} />}
      {closing      && <CloseDepositModal deposit={closing} accounts={cards} onClose={() => setClosing(null)} onConfirm={id => handleClose(closing, id)} />}
      {collecting   && <CollectInterestModal deposit={collecting} accounts={cards} onClose={() => setCollecting(null)} onConfirm={() => handleCollect(collecting)} />}
      {replenishing && <ReplenishModal deposit={replenishing} accounts={cards} onClose={() => setReplenishing(null)} onConfirm={(accId, amt) => handleReplenish(replenishing, accId, amt)} />}
      {withdrawing  && <WithdrawModal deposit={withdrawing} accounts={cards} onClose={() => setWithdrawing(null)} onConfirm={(accId, amt) => handleWithdraw(withdrawing, accId, amt)} />}
      {premiumGate.node}
    </>
  );

  return embedded ? content : (
    <div className={styles.page}>
      <div className={styles.header}><h1>{t('deposits.heading')}</h1></div>
      {content}
    </div>
  );
};

export default Deposits;
