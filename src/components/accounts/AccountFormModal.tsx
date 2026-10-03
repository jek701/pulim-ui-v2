import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HiChevronLeft, HiChevronRight } from 'react-icons/hi2';
import type { Card, CardType, Currency } from '../../types';
import type { NewCard } from '../../hooks/useCards';
import { CURRENCIES } from '../../utils/currencies';
import { ordinal } from '../../utils/format';
import { autoAccountColorKey } from '../../utils/accountColors';
import { PremiumCornerStar } from '../PremiumLock';
import { Input, Select } from '../FormField';
import { NumberInput } from '../NumberInput';
import Modal from '../Modal';
import ColorSwatches from '../plastic/ColorSwatches';
import AccountPlastic from './AccountPlastic';
import formStyles from '../plastic/forms.module.css';
import styles from './AccountFormModal.module.css';

type Props = {
  isPremium: boolean;
  onLockedType: () => void;
  onClose: () => void;
} & (
  | { card?: undefined; onAdd: (data: NewCard) => Promise<void> }
  | { card: Card; onUpdate: (id: string, data: Partial<NewCard>) => Promise<void> }
);

const TYPES: CardType[] = ['debit', 'credit', 'cash'];

/**
 * Add (type picker → form) or edit an account. The plastic on top is a live
 * preview of what the tile in the list will look like.
 */
const AccountFormModal = (props: Props) => {
  const { t } = useTranslation();
  const editing = props.card;
  const [step, setStep] = useState<'type' | 'form'>(editing ? 'form' : 'type');
  const [cardType, setCardType] = useState<CardType>(editing?.cardType ?? 'debit');
  const [name, setName] = useState(editing?.name ?? '');
  const [bank, setBank] = useState(editing?.bank ?? '');
  const [currency, setCurrency] = useState<Currency>(editing?.currency ?? 'UZS');
  // Credit cards are edited by "available" (what users see), stored as debt.
  const [balanceStr, setBalanceStr] = useState(() => {
    if (!editing) return '';
    return String(editing.cardType === 'credit' ? (editing.limit ?? 0) - editing.balance : editing.balance);
  });
  const [limitStr, setLimitStr] = useState(editing?.limit ? String(editing.limit) : '');
  const [dueDay, setDueDay] = useState(editing?.dueDay ?? 1);
  const [color, setColor] = useState<string | undefined>(editing?.color);
  const [include, setInclude] = useState(editing?.includeInTotalBalance !== false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isCredit = cardType === 'credit';
  const isCash = cardType === 'cash';
  const entered = parseFloat(balanceStr) || 0;
  const limit = parseFloat(limitStr) || 0;
  // Adding a credit card asks for the current debt; editing asks for what is left.
  const debt = isCredit ? (editing ? Math.max(0, limit - entered) : Math.max(0, entered)) : 0;
  const balance = isCredit ? debt : entered;
  const autoKey = autoAccountColorKey({ cardType, bank: isCash ? '' : bank });
  const selectedColor = color ?? autoKey;

  const canSave = name.trim() !== '' && (!isCredit || limit > 0) && !saving
    && (!editing || balanceStr.trim() !== '');

  const pickType = (type: CardType) => {
    if (!props.isPremium && type !== 'debit') {
      props.onLockedType();
      return;
    }
    setCardType(type);
    setStep('form');
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError('');
    try {
      if (props.card) {
        const patch: Partial<NewCard> = { name: name.trim(), balance };
        if (!isCash) patch.bank = bank.trim();
        if (isCredit) {
          patch.limit = limit;
          patch.dueDay = dueDay;
        } else {
          patch.includeInTotalBalance = include;
        }
        if (color) patch.color = color;
        await props.onUpdate(props.card.id, patch);
      } else {
        await props.onAdd({
          cardType,
          name: name.trim(),
          bank: isCash ? '' : bank.trim(),
          currency,
          balance,
          includeInTotalBalance: isCredit ? undefined : include,
          limit: isCredit ? limit : undefined,
          dueDay: isCredit ? dueDay : undefined,
          color: selectedColor,
        });
      }
      props.onClose();
    } catch (err: unknown) {
      setError((err as { message?: string }).message ?? t('common.error_save'));
    } finally {
      setSaving(false);
    }
  };

  if (step === 'type') {
    return (
      <Modal title={t('accounts.choose_type')} onClose={props.onClose}>
        <div className={styles.typeList}>
          {TYPES.map((type, i) => {
            const locked = !props.isPremium && type !== 'debit';
            return (
              <button
                key={type}
                type="button"
                className={styles.typeTile}
                style={{ '--i': i } as React.CSSProperties}
                onClick={() => pickType(type)}
              >
                <span className={`${styles.typeThumb} ${styles[`thumb_${type}`]}`} aria-hidden />
                <span className={styles.typeText}>
                  <strong>{t(`accounts.type_${type}_title`)}</strong>
                  <small>{t(`accounts.type_${type}_desc`)}</small>
                </span>
                <HiChevronRight className={styles.typeChevron} size={18} />
                {locked && <PremiumCornerStar />}
              </button>
            );
          })}
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title={editing ? t('cards.modal_edit_account') : t(`accounts.new_${cardType}`)}
      onClose={props.onClose}
      footer={
        <>
          {error && <p className={formStyles.errorMsg}>{error}</p>}
          <button
            className={`${formStyles.saveBtn} ${!canSave ? formStyles.disabled : ''}`}
            onClick={handleSave}
            disabled={!canSave}
          >
            {saving ? t('common.saving') : editing ? t('common.save') : t('cards.btn_add')}
          </button>
        </>
      }
    >
      {!editing && (
        <button type="button" className={styles.backLink} onClick={() => setStep('type')}>
          <HiChevronLeft size={16} /> {t('accounts.change_type')}
        </button>
      )}

      <AccountPlastic
        placeholderName={t('accounts.preview_name')}
        card={{
          cardType,
          name,
          bank: isCash ? '' : bank,
          currency,
          balance,
          limit: isCredit ? limit : undefined,
          dueDay: isCredit ? dueDay : undefined,
          color: selectedColor,
          includeInTotalBalance: include,
        }}
      />

      <Input
        label={t('cards.name_label')}
        placeholder={isCash ? t('cash.name_placeholder') : t('cards.name_placeholder')}
        value={name}
        onChange={e => setName(e.target.value)}
        autoFocus={!editing}
      />
      {!isCash && (
        <Input
          label={`${t('common.bank')} (${t('common.optional')})`}
          placeholder={t('cards.bank_placeholder')}
          value={bank}
          onChange={e => setBank(e.target.value)}
        />
      )}
      {!editing && (
        <Select
          label={t('common.currency')}
          value={currency}
          onChange={e => setCurrency(e.target.value as Currency)}
          options={CURRENCIES.map(c => ({ value: c.code, label: `${c.code} — ${c.name}` }))}
        />
      )}

      {isCredit && (
        <div className={formStyles.row2}>
          <div>
            <label className={formStyles.fieldLabel}>{t('cards.limit_label')}</label>
            <NumberInput className={formStyles.numInput} placeholder="0" value={limitStr} onChange={setLimitStr} />
          </div>
          <Select
            label={t('cards.label_due')}
            value={dueDay}
            onChange={e => setDueDay(Number(e.target.value))}
            options={Array.from({ length: 31 }, (_, i) => ({ value: i + 1, label: ordinal(i + 1) }))}
          />
        </div>
      )}

      <div>
        <label className={formStyles.fieldLabel}>
          {editing
            ? (isCredit
              ? t('cards.new_left_label', { currency })
              : t('cards.new_balance_label', { currency }))
            : (isCredit ? t('cards.balance_credit_label') : t('cards.balance_debit_label'))}
        </label>
        <NumberInput
          className={formStyles.numInput}
          placeholder="0"
          value={balanceStr}
          onChange={setBalanceStr}
          allowNegative={!isCredit}
        />
        {editing && isCredit && <p className={formStyles.fieldHint}>{t('cards.new_left_hint')}</p>}
      </div>

      <div>
        <label className={formStyles.fieldLabel}>{t('accounts.color_label')}</label>
        <ColorSwatches value={selectedColor} onChange={setColor} label={t('accounts.color_label')} />
      </div>

      {!isCredit && (
        <label className={formStyles.switchRow}>
          <span>{t('cards.include_in_total')}</span>
          <span className={formStyles.switch}>
            <input type="checkbox" checked={include} onChange={e => setInclude(e.target.checked)} />
            <span />
          </span>
        </label>
      )}
    </Modal>
  );
};

export default AccountFormModal;
