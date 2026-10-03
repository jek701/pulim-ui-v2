import { useTranslation } from 'react-i18next';
import { HiBanknotes, HiEyeSlash } from 'react-icons/hi2';
import type { Card } from '../../types';
import { resolveAccountColor } from '../../utils/accountColors';
import { detectCardNetwork } from '../../utils/cardNetwork';
import CardNetworkMark from './CardNetworkMark';
import styles from '../plastic/Plastic.module.css';

export type PlasticData = Pick<Card, 'cardType' | 'name' | 'bank' | 'currency' | 'balance'>
  & Partial<Pick<Card, 'limit' | 'dueDay' | 'color' | 'includeInTotalBalance'>>;

export const HIDDEN_AMOUNT = '••••••';

const fmt = (n: number) => n.toLocaleString('uz-Latn-UZ');

interface Props {
  card: PlasticData;
  size?: 'sm' | 'lg';
  /** Masks every amount (the page-level "hide balances" toggle). */
  hidden?: boolean;
  /** Shown when the name is still empty (live preview in the form). */
  placeholderName?: string;
  className?: string;
  style?: React.CSSProperties;
}

/** Bank-card styled account tile; also used as the live preview in the account form. */
const AccountPlastic = ({ card, size = 'sm', hidden, placeholderName, className, style }: Props) => {
  const { t } = useTranslation();
  const color = resolveAccountColor(card);
  const isCredit = card.cardType === 'credit';
  const isCash = card.cardType === 'cash';
  const limit = card.limit ?? 0;
  const available = isCredit ? limit - card.balance : card.balance;
  const usedPct = isCredit && limit > 0 ? Math.min(100, Math.max(0, (card.balance / limit) * 100)) : 0;
  const excluded = !isCredit && card.includeInTotalBalance === false;
  const network = detectCardNetwork(card);

  const topLabel = (!isCash && card.bank.trim()) || t(`accounts.type_${card.cardType}_title`);

  return (
    <div
      className={`${styles.plastic} ${size === 'lg' ? styles.lg : ''} ${isCash ? styles.cash : ''} ${className ?? ''}`}
      style={{ ...style, '--c-from': color.from, '--c-to': color.to } as React.CSSProperties}
    >
      <span className={styles.orb1} aria-hidden />
      <span className={styles.orb2} aria-hidden />

      <div className={styles.top}>
        <span className={styles.bank}>{topLabel}</span>
        {isCash
          ? <HiBanknotes className={styles.cashMark} size={size === 'lg' ? 28 : 20} aria-hidden />
          : network
            ? <span className={styles.network}><CardNetworkMark network={network} /></span>
            : <span className={styles.circles} aria-hidden><i /><i /></span>}
      </div>

      {size === 'lg' && !isCash && <span className={styles.emv} aria-hidden />}

      <p className={`${styles.name} ${card.name.trim() ? '' : styles.placeholder}`}>
        {card.name.trim() || placeholderName}
      </p>

      <div className={styles.bottom}>
        <div className={styles.amountWrap}>
          {isCredit && <span className={styles.amountLabel}>{t('accounts.available')}</span>}
          <span className={styles.amount}>
            {hidden ? HIDDEN_AMOUNT : fmt(available)}
            <span className={styles.cur}>{card.currency}</span>
          </span>
        </div>
        <div className={styles.chips}>
          {excluded && (
            <span className={styles.chip} title={t('cards.exclude_from_total')}>
              <HiEyeSlash size={12} /> {t('accounts.excluded_chip')}
            </span>
          )}
          {isCredit && card.dueDay && (
            <span className={styles.chip}>{t('accounts.due_chip', { day: card.dueDay })}</span>
          )}
        </div>
      </div>

      {isCredit && limit > 0 && (
        <div className={styles.limitRow}>
          <div className={styles.bar}>
            <i className={usedPct > 80 ? styles.barHot : ''} style={{ width: `${usedPct}%` }} />
          </div>
          <span className={styles.limitText}>
            {t('accounts.of_limit', { limit: hidden ? HIDDEN_AMOUNT : fmt(limit) })}
          </span>
        </div>
      )}
    </div>
  );
};

export default AccountPlastic;
