import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { HiPlus, HiCreditCard, HiBanknotes, HiArrowsRightLeft } from 'react-icons/hi2';
import { useApp } from '../context';
import { useCards } from '../hooks/useCards';
import { useTransactions } from '../hooks/useTransactions';
import { useEntitlements } from '../hooks/useEntitlements';
import { usePremiumGate, PremiumCornerStar } from '../components/PremiumLock';
import { formatAmount } from '../utils/format';
import { convert, getRateToBase, BASE_CURRENCY } from '../utils/nbuRates';
import { NumberInput } from '../components/NumberInput';
import { Select } from '../components/FormField';
import Modal from '../components/Modal';
import Cards from './Cards';
import Cash from './Cash';
import Savings from './Savings';
import Debts from './Debts';
import styles from './Accounts.module.css';

type AccountView = 'accounts' | 'savings' | 'debts';
type AccountSubTab = 'debit' | 'credit' | 'cash';

const Accounts = () => {
  const { t } = useTranslation();
  const { user } = useApp();
  const { cards } = useCards(user?.uid ?? null);
  const { transfer } = useTransactions(user?.uid ?? null);
  const { isPremium } = useEntitlements();
  const premiumGate = usePremiumGate();
  const [view, setView]       = useState<AccountView>('accounts');
  const [subTab, setSubTab]   = useState<AccountSubTab>('debit');
  const [addTrigger, setAddTrigger] = useState(0);

  // Transfer state
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferFromId, setTransferFromId] = useState('');
  const [transferToId, setTransferToId] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferToAmount, setTransferToAmount] = useState('');
  const [transferSaving, setTransferSaving] = useState(false);
  const [transferError, setTransferError] = useState('');
  const [transferAutoFilled, setTransferAutoFilled] = useState(false);
  const [transferRateInfo, setTransferRateInfo] = useState<string>('');
  const lastAutoValueRef = useRef<string>('');

  const transferFrom = cards.find(c => c.id === transferFromId);
  const transferTo   = cards.find(c => c.id === transferToId);
  const differentCurrencies = transferFrom && transferTo && transferFrom.currency !== transferTo.currency;
  const canTransfer = transferFromId && transferToId && transferFromId !== transferToId &&
    parseFloat(transferAmount) > 0 &&
    (!differentCurrencies || parseFloat(transferToAmount) > 0);

  const openTransfer = () => {
    setTransferFromId(cards[0]?.id ?? '');
    setTransferToId(cards[1]?.id ?? '');
    setTransferAmount('');
    setTransferToAmount('');
    setTransferError('');
    setTransferAutoFilled(false);
    setTransferRateInfo('');
    lastAutoValueRef.current = '';
    setShowTransfer(true);
  };

  // Auto-prefill received amount from NBU rate when currencies differ.
  useEffect(() => {
    if (!showTransfer || !differentCurrencies || !transferFrom || !transferTo) {
      setTransferRateInfo('');
      return;
    }
    const amt = parseFloat(transferAmount);
    if (!isFinite(amt) || amt <= 0) {
      setTransferRateInfo('');
      return;
    }
    let cancelled = false;
    (async () => {
      const converted = await convert(amt, transferFrom.currency, transferTo.currency);
      if (cancelled || converted == null) return;
      const formatted = converted.toFixed(transferTo.currency === 'UZS' ? 0 : 2);
      // Only overwrite if the user hasn't manually edited away from our last auto-value.
      const userEdited = transferToAmount !== '' && transferToAmount !== lastAutoValueRef.current;
      if (!userEdited) {
        lastAutoValueRef.current = formatted;
        setTransferToAmount(formatted);
        setTransferAutoFilled(true);
      }
      const oneUnit = await convert(1, transferFrom.currency, transferTo.currency);
      if (oneUnit != null) {
        setTransferRateInfo(`1 ${transferFrom.currency} ≈ ${oneUnit.toFixed(transferTo.currency === 'UZS' ? 2 : 4)} ${transferTo.currency}`);
      }
    })();
    return () => { cancelled = true; };
  }, [showTransfer, differentCurrencies, transferFrom, transferTo, transferAmount]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTransfer = async () => {
    if (!canTransfer || !transferFrom || !transferTo) return;
    const amt   = parseFloat(transferAmount);
    const toAmt = differentCurrencies ? parseFloat(transferToAmount) : amt;
    setTransferSaving(true);
    setTransferError('');
    try {
      const txDate = Date.now();
      const userEdited = differentCurrencies && transferToAmount !== lastAutoValueRef.current;
      const fxRateSource: 'NBU' | 'manual' | undefined = differentCurrencies
        ? (userEdited ? 'manual' : 'NBU')
        : undefined;
      // Snapshot fxRate of the FROM currency to UZS for the summary calculation.
      let baseAmount: number | undefined;
      let fxRate: number | undefined;
      if (transferFrom.currency !== BASE_CURRENCY) {
        const r = await getRateToBase(transferFrom.currency, txDate);
        if (r && r > 0) {
          fxRate = r;
          baseAmount = Math.round(amt * r);
        }
      }
      // Balance changes happen atomically server-side; FX snapshot stays client-computed.
      await transfer({
        fromCardId: transferFrom.id,
        toCardId: transferTo.id,
        amount: amt,
        toAmount: toAmt,
        baseAmount,
        fxRate,
        fxRateSource,
      });
      setShowTransfer(false);
    } catch (err: unknown) {
      setTransferError((err as { message?: string }).message ?? t('common.error_generic'));
    } finally {
      setTransferSaving(false);
    }
  };

  const TAB_LABELS: Record<AccountView, string> = {
    accounts: t('accounts.tab_accounts'),
    savings:  t('accounts.tab_savings'),
    debts:    t('accounts.tab_debts'),
  };

  const FAB_CONFIG: Record<string, { icon: React.ReactNode; label: string }> = {
    'accounts/debit':   { icon: <HiCreditCard size={20} />, label: t('accounts.fab_debit')   },
    'accounts/credit':  { icon: <HiCreditCard size={20} />, label: t('accounts.fab_credit')  },
    'accounts/cash':    { icon: <HiBanknotes  size={20} />, label: t('accounts.fab_cash')    },
    'savings':          { icon: <HiPlus       size={20} />, label: t('accounts.fab_goal')    },
    'debts':            { icon: <HiPlus       size={20} />, label: t('accounts.fab_debt')    },
  };

  const fabKey = view === 'accounts' ? `accounts/${subTab}` : view;
  const fab    = FAB_CONFIG[fabKey];

  const handleFabClick = () => {
    if (!isPremium) {
      if (view === 'savings') { premiumGate.open('savings'); return; }
      if (view === 'debts')   { premiumGate.open('debts');   return; }
      if (view === 'accounts') {
        if (subTab === 'credit' || subTab === 'cash') {
          premiumGate.open('credit_cash');
          return;
        }
        if (cards.length >= 1) {
          premiumGate.open('cards');
          return;
        }
      }
    }
    setAddTrigger(n => n + 1);
  };

  const switchView   = (v: AccountView)    => { setView(v);   setAddTrigger(0); };
  const switchSubTab = (t: AccountSubTab)  => { setSubTab(t); setAddTrigger(0); };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>{t('accounts.heading')}</h1>
        {cards.length >= 2 && (
          <button className={styles.transferBtn} aria-label={t('common.transfer')} onClick={openTransfer}>
            <HiArrowsRightLeft size={18} />
          </button>
        )}
      </div>

      <div className={styles.viewTabs}>
        {(Object.keys(TAB_LABELS) as AccountView[]).map(v => {
          const locked = !isPremium && (v === 'savings' || v === 'debts');
          return (
            <button
              key={v}
              className={`${styles.viewTab} ${view === v ? styles.viewTabActive : ''}`}
              onClick={() => switchView(v)}
              style={locked ? { position: 'relative' } : undefined}
            >
              {TAB_LABELS[v]}
              {locked && <PremiumCornerStar />}
            </button>
          );
        })}
      </div>

      {view === 'accounts' && (
        <>
          <div className={styles.subTabs}>
            {(['debit', 'credit', 'cash'] as AccountSubTab[]).map(tab => {
              const locked = !isPremium && (tab === 'credit' || tab === 'cash');
              return (
                <button
                  key={tab}
                  className={`${styles.subBtn} ${subTab === tab ? styles.subBtnActive : ''}`}
                  onClick={() => switchSubTab(tab)}
                  style={locked ? { position: 'relative' } : undefined}
                >
                  {tab === 'debit' ? t('accounts.sub_debit') : tab === 'credit' ? t('accounts.sub_credit') : t('accounts.sub_cash')}
                  {locked && <PremiumCornerStar />}
                </button>
              );
            })}
          </div>
          {subTab === 'debit'  && <Cards embedded filterType="debit"  addTrigger={addTrigger} />}
          {subTab === 'credit' && <Cards embedded filterType="credit" addTrigger={addTrigger} />}
          {subTab === 'cash'   && <Cash  embedded addTrigger={addTrigger} />}
        </>
      )}
      {view === 'savings'  && <Savings  embedded addTrigger={addTrigger} />}
      {view === 'debts'    && <Debts    embedded addTrigger={addTrigger} />}

      {fab && (
        <button className={styles.fab} onClick={handleFabClick}>
          {fab.icon}
          {fab.label}
        </button>
      )}
      {premiumGate.node}

      {showTransfer && (
        <Modal
          title={t('cards.modal_transfer')}
          onClose={() => setShowTransfer(false)}
          footer={
            <>
              {transferError && <p className={styles.errorMsg}>{transferError}</p>}
              <button
                className={`${styles.saveBtn} ${!canTransfer || transferSaving ? styles.disabled : ''}`}
                onClick={handleTransfer}
                disabled={!canTransfer || transferSaving}
              >
                {transferSaving ? t('common.transferring') : t('cards.btn_transfer')}
              </button>
            </>
          }
        >
          <Select
            label={t('cards.from')}
            value={transferFromId}
            onChange={e => {
              const id = e.target.value;
              setTransferFromId(id);
              if (id === transferToId) setTransferToId(transferFromId);
            }}
            options={cards.map(c => ({ value: c.id, label: `${c.name} (${formatAmount(c.balance, c.currency)})` }))}
          />
          <Select
            label={t('cards.to')}
            value={transferToId}
            onChange={e => {
              const id = e.target.value;
              setTransferToId(id);
              if (id === transferFromId) setTransferFromId(transferToId);
            }}
            options={cards.map(c => ({ value: c.id, label: `${c.name} (${formatAmount(c.balance, c.currency)})` }))}
          />
          <div>
            <label className={styles.fieldLabel}>
              {t('cards.amount_label', { currency: transferFrom?.currency ?? '' })}
            </label>
            <NumberInput
              className={styles.numInput}
              placeholder="0"
              value={transferAmount}
              onChange={setTransferAmount}
              autoFocus
            />
          </div>
          {differentCurrencies && (
            <div>
              <label className={styles.fieldLabel}>
                {t('cards.received_label', { currency: transferTo?.currency ?? '' })}
              </label>
              <NumberInput
                className={styles.numInput}
                placeholder="0"
                value={transferToAmount}
                onChange={(v) => {
                  setTransferToAmount(v);
                  if (v !== lastAutoValueRef.current) setTransferAutoFilled(false);
                }}
              />
              {transferRateInfo && (
                <p className={styles.fxHint}>
                  {transferAutoFilled
                    ? t('cards.fx_auto_hint', { rate: transferRateInfo })
                    : t('cards.fx_manual_hint', { rate: transferRateInfo })}
                </p>
              )}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
};

export default Accounts;
