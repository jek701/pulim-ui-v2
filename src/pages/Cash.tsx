import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { HiPlus, HiTrash, HiBanknotes, HiPencil, HiCheckCircle, HiOutlineMinusCircle } from 'react-icons/hi2';
import { useApp } from '../context';
import { useCards } from '../hooks/useCards';
import { useEntitlements } from '../hooks/useEntitlements';
import { usePremiumGate } from '../components/PremiumLock';
import { formatAmount } from '../utils/format';
import { CURRENCIES } from '../utils/currencies';
import type { Currency } from '../types';
import Modal from '../components/Modal';
import { Input, Select } from '../components/FormField';
import { NumberInput } from '../components/NumberInput';
import PageLoader from '../components/PageLoader';
import styles from './Cash.module.css';

const Cash = ({ embedded, addTrigger }: { embedded?: boolean; addTrigger?: number }) => {
  const { t } = useTranslation();
  const { user } = useApp();
  const { cards, add, update, remove, loading } = useCards(user?.uid ?? null);
  const { isPremium } = useEntitlements();
  const premiumGate = usePremiumGate();
  const wallets = cards.filter(c => c.cardType === 'cash');

  const [showAdd, setShowAdd] = useState(false);
  const [editingWallet, setEditingWallet] = useState<typeof wallets[0] | null>(null);
  const [editBalanceStr, setEditBalanceStr] = useState('');

  useEffect(() => {
    if (addTrigger && addTrigger > 0) {
      if (!isPremium) { premiumGate.open('credit_cash'); return; }
      setShowAdd(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addTrigger]);
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState<Currency>('UZS');
  const [balanceStr, setBalanceStr] = useState('');
  const [includeInTotalBalance, setIncludeInTotalBalance] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSetBalance = async () => {
    if (!editingWallet) return;
    const newBalance = parseFloat(editBalanceStr);
    if (isNaN(newBalance)) return;
    await update(editingWallet.id, { balance: newBalance });
    setEditingWallet(null);
    setEditBalanceStr('');
  };

  const handleAdd = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError('');
    try {
      await add({
        cardType: 'cash',
        name: name.trim(),
        bank: '',
        currency,
        balance: parseFloat(balanceStr) || 0,
        includeInTotalBalance,
      });
      setShowAdd(false);
      setName('');
      setBalanceStr('');
      setIncludeInTotalBalance(true);
    } catch (err: unknown) {
      setError((err as { message?: string }).message ?? t('common.error_save'));
    } finally {
      setSaving(false);
    }
  };

  const toggleIncludedInTotals = async (id: string, currentValue: boolean | undefined) => {
    await update(id, { includeInTotalBalance: currentValue === false });
  };

  if (loading) return <PageLoader />;

  const content = (
    <>
      {!embedded && (
        <div className={styles.ctaBar}>
          <button className={styles.addBtn} onClick={() => { if (!isPremium) { premiumGate.open('credit_cash'); return; } setIncludeInTotalBalance(true); setShowAdd(true); }}>
            <HiPlus size={18} /> {t('cash.btn_add')}
          </button>
        </div>
      )}

      {wallets.length === 0 ? (
        <div className={styles.empty}>
          <HiBanknotes size={40} color="var(--text3)" />
          <p>{t('cash.empty')}</p>
        </div>
      ) : (
        <div className={styles.list}>
          {wallets.map(w => (
            <div key={w.id} className={styles.walletCard}>
              <div className={styles.walletIcon}>💵</div>
              <div className={styles.walletMain}>
                <p className={styles.walletName}>{w.name}</p>
                <button
                  className={`${styles.includeBtn} ${w.includeInTotalBalance === false ? styles.includeBtnOff : styles.includeBtnOn}`}
                  onClick={() => toggleIncludedInTotals(w.id, w.includeInTotalBalance)}
                  type="button"
                >
                  {w.includeInTotalBalance === false ? <HiOutlineMinusCircle size={15} /> : <HiCheckCircle size={15} />}
                  {w.includeInTotalBalance === false ? t('cards.excluded_short') : t('cards.included_short')}
                </button>
              </div>
              <p className={styles.walletBalance}>{formatAmount(w.balance, w.currency)}</p>
              <button className={styles.editBalBtn} onClick={() => { setEditingWallet(w); setEditBalanceStr(String(w.balance)); }}>
                <HiPencil size={14} />
              </button>
              <button className={styles.delBtn} onClick={() => confirm(t('cash.confirm_delete')) && remove(w.id)}>
                <HiTrash size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      {editingWallet && (
        <Modal
          title={t('cash.modal_edit_balance')}
          onClose={() => { setEditingWallet(null); setEditBalanceStr(''); }}
          footer={
            <button
              className={`${styles.saveBtn} ${editBalanceStr === '' ? styles.disabled : ''}`}
              onClick={handleSetBalance}
              disabled={editBalanceStr === ''}
            >
              {t('cash.btn_set_balance')}
            </button>
          }
        >
          <div>
            <label className={styles.fieldLabel}>
              {t('cash.new_balance_label', { currency: editingWallet.currency })}
            </label>
            <NumberInput className={styles.numInput} placeholder="0" value={editBalanceStr} onChange={setEditBalanceStr} autoFocus />
          </div>
        </Modal>
      )}

      {showAdd && (
        <Modal
          title={t('cash.modal_add')}
          onClose={() => { setShowAdd(false); setName(''); setBalanceStr(''); setIncludeInTotalBalance(true); }}
          footer={
            <>
              {error && <p className={styles.errorMsg}>{error}</p>}
              <button
                className={`${styles.saveBtn} ${!name.trim() || saving ? styles.disabled : ''}`}
                onClick={handleAdd}
                disabled={!name.trim() || saving}
              >
                {saving ? t('common.saving') : t('cash.btn_save')}
              </button>
            </>
          }
        >
          <Input label={t('common.name')} placeholder={t('cash.name_placeholder')} value={name} onChange={e => setName(e.target.value)} />
          <Select
            label={t('common.currency')}
            value={currency}
            onChange={e => setCurrency(e.target.value as Currency)}
            options={CURRENCIES.map(c => ({ value: c.code, label: `${c.code} — ${c.name}` }))}
          />
          <div>
            <label className={styles.fieldLabel}>{t('cash.balance_label')}</label>
            <NumberInput className={styles.numInput} placeholder="0" value={balanceStr} onChange={setBalanceStr} />
          </div>
          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={includeInTotalBalance}
              onChange={e => setIncludeInTotalBalance(e.target.checked)}
            />
            <span>{t('cards.include_in_total')}</span>
          </label>
        </Modal>
      )}
      {premiumGate.node}
    </>
  );

  return embedded ? content : (
    <div className={styles.page}>
      <div className={styles.header}><h1>{t('cash.heading')}</h1></div>
      {content}
    </div>
  );
};

export default Cash;
