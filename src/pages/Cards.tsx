import {useState, useEffect} from 'react';
import {useTranslation} from 'react-i18next';
import {HiTrash, HiCreditCard, HiPencil, HiCheckCircle, HiOutlineMinusCircle, HiArrowDownTray} from 'react-icons/hi2';
import {useApp} from '../context';
import {useCards} from '../hooks/useCards';
import type {NewCard} from '../hooks/useCards';
import {useTransactions} from '../hooks/useTransactions';
import {useEntitlements} from '../hooks/useEntitlements';
import {formatAmount, ordinal} from '../utils/format';
import {CURRENCIES} from '../utils/currencies';
import type {Currency, CardType} from '../types';
import Modal from '../components/Modal';
import {Input, Select} from '../components/FormField';
import {NumberInput} from '../components/NumberInput';
import PageLoader from '../components/PageLoader';
import {PremiumBanner, usePremiumGate} from '../components/PremiumLock';
import { useConfirm } from '../components/ConfirmDialog';
import styles from './Cards.module.css';

const EMPTY_FORM = (): NewCard => ({
    cardType: 'debit',
    name: '',
    bank: '',
    currency: 'UZS',
    balance: 0,
    includeInTotalBalance: true,
    limit: undefined,
    dueDay: undefined,
});

const Cards = ({embedded, filterType, addTrigger}: {
    embedded?: boolean;
    filterType?: 'debit' | 'credit';
    addTrigger?: number
}) => {
    const {t} = useTranslation();
    const {user} = useApp();
    const {isPremium} = useEntitlements();
    const premiumGate = usePremiumGate();
    const { confirm, node: confirmNode } = useConfirm();
    const {cards: allCards, add, update, remove, refill, loading} = useCards(user?.uid ?? null);
    const cards = allCards
        .filter(c => c.cardType !== 'cash' && (!filterType || c.cardType === filterType))
        .sort((a) => a.includeInTotalBalance === true ? -1 : 1)
    const {transfer} = useTransactions(user?.uid ?? null);
    const [showAdd, setShowAdd] = useState(false);
    const [form, setForm] = useState<NewCard>(() => ({...EMPTY_FORM(), cardType: filterType ?? 'debit'}));

    const totalCards = allCards.length;
    const requestAdd = () => {
        if (!isPremium && totalCards >= 1) {
            premiumGate.open('cards');
            return;
        }
        if (!isPremium && filterType === 'credit') {
            premiumGate.open('credit_cash');
            return;
        }
        setForm({...EMPTY_FORM(), cardType: filterType ?? 'debit'});
        setShowAdd(true);
    };

    useEffect(() => {
        if (addTrigger && addTrigger > 0) requestAdd();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [addTrigger]);
    const [balanceStr, setBalanceStr] = useState('');
    const [limitStr, setLimitStr] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // Transfer state
    const [editingBalance, setEditingBalance] = useState<typeof cards[0] | null>(null);
    const [editNameStr, setEditNameStr] = useState('');
    const [editBalanceStr, setEditBalanceStr] = useState('');

    const [showTransfer, setShowTransfer] = useState(false);
    const [transferFromId, setTransferFromId] = useState('');
    const [transferToId, setTransferToId] = useState('');
    const [transferAmount, setTransferAmount] = useState('');
    const [transferToAmount, setTransferToAmount] = useState('');
    const [transferSaving, setTransferSaving] = useState(false);
    const [transferError, setTransferError] = useState('');

    // Refill (pay off credit card debt) state
    const [refillingCard, setRefillingCard] = useState<typeof cards[0] | null>(null);
    const [refillSourceId, setRefillSourceId] = useState('');
    const [refillAmountStr, setRefillAmountStr] = useState('');
    const [refillSaving, setRefillSaving] = useState(false);
    const [refillError, setRefillError] = useState('');

    const set = <K extends keyof NewCard>(k: K, v: NewCard[K]) =>
        setForm(f => ({...f, [k]: v}));

    const switchType = (type: CardType) => {
        if (!isPremium && type === 'credit') {
            premiumGate.open('credit_cash');
            return;
        }
        setForm({...EMPTY_FORM(), cardType: type});
        setBalanceStr('');
        setLimitStr('');
    };

    const canSave = form.name.trim() && form.bank.trim() &&
        (form.cardType === 'debit' || (form.limit && form.limit > 0));

    const transferFrom = cards.find(c => c.id === transferFromId);
    const transferTo = cards.find(c => c.id === transferToId);
    const differentCurrencies = transferFrom && transferTo && transferFrom.currency !== transferTo.currency;
    const canTransfer = transferFromId && transferToId && transferFromId !== transferToId &&
        parseFloat(transferAmount) > 0 &&
        (!differentCurrencies || parseFloat(transferToAmount) > 0);

    const handleTransfer = async () => {
        if (!canTransfer || !transferFrom || !transferTo) return;
        const amt = parseFloat(transferAmount);
        const toAmt = differentCurrencies ? parseFloat(transferToAmount) : amt;
        setTransferSaving(true);
        setTransferError('');
        try {
            // Atomic server-side transfer (records the transaction + both balances together).
            await transfer({
                fromCardId: transferFrom.id,
                toCardId: transferTo.id,
                amount: amt,
                toAmount: toAmt,
            });
            setShowTransfer(false);
        } catch (err: unknown) {
            setTransferError((err as { message?: string }).message ?? t('common.error_generic'));
        } finally {
            setTransferSaving(false);
        }
    };

    // ── Refill (pay off credit debt) ──────────────────────────────────────────
    const REFILL_CHIPS: Record<Currency, number[]> = {
        UZS: [100_000, 500_000, 1_000_000],
        USD: [10, 50, 100],
        EUR: [10, 50, 100],
        RUB: [1_000, 5_000, 10_000],
        GBP: [10, 50, 100],
        CNY: [100, 500, 1_000],
        KZT: [10_000, 50_000, 100_000],
        TRY: [100, 500, 1_000],
        AED: [50, 200, 500],
        JPY: [10_000, 50_000, 100_000],
    };
    const formatChip = (n: number): string => {
        if (n >= 1_000_000) return `${n / 1_000_000}M`;
        if (n >= 1_000) return `${n / 1_000}K`;
        return String(n);
    };

    const debitSources = allCards.filter(c =>
        (c.cardType === 'debit' || c.cardType === 'cash')
        && refillingCard
        && c.currency === refillingCard.currency,
    );
    const refillSource = debitSources.find(c => c.id === refillSourceId);
    const refillDebt = refillingCard ? Math.max(0, refillingCard.balance) : 0;
    const refillMax = refillSource ? Math.min(refillDebt, Math.max(0, refillSource.balance)) : refillDebt;
    const refillAmt = parseFloat(refillAmountStr) || 0;
    const refillCanSave = refillingCard && refillSource && refillAmt > 0 && refillAmt <= refillMax;

    const openRefill = (card: typeof cards[0]) => {
        setRefillingCard(card);
        const sources = allCards.filter(c =>
            (c.cardType === 'debit' || c.cardType === 'cash') && c.currency === card.currency,
        );
        setRefillSourceId(sources[0]?.id ?? '');
        setRefillAmountStr('');
        setRefillError('');
    };

    const closeRefill = () => {
        setRefillingCard(null);
        setRefillSourceId('');
        setRefillAmountStr('');
        setRefillError('');
    };

    const handleRefill = async () => {
        if (!refillCanSave || !refillingCard || !refillSource) return;
        setRefillSaving(true);
        setRefillError('');
        try {
            // Atomic server-side refill (pays down credit debt from the source account).
            await refill(refillingCard.id, refillSource.id, refillAmt);
            closeRefill();
        } catch (err: unknown) {
            setRefillError((err as { message?: string }).message ?? t('common.error_generic'));
        } finally {
            setRefillSaving(false);
        }
    };

    const openEditAccount = (card: typeof cards[0]) => {
        setEditingBalance(card);
        setEditNameStr(card.name);
        setEditBalanceStr(String(card.cardType === 'credit'
            ? (card.limit ?? 0) - card.balance
            : card.balance));
    };

    const closeEditAccount = () => {
        setEditingBalance(null);
        setEditNameStr('');
        setEditBalanceStr('');
    };

    const handleSetBalance = async () => {
        if (!editingBalance) return;
        const entered = parseFloat(editBalanceStr);
        if (isNaN(entered) || !editNameStr.trim()) return;
        // For credit cards, the user is editing "Left to use" — convert back to debt.
        const newBalance = editingBalance.cardType === 'credit'
            ? Math.max(0, (editingBalance.limit ?? 0) - entered)
            : entered;
        await update(editingBalance.id, {name: editNameStr.trim(), balance: newBalance});
        closeEditAccount();
    };

    const toggleIncludedInTotals = async (id: string, currentValue: boolean | undefined) => {
        await update(id, {includeInTotalBalance: currentValue === false});
    };

    const handleAdd = async () => {
        if (!canSave) return;
        if (!isPremium && totalCards >= 1) {
            premiumGate.open('cards');
            return;
        }
        if (!isPremium && form.cardType !== 'debit') {
            premiumGate.open('credit_cash');
            return;
        }
        setSaving(true);
        setError('');
        try {
            const data: NewCard = {
                ...form,
                balance: Number(form.balance) || 0,
                limit: form.cardType === 'credit' ? Number(form.limit) || 0 : undefined,
                dueDay: form.cardType === 'credit' ? Number(form.dueDay) || 1 : undefined,
            };
            await add(data);
            setShowAdd(false);
            setForm(EMPTY_FORM());
            setBalanceStr('');
            setLimitStr('');
        } catch (err: unknown) {
            const e = err as { message?: string };
            setError(e.message ?? t('common.error_save'));
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <PageLoader/>;

    const cardList = (
        <>
            {cards.length === 0 ? (
                <div className={styles.empty}>
                    <HiCreditCard size={48} color="var(--text3)"/>
                    <p>{t('cards.empty', {type: filterType ?? 'card'})}</p>
                    <p>{t('cards.empty_hint')}</p>
                </div>
            ) : (
                <div className={styles.list}>
                    {cards.map(card => {
                        const isCredit = card.cardType === 'credit';
                        const pct = isCredit && card.limit && card.limit > 0
                            ? Math.min((card.balance / card.limit) * 100, 100)
                            : 0;
                        const isHigh = pct > 80;

                        return (
                            <div key={card.id} className={styles.card}>
                                <div className={styles.cardTop}>
                                    <div>
                                        <div className={styles.cardMeta}>
                                            <p className={styles.cardBank}>{card.bank}</p>
                                            <span
                                                className={`${styles.typeBadge} ${isCredit ? styles.creditBadge : styles.debitBadge}`}>
                        {isCredit ? t('cards.badge_credit') : t('cards.badge_debit')}
                      </span>
                                        </div>
                                        <p className={styles.cardName}>{card.name}</p>
                                    </div>
                                    <div className={styles.cardTopActions}>
                                        <button className={styles.editAccountBtn} onClick={() => openEditAccount(card)} aria-label={t('common.edit')}>
                                            <HiPencil size={15}/>
                                        </button>
                                        <button className={styles.delBtn}
                                                aria-label={t('common.delete')}
                                                onClick={async () => {
                                                    const ok = await confirm({
                                                        title: t('cards.confirm_delete'),
                                                        message: `${card.name} · ${formatAmount(card.balance, card.currency)}`,
                                                        warning: t('common.action_irreversible'),
                                                        confirmLabel: t('common.delete'),
                                                    });
                                                    if (ok) remove(card.id);
                                                }}>
                                            <HiTrash size={16}/>
                                        </button>
                                    </div>
                                </div>

                                {isCredit && card.limit && (
                                    <div className={styles.limitBar} style={{
                                        display: "grid",
                                        gridTemplateColumns: `${pct}% ${100 - pct}%`,
                                    }}>
                                        <div
                                            className={styles.limitFill}
                                            style={{background: "transparent"}}
                                        />
                                        <div className={styles.limitUnfilled} style={{
                                            background: "black",
                                        }}/>
                                    </div>
                                )}

                                <div className={styles.cardStats}>
                                    {isCredit ? (
                                        <>
                                            <div className={styles.statWithEdit}>
                                                <div>
                                                    <p className={styles.cardLabel}>{t('cards.label_left')}</p>
                                                    <p className={`${styles.cardVal} ${isHigh ? styles.danger : ''}`}>
                                                        {formatAmount(((card.limit ?? 0) - card.balance), card.currency)}
                                                    </p>
                                                </div>
                                            </div>
                                            <div>
                                                <p className={styles.cardLabel}>{t('cards.label_limit')}</p>
                                                <p className={styles.cardVal}>{formatAmount(card.limit ?? 0, card.currency)}</p>
                                            </div>
                                            {card.dueDay && (
                                                <div>
                                                    <p className={styles.cardLabel}>{t('cards.label_due')}</p>
                                                    <p className={styles.cardVal}>{ordinal(card.dueDay)}</p>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className={styles.debitStats}>
                                            <div className={styles.statWithEdit}>
                                                <div>
                                                    <p className={styles.cardLabel}>{t('cards.label_balance')}</p>
                                                    <p className={`${styles.cardVal} ${styles.debitBal}`}>
                                                        {formatAmount(card.balance, card.currency)}
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                className={`${styles.includeBtn} ${card.includeInTotalBalance === false ? styles.includeBtnOff : styles.includeBtnOn}`}
                                                onClick={() => toggleIncludedInTotals(card.id, card.includeInTotalBalance)}
                                                type="button"
                                            >
                                                {card.includeInTotalBalance === false ?
                                                    <HiOutlineMinusCircle size={15}/> : <HiCheckCircle size={15}/>}
                                                {card.includeInTotalBalance === false ? t('cards.excluded_short') : t('cards.included_short')}
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {isCredit && card.balance > 0 && (
                                    <button
                                        className={styles.refillBtnFull}
                                        onClick={() => openRefill(card)}
                                    >
                                        <HiArrowDownTray size={15}/>
                                        <span>{t('cards.refill_btn')}</span>
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

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
                        options={cards.map(c => ({
                            value: c.id,
                            label: `${c.name} (${formatAmount(c.balance, c.currency)})`
                        }))}
                    />
                    <Select
                        label={t('cards.to')}
                        value={transferToId}
                        onChange={e => {
                            const id = e.target.value;
                            setTransferToId(id);
                            if (id === transferFromId) setTransferFromId(transferToId);
                        }}
                        options={cards.map(c => ({
                            value: c.id,
                            label: `${c.name} (${formatAmount(c.balance, c.currency)})`
                        }))}
                    />
                    <div>
                        <label className={styles.fieldLabel}>
                            {t('cards.amount_label', {currency: transferFrom?.currency ?? ''})}
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
                                {t('cards.received_label', {currency: transferTo?.currency ?? ''})}
                            </label>
                            <NumberInput
                                className={styles.numInput}
                                placeholder="0"
                                value={transferToAmount}
                                onChange={setTransferToAmount}
                            />
                        </div>
                    )}
                </Modal>
            )}

            {editingBalance && (
                <Modal
                    title={t('cards.modal_edit_account')}
                    onClose={closeEditAccount}
                    footer={
                        <button
                            className={styles.saveBtn}
                            onClick={handleSetBalance}
                            disabled={editBalanceStr === '' || !editNameStr.trim()}
                        >
                            {t('common.save')}
                        </button>
                    }
                >
                    <Input
                        label={t('cards.name_label')}
                        value={editNameStr}
                        onChange={event => setEditNameStr(event.target.value)}
                        autoFocus
                    />
                    <div>
                        <label className={styles.fieldLabel}>
                            {editingBalance.cardType === 'credit'
                                ? t('cards.new_left_label', {currency: editingBalance.currency})
                                : t('cards.new_balance_label', {currency: editingBalance.currency})}
                        </label>
                        <NumberInput
                            className={styles.numInput}
                            placeholder="0"
                            value={editBalanceStr}
                            onChange={setEditBalanceStr}
                            allowNegative={editingBalance.cardType !== 'credit'}
                        />
                        {editingBalance.cardType === 'credit' && (
                            <p className={styles.fieldHint}>
                                {t('cards.new_left_hint')}
                            </p>
                        )}
                    </div>
                </Modal>
            )}

            {refillingCard && (
                <Modal
                    title={t('cards.refill_title', {name: refillingCard.name})}
                    onClose={closeRefill}
                    footer={
                        <>
                            {refillError && <p className={styles.errorMsg}>{refillError}</p>}
                            <button
                                className={`${styles.saveBtn} ${!refillCanSave || refillSaving ? styles.disabled : ''}`}
                                onClick={handleRefill}
                                disabled={!refillCanSave || refillSaving}
                            >
                                {refillSaving ? t('common.saving') : t('cards.refill_confirm')}
                            </button>
                        </>
                    }
                >
                    <div className={styles.refillSummary}>
                        <div>
                            <p className={styles.cardLabel}>{t('cards.label_debt')}</p>
                            <p className={styles.refillDebt}>
                                {formatAmount(refillDebt, refillingCard.currency)}
                            </p>
                        </div>
                        <div>
                            <p className={styles.cardLabel}>{t('cards.label_left')}</p>
                            <p className={styles.refillLeft}>
                                {formatAmount((refillingCard.limit ?? 0) - refillingCard.balance, refillingCard.currency)}
                            </p>
                        </div>
                    </div>

                    {debitSources.length === 0 ? (
                        <p className={styles.fieldHint}>
                            {t('cards.refill_no_source', {currency: refillingCard.currency})}
                        </p>
                    ) : (
                        <>
                            <Select
                                label={t('cards.refill_from')}
                                value={refillSourceId}
                                onChange={e => setRefillSourceId(e.target.value)}
                                options={debitSources.map(c => ({
                                    value: c.id,
                                    label: `${c.name} (${formatAmount(c.balance, c.currency)})`,
                                }))}
                            />
                            <div>
                                <label className={styles.fieldLabel}>
                                    {t('cards.refill_amount', {currency: refillingCard.currency})}
                                </label>
                                <NumberInput
                                    className={styles.numInput}
                                    placeholder="0"
                                    value={refillAmountStr}
                                    onChange={setRefillAmountStr}
                                />
                                <div className={styles.refillChips}>
                                    {(REFILL_CHIPS[refillingCard.currency] ?? REFILL_CHIPS.UZS)
                                        .filter(v => v <= refillMax)
                                        .map(v => (
                                            <button
                                                key={v}
                                                type="button"
                                                className={`${styles.chip} ${refillAmt === v ? styles.chipActive : ''}`}
                                                onClick={() => setRefillAmountStr(String(v))}
                                            >
                                                {formatChip(v)}
                                            </button>
                                        ))}
                                    {refillMax > 0 && (
                                        <button
                                            type="button"
                                            className={`${styles.chip} ${styles.chipMax} ${refillAmt === refillMax ? styles.chipActive : ''}`}
                                            onClick={() => setRefillAmountStr(String(refillMax))}
                                        >
                                            {t('cards.refill_max')}
                                        </button>
                                    )}
                                </div>
                                <p className={styles.fieldHint}>
                                    {t('cards.refill_hint', {
                                        max: formatAmount(refillMax, refillingCard.currency),
                                    })}
                                </p>
                            </div>
                        </>
                    )}
                </Modal>
            )}

            {showAdd && (
                <Modal
                    title={t('cards.modal_add')}
                    onClose={() => {
                        setShowAdd(false);
                        setForm({...EMPTY_FORM(), cardType: filterType ?? 'debit'});
                        setBalanceStr('');
                        setLimitStr('');
                    }}
                    footer={
                        <>
                            {error && <p className={styles.errorMsg}>{error}</p>}
                            <button
                                className={`${styles.saveBtn} ${!canSave || saving ? styles.disabled : ''}`}
                                onClick={handleAdd}
                                disabled={!canSave || saving}
                            >
                                {saving ? t('common.saving') : t('cards.btn_add')}
                            </button>
                        </>
                    }
                >
                    <div className={styles.typeToggle}>
                        <button
                            className={`${styles.typeBtn} ${form.cardType === 'debit' ? styles.debitActive : ''}`}
                            onClick={() => switchType('debit')}
                        >
                            {t('cards.type_debit')}
                        </button>
                        <button
                            className={`${styles.typeBtn} ${form.cardType === 'credit' ? styles.creditActive : ''}`}
                            onClick={() => switchType('credit')}
                        >
                            {t('cards.type_credit')}
                        </button>
                    </div>

                    <Input label={t('cards.name_label')} placeholder={t('cards.name_placeholder')} value={form.name}
                           onChange={e => set('name', e.target.value)}/>
                    <Input label={t('common.bank')} placeholder={t('cards.bank_placeholder')} value={form.bank}
                           onChange={e => set('bank', e.target.value)}/>
                    <Select
                        label={t('common.currency')}
                        value={form.currency}
                        onChange={e => set('currency', e.target.value as Currency)}
                        options={CURRENCIES.map(c => ({value: c.code, label: `${c.code} — ${c.name}`}))}
                    />
                    <div>
                        <label className={styles.fieldLabel}>
                            {form.cardType === 'debit' ? t('cards.balance_debit_label') : t('cards.balance_credit_label')}
                        </label>
                        <NumberInput
                            className={styles.numInput}
                            placeholder="0"
                            value={balanceStr}
                            allowNegative={form.cardType === 'debit'}
                            onChange={v => {
                                setBalanceStr(v);
                                set('balance', parseFloat(v) || 0);
                            }}
                        />
                    </div>

                    {form.cardType === 'debit' && (
                        <label className={styles.checkboxRow}>
                            <input
                                type="checkbox"
                                checked={form.includeInTotalBalance !== false}
                                onChange={e => set('includeInTotalBalance', e.target.checked)}
                            />
                            <span>{t('cards.include_in_total')}</span>
                        </label>
                    )}

                    {form.cardType === 'credit' && (
                        <>
                            <div>
                                <label className={styles.fieldLabel}>{t('cards.limit_label')}</label>
                                <NumberInput
                                    className={styles.numInput}
                                    placeholder="0"
                                    value={limitStr}
                                    onChange={v => {
                                        setLimitStr(v);
                                        set('limit', parseFloat(v) || 0);
                                    }}
                                />
                            </div>
                            <Select
                                label={t('cards.due_day_label')}
                                value={form.dueDay ?? 1}
                                onChange={e => set('dueDay', Number(e.target.value))}
                                options={Array.from({length: 31}, (_, i) => ({value: i + 1, label: ordinal(i + 1)}))}
                            />
                        </>
                    )}
                </Modal>
            )}
            {premiumGate.node}
            {confirmNode}
        </>
    );

    return embedded ? cardList : (
        <div className={styles.page}>
            <div className={styles.header}>
                <h1>{t('cards.heading')}</h1>
            </div>
            {!isPremium && cards.length === 0 && (
                <PremiumBanner feature="cards" />
            )}
            {cardList}
        </div>
    );
};

export default Cards;
