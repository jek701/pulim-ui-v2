import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { HiPlus, HiTrash, HiCheck, HiArrowPath, HiMinus } from 'react-icons/hi2';
import { useApp } from '../context';
import { useDebts } from '../hooks/useDebts';
import type { NewDebt } from '../hooks/useDebts';
import { useCards } from '../hooks/useCards';
import { useEntitlements } from '../hooks/useEntitlements';
import { usePremiumGate, PremiumBanner } from '../components/PremiumLock';
import { formatAmount, formatFullDate, toDateInput } from '../utils/format';
import { CURRENCIES } from '../utils/currencies';
import type { Currency, DebtDirection, CommissionType, Debt } from '../types';
import Modal from '../components/Modal';
import { Input, Select, Textarea } from '../components/FormField';
import { NumberInput } from '../components/NumberInput';
import PageLoader from '../components/PageLoader';
import styles from './Debts.module.css';

const EMPTY_FORM = (): NewDebt => ({
  direction: 'i_owe',
  person: '',
  amount: 0,
  currency: 'UZS',
  isPaid: false,
  commission: undefined,
  dueDate: undefined,
  comment: undefined,
});

const Debts = ({ embedded, addTrigger }: { embedded?: boolean; addTrigger?: number }) => {
  const { t, i18n } = useTranslation();
  const { user } = useApp();
  const { debts, add, togglePaid, pay, remove, loading } = useDebts(user?.uid ?? null);
  const { cards } = useCards(user?.uid ?? null);
  const { isPremium } = useEntitlements();
  const premiumGate = usePremiumGate();
  const [tab, setTab] = useState<DebtDirection>('i_owe');

  useEffect(() => {
    if (addTrigger && addTrigger > 0) {
      if (!isPremium) { premiumGate.open('debts'); return; }
      setShowAdd(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addTrigger]);
  const [showPaid, setShowPaid] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [payingDebt, setPayingDebt] = useState<Debt | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payCardId, setPayCardId] = useState('');
  const [form, setForm] = useState<NewDebt>(EMPTY_FORM());
  const [hasCommission, setHasCommission] = useState(false);
  const [commType, setCommType] = useState<CommissionType>('percent');
  const [commValue, setCommValue] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [accountId, setAccountId] = useState('');
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof NewDebt>(k: K, v: NewDebt[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const calcTotal = (amount: number, debt?: { commission?: { type: CommissionType; value: number } }) => {
    if (!debt?.commission) return amount;
    const c = debt.commission;
    return c.type === 'percent' ? amount + amount * (c.value / 100) : amount + c.value;
  };

  const handleAdd = async () => {
    if (!form.person.trim() || form.amount <= 0 || !accountId) return;
    setSaving(true);
    try {
      const amount = Number(form.amount);
      const data: NewDebt = {
        ...form,
        amount,
        commission: hasCommission && commValue
          ? { type: commType, value: parseFloat(commValue) }
          : undefined,
        dueDate: dueDate ? new Date(dueDate).getTime() : undefined,
      };
      // The server records the debt and (if an account is chosen) the initial
      // cash movement + balance change atomically.
      await add(data, accountId || undefined);

      setShowAdd(false);
      setForm(EMPTY_FORM());
      setHasCommission(false);
      setCommValue('');
      setAmountStr('');
      setDueDate('');
      setAccountId('');
    } finally {
      setSaving(false);
    }
  };

  const handlePay = async () => {
    if (!payingDebt) return;
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) return;
    setSaving(true);
    try {
      // Atomic: increment paidAmount, auto-complete, record the transaction + balance.
      await pay(payingDebt.id, amount, payCardId || undefined);

      setPayingDebt(null);
      setPayAmount('');
      setPayCardId('');
    } finally {
      setSaving(false);
    }
  };

  const filtered = debts.filter(d => d.direction === tab && d.isPaid === showPaid);

  if (loading) return <PageLoader />;

  const content = (
    <>
      {!embedded && (
        <div className={styles.header}>
          <h1>{t('debts.heading')}</h1>
          <button className={styles.addBtn} onClick={() => { if (!isPremium) { premiumGate.open('debts'); return; } setShowAdd(true); }}>
            <HiPlus size={18} /> {t('common.add')}
          </button>
        </div>
      )}

      {!isPremium && <PremiumBanner feature="debts" />}

      {/* Direction tabs */}
      <div className={styles.dirTabs}>
        <button
          className={`${styles.dirBtn} ${tab === 'i_owe' ? styles.dirActive : ''}`}
          onClick={() => setTab('i_owe')}
        >
          {t('debts.tab_i_owe')}
        </button>
        <button
          className={`${styles.dirBtn} ${tab === 'owe_me' ? styles.dirActive : ''}`}
          onClick={() => setTab('owe_me')}
        >
          {t('debts.tab_owe_me')}
        </button>
      </div>

      {/* Paid toggle */}
      <div className={styles.paidRow}>
        <button
          className={`${styles.paidBtn} ${!showPaid ? styles.paidActive : ''}`}
          onClick={() => setShowPaid(false)}
        >
          {t('debts.tab_active')}
        </button>
        <button
          className={`${styles.paidBtn} ${showPaid ? styles.paidActive : ''}`}
          onClick={() => setShowPaid(true)}
        >
          {t('debts.tab_paid')}
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className={styles.empty}>
          <p>🤝</p>
          <p>{t('debts.empty', { status: showPaid ? t('common.paid') : t('common.active') })}</p>
        </div>
      ) : (
        <div className={styles.list}>
          {filtered.map(debt => {
            const total = calcTotal(debt.amount, debt);
            const paid = debt.paidAmount || 0;
            const remaining = Math.max(0, total - paid);
            const progress = Math.min(1, paid / total);
            const hasComm = !!debt.commission;
            return (
              <div key={debt.id} className={`${styles.debtCard} ${debt.isPaid ? styles.paid : ''}`}>
                <div className={styles.debtTop}>
                  <div className={styles.avatar}>
                    {debt.person.charAt(0).toUpperCase()}
                  </div>
                  <div className={styles.debtInfo}>
                    <p className={styles.debtPerson}>{debt.person}</p>
                    {debt.comment && <p className={styles.debtComment}>{debt.comment}</p>}
                    {debt.dueDate && (
                      <p className={styles.debtDue}>{t('debts.due_label')}: {formatFullDate(debt.dueDate, i18n.language)}</p>
                    )}
                  </div>
                  <div className={styles.debtActions}>
                    {!debt.isPaid && (
                      <button
                        className={styles.payBtn}
                        onClick={() => { setPayingDebt(debt); setPayAmount(''); setPayCardId(cards[0]?.id ?? ''); }}
                        title={t('debts.pay_partial')}
                      >
                        <HiMinus size={15} />
                      </button>
                    )}
                    <button
                      className={styles.paidToggle}
                      onClick={() => {
                        if (debt.isPaid) {
                          togglePaid(debt.id, false);
                        } else {
                          setPayingDebt(debt);
                          setPayAmount(String(remaining));
                          setPayCardId(cards[0]?.id ?? '');
                        }
                      }}
                      title={debt.isPaid ? t('debts.mark_unpaid') : t('debts.mark_paid')}
                    >
                      {debt.isPaid ? <HiArrowPath size={15} /> : <HiCheck size={15} />}
                    </button>
                    <button className={styles.delBtn} onClick={() => confirm(t('debts.confirm_delete')) && remove(debt.id)}>
                      <HiTrash size={15} />
                    </button>
                  </div>
                </div>

                <div className={styles.debtAmounts}>
                  <div>
                    <p className={styles.amtLabel}>{t('debts.label_total')}</p>
                    <p className={styles.amtVal}>{formatAmount(total, debt.currency)}</p>
                  </div>
                  {paid > 0 && (
                    <div>
                      <p className={styles.amtLabel}>{t('debts.label_paid')}</p>
                      <p className={styles.paidAmtVal}>{formatAmount(paid, debt.currency)}</p>
                    </div>
                  )}
                  {hasComm && (
                    <div>
                      <p className={styles.amtLabel}>{t('debts.label_commission')}</p>
                      <p className={styles.commVal}>
                        {debt.commission!.type === 'percent'
                          ? `+${debt.commission!.value}%`
                          : `+${formatAmount(debt.commission!.value, debt.currency)}`}
                      </p>
                    </div>
                  )}
                  {!debt.isPaid && paid > 0 && (
                    <div>
                      <p className={styles.amtLabel}>{t('debts.label_remaining')}</p>
                      <p className={styles.remainingVal}>{formatAmount(remaining, debt.currency)}</p>
                    </div>
                  )}
                </div>

                {paid > 0 && !debt.isPaid && (
                  <div className={styles.progressWrap}>
                    <div className={styles.progressBar} style={{ width: `${progress * 100}%` }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pay partial modal */}
      {payingDebt && (
        <Modal
          title={t('debts.modal_pay')}
          onClose={() => { setPayingDebt(null); setPayAmount(''); setPayCardId(''); }}
          footer={
            <button
              className={`${styles.saveBtn} ${saving ? styles.disabled : ''}`}
              onClick={handlePay}
              disabled={saving || !payAmount || parseFloat(payAmount) <= 0 || !payCardId}
            >
              {saving ? t('common.saving') : t('debts.btn_confirm_payment')}
            </button>
          }
        >
          <p className={styles.payInfo}>
            {t('debts.pay_info', {
              person: payingDebt.person,
              amount: formatAmount(
                Math.max(0, calcTotal(payingDebt.amount, payingDebt) - (payingDebt.paidAmount || 0)),
                payingDebt.currency
              ),
            })}
          </p>
          <div>
            <p className={styles.fieldLabel}>{t('debts.payment_amount_label', { currency: payingDebt.currency })}</p>
            <NumberInput
              className={styles.amtInput}
              placeholder="0"
              value={payAmount}
              onChange={setPayAmount}
              autoFocus
            />
          </div>
          {cards.length > 0 && (
            <Select
              label={t(payingDebt.direction === 'owe_me' ? 'debts.deposit_to_card' : 'debts.pay_from_card')}
              value={payCardId}
              onChange={e => setPayCardId(e.target.value)}
              options={cards.map(c => ({ value: c.id, label: `${c.name} (${formatAmount(c.balance, c.currency)})` }))}
            />
          )}
        </Modal>
      )}

      {showAdd && (
        <Modal
          title={t('debts.modal_add')}
          onClose={() => { setShowAdd(false); setForm(EMPTY_FORM()); setHasCommission(false); setCommValue(''); setAmountStr(''); setDueDate(''); setAccountId(''); }}
          footer={
            <button
              className={`${styles.saveBtn} ${saving || !accountId ? styles.disabled : ''}`}
              onClick={handleAdd}
              disabled={saving || !accountId}
            >
              {saving ? t('common.saving') : t('debts.btn_add')}
            </button>
          }
        >
          <div className={styles.formDirRow}>
            <button
              className={`${styles.formDirBtn} ${form.direction === 'i_owe' ? styles.formDirActive : ''}`}
              onClick={() => set('direction', 'i_owe')}
            >
              {t('debts.tab_i_owe')}
            </button>
            <button
              className={`${styles.formDirBtn} ${form.direction === 'owe_me' ? styles.formDirActive : ''}`}
              onClick={() => set('direction', 'owe_me')}
            >
              {t('debts.tab_owe_me')}
            </button>
          </div>

          <Input label={t('debts.person_label')} placeholder={t('debts.person_placeholder')} value={form.person} onChange={e => set('person', e.target.value)} />

          <div className={styles.amountRow}>
            <div>
              <p className={styles.fieldLabel}>{t('common.amount')}</p>
              <NumberInput
                className={styles.amtInput}
                placeholder="0"
                value={amountStr}
                onChange={v => { setAmountStr(v); set('amount', parseFloat(v) || 0); }}
              />
            </div>
            <Select
              label={t('common.currency')}
              value={form.currency}
              onChange={e => set('currency', e.target.value as Currency)}
              options={CURRENCIES.map(c => ({ value: c.code, label: c.code }))}
            />
          </div>

          <div>
            <label className={styles.checkRow}>
              <input type="checkbox" checked={hasCommission} onChange={e => setHasCommission(e.target.checked)} />
              <span>{t('debts.commission_label')}</span>
            </label>
            {hasCommission && (
              <div className={styles.commRow}>
                <Select
                  value={commType}
                  onChange={e => setCommType(e.target.value as CommissionType)}
                  options={[
                    { value: 'percent', label: t('debts.commission_percent') },
                    { value: 'fixed',   label: t('debts.commission_fixed') },
                  ]}
                />
                <NumberInput
                  className={styles.amtInput}
                  placeholder={commType === 'percent' ? 'e.g. 5' : t('common.amount')}
                  value={commValue}
                  onChange={setCommValue}
                />
              </div>
            )}
          </div>

          <Select
            label={t(form.direction === 'i_owe' ? 'debts.deposit_to_card' : 'debts.withdraw_from_card')}
            value={accountId}
            onChange={e => setAccountId(e.target.value)}
            options={[
              { value: '', label: '—' },
              ...cards.map(c => ({ value: c.id, label: `${c.name} (${formatAmount(c.balance, c.currency)})` })),
            ]}
          />

          <Input label={t('debts.due_date_label')} type="date" value={dueDate} min={toDateInput(Date.now())} onChange={e => setDueDate(e.target.value)} />
          <Textarea label={t('debts.comment_label')} placeholder={t('debts.comment_placeholder')} value={form.comment ?? ''} onChange={e => set('comment', e.target.value || undefined)} rows={2} />
        </Modal>
      )}
      {premiumGate.node}
    </>
  );

  return embedded ? content : <div className={styles.page}>{content}</div>;
};

export default Debts;
