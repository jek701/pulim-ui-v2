import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HiCheck, HiCreditCard } from 'react-icons/hi2';
import Modal from './Modal';
import { NumberInput } from './NumberInput';
import { formatAmount, formatDate, toDateInput } from '../utils/format';
import type { Transaction, Category, Card } from '../types';
import { useCategoryName } from '../utils/categoryName';
import styles from './ReturnModal.module.css';
import {Input} from "./FormField.tsx";

interface Props {
  transactions: Transaction[];
  categories: Category[];
  cards: Card[];
  preselectedTx?: Transaction;
  onSave: (returnAmount: number, originalTxId: string, accountId: string, date: number, comment?: string) => Promise<void>;
  onClose: () => void;
}

const ReturnModal: React.FC<Props> = ({ transactions, categories, cards, preselectedTx, onSave, onClose }) => {
  const { t, i18n } = useTranslation();
  const categoryName = useCategoryName();

  const expenses = transactions.filter(tx => tx.type === 'expense' && tx.source !== 'return');

  const [selectedTxId, setSelectedTxId] = useState(preselectedTx?.id ?? '');
  const [amountStr, setAmountStr] = useState(() => {
    if (!preselectedTx) return '';
    const remaining = preselectedTx.amount - (preselectedTx.returnedAmount ?? 0);
    return String(remaining > 0 ? remaining : '');
  });
  const [accountId, setAccountId] = useState(cards[0]?.id ?? '');
  const [date, setDate] = useState(toDateInput(Date.now()));
  const [filterDate, setFilterDate] = useState(toDateInput(Date.now()));
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selectedTx = expenses.find(tx => tx.id === selectedTxId);
  const remaining = selectedTx
    ? selectedTx.amount - (selectedTx.returnedAmount ?? 0)
    : 0;
  const amount = parseFloat(amountStr) || 0;
  const exceeds = selectedTx && amount > remaining;

  const canSave = selectedTxId && amount > 0 && !exceeds && accountId && date;

  const selectedAccount = cards.find(c => c.id === accountId);

  const getTxName = (tx: Transaction) => {
    if (tx.sourceLabel) return tx.sourceLabel;
    const cat = categories.find(c => c.id === tx.categoryId);
    return categoryName(cat) || t('common.transaction');
  };

  const getTxIcon = (tx: Transaction) => {
    if (tx.source === 'debt_payment') return '💳';
    if (tx.source === 'savings') return '🐷';
    const cat = categories.find(c => c.id === tx.categoryId);
    return cat?.icon ?? '📦';
  };

  const filteredExpenses = expenses.filter(tx => {
    if ((tx.amount - (tx.returnedAmount ?? 0)) <= 0) return false;
    if (filterDate) {
      const txDate = new Date(tx.date);
      const txDateStr = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}-${String(txDate.getDate()).padStart(2, '0')}`;
      if (txDateStr !== filterDate) return false;
    }
    return getTxName(tx).toLowerCase();
  }).slice(0, 30);

  const groupedExpenses = (() => {
    const map = new Map<string, typeof filteredExpenses>();
    for (const tx of filteredExpenses) {
      const key = formatDate(tx.date, i18n.language, t('common.today_label'), t('common.yesterday_label'));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(tx);
    }
    return Array.from(map.entries());
  })();

  const handleSave = async () => {
    if (!canSave || !selectedTx) return;
    if (amount > remaining) { setError(t('return.err_exceeds')); return; }
    setSaving(true);
    setError('');
    try {
      await onSave(amount, selectedTxId, accountId, new Date(date).getTime(), comment.trim() || undefined);
      onClose();
    } catch (err: unknown) {
      setError((err as { message?: string }).message ?? t('common.error_save'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={t('return.modal_title')}
      onClose={onClose}
      footer={
        <>
          {error && <p className={styles.errorMsg}>{error}</p>}
          <button
            className={`${styles.saveBtn} ${!canSave || saving ? styles.disabled : ''}`}
            onClick={handleSave}
            disabled={!canSave || saving}
          >
            <HiCheck size={18} />
            {saving ? t('common.saving') : t('return.btn_save')}
          </button>
        </>
      }
    >
      {/* Amount */}
      <div>
        <p className={styles.fieldLabel}>
          {t('return.amount_label', { currency: selectedAccount?.currency ?? selectedTx?.currency ?? 'UZS' })}
        </p>
        <NumberInput
          className={styles.numInput}
          placeholder="0"
          value={amountStr}
          onChange={setAmountStr}
          autoFocus
        />
        {exceeds && <p className={styles.errorInline}>{t('return.err_exceeds')}</p>}
      </div>

      {/* Who refunded the money / why */}
      <Input
        label={t('return.comment_label')}
        placeholder={t('return.comment_placeholder')}
        value={comment}
        onChange={e => setComment(e.target.value)}
        maxLength={200}
      />

      {/* Original transaction picker */}
      <div>
        <p className={styles.fieldLabel}>{t('return.pick_transaction')}</p>
        <div className={styles.filterRow}>
          <input
            type="date"
            className={styles.filterDateInput}
            value={filterDate}
            onChange={e => setFilterDate(e.target.value)}
          />
          {filterDate && (
            <button className={styles.filterClear} onClick={() => setFilterDate('')}>✕</button>
          )}
        </div>
        <div className={styles.txList}>
          {groupedExpenses.length === 0 ? (
            <p className={styles.emptyTx}>{t('return.no_transactions')}</p>
          ) : (
            groupedExpenses.map(([dateLabel, txs]) => (
              <div key={dateLabel}>
                <div className={styles.txDateHeader}>{dateLabel}</div>
                {txs.map(tx => {
                  const txRemaining = tx.amount - (tx.returnedAmount ?? 0);
                  return (
                    <button
                      key={tx.id}
                      className={`${styles.txItem} ${selectedTxId === tx.id ? styles.txActive : ''}`}
                      onClick={() => {
                        setSelectedTxId(tx.id);
                        const r = tx.amount - (tx.returnedAmount ?? 0);
                        setAmountStr(String(r > 0 ? r : ''));
                      }}
                    >
                      <span className={styles.txItemIcon}>{getTxIcon(tx)}</span>
                      <div className={styles.txItemInfo}>
                        <span className={styles.txItemName}>{getTxName(tx)}</span>
                        <span className={styles.txItemMeta}>
                          {formatAmount(tx.amount, tx.currency)}
                          {tx.returnedAmount ? ` · ${t('return.label_already_returned')}: ${formatAmount(tx.returnedAmount, tx.currency)}` : ''}
                        </span>
                      </div>
                      <span className={styles.txItemRemaining}>{formatAmount(txRemaining, tx.currency)}</span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {selectedTx && (
          <div className={styles.txSummary}>
            <div className={styles.txSummaryRow}>
              <span>{t('return.label_original')}</span>
              <span>{formatAmount(selectedTx.amount, selectedTx.currency)}</span>
            </div>
            {(selectedTx.returnedAmount ?? 0) > 0 && (
              <div className={styles.txSummaryRow}>
                <span>{t('return.label_already_returned')}</span>
                <span className={styles.returnedColor}>−{formatAmount(selectedTx.returnedAmount!, selectedTx.currency)}</span>
              </div>
            )}
            <div className={`${styles.txSummaryRow} ${styles.txSummaryTotal}`}>
              <span>{t('return.label_remaining')}</span>
              <span>{formatAmount(remaining, selectedTx.currency)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Account picker */}
      {cards.length > 0 && (
        <div>
          <p className={styles.fieldLabel}>{t('return.pick_account')}</p>
          <div className={styles.cardRow}>
            {cards.map(card => (
              <button
                key={card.id}
                className={`${styles.cardChip} ${accountId === card.id ? styles.cardActive : ''}`}
                onClick={() => setAccountId(card.id)}
              >
                <HiCreditCard size={14} />
                <span>{card.name}</span>
                <span className={styles.cardCur}>{card.currency}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Date */}
      <Input label={t('return.date_label')} type="date" value={date} onChange={e => setDate(e.target.value)} />
    </Modal>
  );
};

export default ReturnModal;
