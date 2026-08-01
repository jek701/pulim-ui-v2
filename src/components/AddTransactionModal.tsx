import {useState, useMemo} from 'react';
import {
    HiCheck,
    HiCreditCard,
    HiArrowsUpDown,
    HiBars3,
    HiMagnifyingGlass,
    HiChevronDown,
    HiBanknotes,
    HiBuildingLibrary,
    HiSparkles,
    HiXMark,
} from 'react-icons/hi2';
import {useTranslation} from 'react-i18next';
import {
    DndContext,
    closestCenter,
    PointerSensor,
    TouchSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import {
    SortableContext,
    useSortable,
    verticalListSortingStrategy,
    arrayMove,
} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import Modal from './Modal';
import {Input, Textarea} from './FormField';
import {NumberInput} from './NumberInput';
import type {Category, Subcategory, Currency, Card, Transaction, CardType} from '../types';
import type {NewTransaction} from '../hooks/useTransactions';
import {CURRENCIES} from '../utils/currencies';
import {getRateToBase, BASE_CURRENCY} from '../utils/nbuRates';
import {formatAmount, toDateInput} from '../utils/format';
import {useCategoryName} from '../utils/categoryName';
import styles from './AddTransactionModal.module.css';

function applyOrder(cards: Card[], order: string[]): Card[] {
    if (!order.length) return cards;
    return [...cards].sort((a, b) => {
        const ai = order.indexOf(a.id);
        const bi = order.indexOf(b.id);
        if (ai === -1 && bi === -1) return 0;
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
    });
}

interface SortableCardItemProps {
    card: Card;
}

function SortableCardItem({card}: SortableCardItemProps) {
    const {attributes, listeners, setNodeRef, transform, transition, isDragging} = useSortable({id: card.id});

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} className={styles.reorderItem}>
            <HiCreditCard size={14} className={styles.reorderCardIcon}/>
            <span className={styles.reorderName}>{card.name}</span>
            <span className={styles.reorderCur}>{card.currency}</span>
            <button
                className={styles.dragHandle}
                {...attributes}
                {...listeners}
                type="button"
                aria-label="Drag to reorder"
            >
                <HiBars3 size={18}/>
            </button>
        </div>
    );
}

interface Props {
    categories: Category[];
    subcategories: Subcategory[];
    cards: Card[];
    cardOrder: string[];
    userId?: string;
    initialData?: Transaction;
    onAdd: (data: NewTransaction) => Promise<void>;
    onClose: () => void;
    onReturn?: () => void;
    onSaveCardOrder: (ids: string[]) => Promise<void>;
    recentCardIds?: string[];
    launchHint?: {
        visible: boolean;
        onDismiss: () => void;
        onOpenSettings: () => void;
    };
}

const AddTransactionModal: React.FC<Props> = ({
                                                  categories, subcategories, cards, cardOrder, initialData,
                                                  onAdd, onClose, onReturn, onSaveCardOrder,
                                                  recentCardIds = [], launchHint,
                                              }) => {
    const {t} = useTranslation();
    const categoryName = useCategoryName();
    const editing = !!initialData;
    const [type, setType] = useState<'income' | 'expense'>(initialData?.type ?? 'expense');
    const [amount, setAmount] = useState(initialData ? String(initialData.amount) : '');
    const [currency, setCurrency] = useState<Currency>(initialData?.currency ?? 'UZS');
    const [categoryId, setCategoryId] = useState(initialData?.categoryId ?? '');
    const [subcategoryId, setSubcategoryId] = useState(initialData?.subcategoryId ?? '');
    const [cardId, setCardId] = useState(initialData?.cardId ?? (cards.length === 1 ? cards[0].id : ''));
    const [date, setDate] = useState(initialData ? toDateInput(initialData.date) : toDateInput(Date.now()));
    const [comment, setComment] = useState(initialData?.comment ?? '');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [showReorder, setShowReorder] = useState(false);
    const [showCardPicker, setShowCardPicker] = useState(false);
    const [cardSearch, setCardSearch] = useState('');

    const sortedCards = useMemo(() => applyOrder(cards, cardOrder), [cards, cardOrder]);
    const selectedCard = useMemo(() => cards.find(card => card.id === cardId), [cards, cardId]);

    const recentCards = useMemo(() => {
        const byId = new Map(sortedCards.map(card => [card.id, card]));
        return recentCardIds.map(id => byId.get(id)).filter((card): card is Card => Boolean(card)).slice(0, 3);
    }, [recentCardIds, sortedCards]);

    const cardGroups = useMemo(() => {
        const query = cardSearch.trim().toLocaleLowerCase();
        const matches = sortedCards.filter(card => {
            if (!query) return true;
            return [card.name, card.bank, card.currency, card.cardType, t(`add_transaction.account_${card.cardType}`)]
                .some(value => value.toLocaleLowerCase().includes(query));
        });
        const recentIds = new Set(query ? [] : recentCards.map(card => card.id));
        const group = (type: CardType) => matches.filter(card => card.cardType === type && !recentIds.has(card.id));
        return {
            recent: query ? [] : recentCards,
            debit: group('debit'),
            credit: group('credit'),
            cash: group('cash'),
        };
    }, [cardSearch, recentCards, sortedCards, t]);

    const sensors = useSensors(
        useSensor(PointerSensor, {activationConstraint: {distance: 5}}),
        useSensor(TouchSensor, {activationConstraint: {delay: 150, tolerance: 5}})
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const {active, over} = event;
        if (!over || active.id === over.id) return;
        const oldIndex = sortedCards.findIndex(c => c.id === active.id);
        const newIndex = sortedCards.findIndex(c => c.id === over.id);
        const newOrder = arrayMove(sortedCards, oldIndex, newIndex).map(c => c.id);
        onSaveCardOrder(newOrder);
    };

    const filteredCats = categories.filter(c => c.type === type || c.type === 'both');
    const filteredSubs = subcategories.filter(s => s.categoryId === categoryId);
    const cardRequired = cards.length > 0;
    const canSave = !!amount && parseFloat(amount) > 0 && !!categoryId && (!cardRequired || !!cardId);

    const selectCard = (id: string) => {
        setCardId(id);
        const card = cards.find(c => c.id === id);
        if (card) setCurrency(card.currency);
        setShowCardPicker(false);
        setCardSearch('');
    };

    const cardIcon = (card: Card) => {
        if (card.cardType === 'cash') return <HiBanknotes size={18}/>;
        if (card.cardType === 'credit') return <HiCreditCard size={18}/>;
        return <HiBuildingLibrary size={18}/>;
    };

    const accountDisplayAmount = (card: Card) => card.cardType === 'credit'
        ? Math.max((card.limit ?? card.balance) - card.balance, 0)
        : card.balance;

    const renderCardOption = (card: Card) => (
        <button
            type="button"
            key={card.id}
            className={`${styles.accountOption} ${cardId === card.id ? styles.accountOptionActive : ''}`}
            onClick={() => selectCard(card.id)}
        >
            <span className={`${styles.accountIcon} ${styles[`accountIcon_${card.cardType}`]}`}>
                {cardIcon(card)}
            </span>
            <span className={styles.accountMain}>
                <span className={styles.accountName}>{card.name}</span>
                <span className={styles.accountMeta}>
                    {t(`add_transaction.account_${card.cardType}`)}{card.bank ? ` · ${card.bank}` : ''}
                </span>
            </span>
            <span className={styles.accountAmount}>
                <span>{formatAmount(accountDisplayAmount(card), card.currency)}</span>
                <small>{t(card.cardType === 'credit' ? 'add_transaction.account_available' : 'add_transaction.account_balance')}</small>
            </span>
            {cardId === card.id && <HiCheck className={styles.accountCheck} size={18}/>}
        </button>
    );

    const renderCardGroup = (title: string, groupCards: Card[]) => {
        if (!groupCards.length) return null;
        return (
            <section className={styles.accountGroup}>
                <p className={styles.accountGroupTitle}>{title}</p>
                <div className={styles.accountGroupList}>{groupCards.map(renderCardOption)}</div>
            </section>
        );
    };

    const handleSave = async () => {
        if (!canSave) return;
        setSaving(true);
        setError('');
        try {
            const amt = parseFloat(amount);
            const txDate = new Date(date).getTime();
            let baseAmount: number | undefined;
            let fxRate: number | undefined;
            let fxRateSource: 'NBU' | 'manual' | undefined;
            if (currency !== BASE_CURRENCY) {
                const rate = await getRateToBase(currency, txDate);
                if (rate && rate > 0) {
                    fxRate = rate;
                    baseAmount = Math.round(amt * rate);
                    fxRateSource = 'NBU';
                }
            }
            await onAdd({
                amount: amt,
                currency,
                type,
                categoryId,
                subcategoryId: subcategoryId || undefined,
                cardId: cardId || undefined,
                comment: comment.trim() || undefined,
                date: txDate,
                baseAmount,
                fxRate,
                fxRateSource,
            });
            onClose();
        } catch (err: unknown) {
            const e = err as { message?: string };
            setError(e.message ?? 'Failed to save. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            title={editing ? t('add_transaction.title_edit') : t('add_transaction.title_new')}
            onClose={onClose}
            footer={
                <>
                    {error && <p className={styles.errorMsg}>{error}</p>}
                    <button
                        className={`${styles.saveBtn} ${!canSave || saving ? styles.disabled : ''}`}
                        onClick={handleSave}
                        disabled={!canSave || saving}
                    >
                        <HiCheck size={18}/>
                        {saving ? t('common.saving') : editing ? t('add_transaction.btn_update') : t('add_transaction.btn_save')}
                    </button>
                </>
            }
        >
            {launchHint?.visible && (
                <div className={styles.launchHint} role="status">
                    <span className={styles.launchHintIcon}><HiSparkles size={20}/></span>
                    <div className={styles.launchHintCopy}>
                        <strong>{t('add_transaction.auto_hint_title')}</strong>
                        <p>{t('add_transaction.auto_hint_text')}</p>
                        <div className={styles.launchHintActions}>
                            <button type="button" onClick={launchHint.onOpenSettings}>{t('add_transaction.auto_hint_settings')}</button>
                            <button type="button" onClick={launchHint.onDismiss}>{t('add_transaction.auto_hint_done')}</button>
                        </div>
                    </div>
                    <button
                        type="button"
                        className={styles.launchHintClose}
                        aria-label={t('common.close')}
                        onClick={launchHint.onDismiss}
                    >
                        <HiXMark size={17}/>
                    </button>
                </div>
            )}

            {/* Type toggle */}
            <div className={styles.typeRow}>
                <button
                    className={`${styles.typeBtn} ${type === 'expense' ? styles.expenseActive : ''}`}
                    onClick={() => {
                        setType('expense');
                        setCategoryId('');
                        setSubcategoryId('');
                    }}
                >
                    {t('add_transaction.type_expense')}
                </button>
                <button
                    className={`${styles.typeBtn} ${type === 'income' ? styles.incomeActive : ''}`}
                    onClick={() => {
                        setType('income');
                        setCategoryId('');
                        setSubcategoryId('');
                    }}
                >
                    {t('add_transaction.type_income')}
                </button>
                {!editing && onReturn && (
                    <button
                        className={`${styles.typeBtn} ${styles.returnBtn}`}
                        onClick={onReturn}
                    >
                        {t('add_transaction.type_return')}
                    </button>
                )}
            </div>

            {/* Card picker */}
            {cards.length > 0 && (
                <div>
                    <div className={styles.cardLabelRow}>
                        <p className={styles.fieldLabel}>
                            {t(type === 'expense' ? 'add_transaction.account_from' : 'add_transaction.account_to')}
                            {' '}<span className={styles.required}>*</span>
                        </p>
                    </div>

                    {showReorder ? (
                        <div className={styles.reorderPanel}>
                            <div className={styles.reorderHeader}>
                                <span><HiArrowsUpDown size={15}/>{t('add_transaction.reorder_accounts')}</span>
                                <button type="button" onClick={() => setShowReorder(false)}>{t('common.done')}</button>
                            </div>
                            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                <SortableContext items={sortedCards.map(c => c.id)} strategy={verticalListSortingStrategy}>
                                    <div className={styles.reorderList}>
                                        {sortedCards.map(card => (
                                            <SortableCardItem key={card.id} card={card}/>
                                        ))}
                                    </div>
                                </SortableContext>
                            </DndContext>
                        </div>
                    ) : (
                        <div className={styles.accountPickerWrap}>
                            <button
                                type="button"
                                className={`${styles.accountSelect} ${showCardPicker ? styles.accountSelectOpen : ''}`}
                                onClick={() => setShowCardPicker(open => !open)}
                                aria-expanded={showCardPicker}
                            >
                                {selectedCard ? (
                                    <>
                                        <span className={`${styles.accountIcon} ${styles[`accountIcon_${selectedCard.cardType}`]}`}>
                                            {cardIcon(selectedCard)}
                                        </span>
                                        <span className={styles.accountMain}>
                                            <span className={styles.accountName}>{selectedCard.name}</span>
                                            <span className={styles.accountMeta}>
                                                {t(`add_transaction.account_${selectedCard.cardType}`)}
                                                {selectedCard.bank ? ` · ${selectedCard.bank}` : ''} · {selectedCard.currency}
                                            </span>
                                        </span>
                                        <span className={styles.selectedAmount}>
                                            {formatAmount(accountDisplayAmount(selectedCard), selectedCard.currency)}
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <span className={`${styles.accountIcon} ${styles.accountIconEmpty}`}><HiCreditCard size={18}/></span>
                                        <span className={styles.accountPlaceholder}>{t('add_transaction.account_select')}</span>
                                    </>
                                )}
                                <HiChevronDown className={`${styles.accountChevron} ${showCardPicker ? styles.accountChevronOpen : ''}`} size={18}/>
                            </button>

                            {showCardPicker && (
                                <div className={styles.accountPicker}>
                                    <label className={styles.accountSearch}>
                                        <HiMagnifyingGlass size={18}/>
                                        <input
                                            type="search"
                                            value={cardSearch}
                                            onChange={event => setCardSearch(event.target.value)}
                                            placeholder={t('add_transaction.account_search')}
                                        />
                                        {cardSearch && (
                                            <button type="button" onClick={() => setCardSearch('')} aria-label={t('common.close')}>
                                                <HiXMark size={17}/>
                                            </button>
                                        )}
                                    </label>

                                    <div className={styles.accountResults}>
                                        {renderCardGroup(t('add_transaction.account_recent'), cardGroups.recent)}
                                        {renderCardGroup(t('add_transaction.account_debit'), cardGroups.debit)}
                                        {renderCardGroup(t('add_transaction.account_credit'), cardGroups.credit)}
                                        {renderCardGroup(t('add_transaction.account_cash'), cardGroups.cash)}
                                        {!cardGroups.recent.length && !cardGroups.debit.length && !cardGroups.credit.length && !cardGroups.cash.length && (
                                            <p className={styles.accountEmpty}>{t('add_transaction.account_no_results')}</p>
                                        )}
                                    </div>
                                    {cards.length > 1 && (
                                        <button
                                            type="button"
                                            className={styles.accountReorderAction}
                                            onClick={() => {
                                                setShowCardPicker(false);
                                                setShowReorder(true);
                                            }}
                                        >
                                            <HiArrowsUpDown size={15}/>
                                            {t('add_transaction.reorder_accounts')}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Amount + currency */}
            <div className={styles.amountRow}>
                <NumberInput
                    className={styles.amountInput}
                    placeholder="0"
                    value={amount}
                    onChange={setAmount}
                />
                <select
                    className={styles.currencyPick}
                    value={currency}
                    onChange={e => setCurrency(e.target.value as Currency)}
                >
                    {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
                </select>
            </div>

            {/* Categories */}
            <div>
                <p className={styles.fieldLabel}>{t('add_transaction.category_label')}</p>
                <div className={styles.catGrid}>
                    {filteredCats.map(cat => (
                        <button
                            key={cat.id}
                            className={`${styles.catItem} ${categoryId === cat.id ? styles.catActive : ''}`}
                            style={categoryId === cat.id ? {borderColor: cat.color} : {}}
                            onClick={() => {
                                setCategoryId(cat.id);
                                setSubcategoryId('');
                            }}
                        >
              <span className={styles.catIcon} style={{background: cat.color + '22'}}>
                {cat.icon}
              </span>
                            <span className={styles.catName}>{categoryName(cat)}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Subcategories */}
            {filteredSubs.length > 0 && (
                <div>
                    <p className={styles.fieldLabel}>{t('add_transaction.subcategory_label')}</p>
                    <div className={styles.subRow}>
                        <button
                            className={`${styles.subChip} ${!subcategoryId ? styles.subActive : ''}`}
                            onClick={() => setSubcategoryId('')}
                        >
                            {t('add_transaction.subcategory_none')}
                        </button>
                        {filteredSubs.map(s => (
                            <button
                                key={s.id}
                                className={`${styles.subChip} ${subcategoryId === s.id ? styles.subActive : ''}`}
                                onClick={() => setSubcategoryId(s.id)}
                            >
                                {s.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <Input label={t('common.date')} type="date" value={date} onChange={e => setDate(e.target.value)}/>
            <Textarea label={t('add_transaction.comment_placeholder')}
                      placeholder={t('add_transaction.comment_placeholder')} value={comment}
                      onChange={e => setComment(e.target.value)} rows={2}/>
        </Modal>
    );
};

export default AddTransactionModal;
