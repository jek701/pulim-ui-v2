import type { CardNetwork } from '../../utils/cardNetwork';
import { HUMO_MARK, UZCARD_MARK } from './networkMarks';
import styles from './CardNetworkMark.module.css';

const LABEL: Record<CardNetwork, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  humo: 'Humo',
  uzcard: 'Uzcard',
  unionpay: 'UnionPay',
  mir: 'Мир',
  amex: 'American Express',
  jcb: 'JCB',
};

/**
 * Simplified payment-network mark drawn in CSS so it reads on any gradient.
 * Scales with the parent's font-size.
 */
const CardNetworkMark = ({ network }: { network: CardNetwork }) => {
  const label = LABEL[network];
  switch (network) {
    case 'mastercard':
      return <span className={styles.mastercard} role="img" aria-label={label}><i /><i /></span>;
    case 'unionpay':
      return (
        <span className={styles.unionpay} role="img" aria-label={label}>
          <i /><i /><i /><b>UnionPay</b>
        </span>
      );
    case 'jcb':
      return (
        <span className={styles.jcb} role="img" aria-label={label}>
          <i>J</i><i>C</i><i>B</i>
        </span>
      );
    case 'amex':
      return <span className={styles.amex} role="img" aria-label={label}>AMEX</span>;
    case 'visa':
      return <span className={styles.visa} role="img" aria-label={label}>VISA</span>;
    case 'humo':
    case 'uzcard': {
      const mark = network === 'humo' ? HUMO_MARK : UZCARD_MARK;
      return (
        <svg className={styles[network]} viewBox={mark.viewBox} role="img" aria-label={label}>
          <path fill="currentColor" fillRule="evenodd" d={mark.d} />
        </svg>
      );
    }
    case 'mir':
      return <span className={styles.mir} role="img" aria-label={label}>МИР</span>;
  }
};

export default CardNetworkMark;
