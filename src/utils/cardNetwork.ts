import type { Card } from '../types';

export type CardNetwork = 'visa' | 'mastercard' | 'humo' | 'uzcard' | 'unionpay' | 'mir' | 'amex' | 'jcb';

/**
 * Whole-word match that also works for Cyrillic (plain `\b` is ASCII-only).
 * No lookbehind: older iOS WebViews in Telegram can't parse it.
 */
const word = (src: string) => new RegExp(`(?:^|[^\\p{L}\\p{N}])(?:${src})(?=$|[^\\p{L}\\p{N}])`, 'iu');

// Order matters only for odd names that mention two networks; the first wins.
const PATTERNS: [CardNetwork, RegExp][] = [
  ['humo', word('humo|хумо|ҳумо')],
  ['uzcard', word('uz\\s?card|узкард|уз\\s?кард')],
  ['visa', word('visa|виза')],
  ['mastercard', word('master\\s?card|master|мастер\\s?кард|мастеркард|мастер|mc')],
  ['unionpay', word('union\\s?pay|юнион\\s?пэй|юнионпей|юнион|upi|cup')],
  ['mir', word('mir|мир')],
  ['amex', word('amex|american\\s?express|амекс')],
  ['jcb', word('jcb')],
];

/**
 * Guesses the payment network from what the user typed. Pulim never stores
 * card numbers, so the account name ("Humo зарплатная", "Visa Gold") and then
 * the bank name are the only signals. Cash wallets have no network.
 */
export function detectCardNetwork(card: Pick<Card, 'cardType' | 'name' | 'bank'>): CardNetwork | null {
  if (card.cardType === 'cash') return null;
  for (const text of [card.name, card.bank]) {
    for (const [network, re] of PATTERNS) {
      if (re.test(text)) return network;
    }
  }
  return null;
}
