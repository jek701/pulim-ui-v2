import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { HiBanknotes, HiChartPie, HiCreditCard, HiXMark } from 'react-icons/hi2';
import type { Card, Currency } from '../types';
import { formatAmount } from '../utils/format';
import { useModalClose } from '../hooks/useModalClose';
import { useSwipeDismiss } from '../hooks/useSwipeDismiss';
import styles from './BalanceDetails.module.css';

interface Props {
  cards: Card[];
  onClose: () => void;
}

const COLORS = ['#8B5CF6', '#35C2FF', '#3DDC97', '#FFB454', '#F472B6', '#2DD4BF', '#FACC15', '#FB7185'];

const getAvailableAmount = (card: Card) => (
  card.cardType === 'credit'
    ? Math.max(0, (card.limit ?? 0) - card.balance)
    : card.balance
);

const isIncludedInAvailableTotal = (card: Card) => (
  card.cardType === 'credit' || card.includeInTotalBalance !== false
);

const BalanceDetails = ({ cards, onClose }: Props) => {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const { isClosing, requestClose } = useModalClose(onClose);
  const { swipeRef, swipeAreaProps, swipeStyle } = useSwipeDismiss(requestClose);

  const currencies = useMemo(() => {
    const values = Array.from(new Set(cards.map(card => card.currency)));
    return values.sort((left, right) => {
      if (left === 'UZS') return -1;
      if (right === 'UZS') return 1;
      return left.localeCompare(right);
    });
  }, [cards]);

  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(() => currencies[0] ?? 'UZS');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const activeCurrency = currencies.includes(selectedCurrency) ? selectedCurrency : (currencies[0] ?? 'UZS');

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') requestClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [requestClose]);

  const currencyCards = useMemo(
    () => cards
      .filter(card => card.currency === activeCurrency)
      .sort((left, right) => Math.abs(getAvailableAmount(right)) - Math.abs(getAvailableAmount(left))),
    [activeCurrency, cards],
  );

  const chartCards = useMemo(
    () => currencyCards.filter(card => (
      isIncludedInAvailableTotal(card) && Math.abs(getAvailableAmount(card)) > 0
    )),
    [currencyCards],
  );

  const total = chartCards.reduce((sum, card) => sum + getAvailableAmount(card), 0);
  const magnitudeTotal = chartCards.reduce((sum, card) => sum + Math.abs(getAvailableAmount(card)), 0);

  const segments = useMemo(() => {
    if (magnitudeTotal === 0) return [];

    const gap = Math.min(0.045, 0.28 / chartCards.length);
    const drawableLength = Math.max(0, 1 - gap * chartCards.length);

    return chartCards.map((card, index) => {
        const fraction = Math.abs(getAvailableAmount(card)) / magnitudeTotal;
        const previousLength = chartCards
          .slice(0, index)
          .reduce(
            (sum, previousCard) => sum + (Math.abs(getAvailableAmount(previousCard)) / magnitudeTotal) * drawableLength,
            0,
          );
        return {
          card,
          color: getAvailableAmount(card) < 0 ? '#FF5A5F' : COLORS[index % COLORS.length],
          visible: fraction * drawableLength,
          start: gap / 2 + previousLength + index * gap,
        };
      });
  }, [chartCards, magnitudeTotal]);

  const filterCards = useMemo(() => {
    const hiddenCards = currencyCards.filter(card => card.cardType !== 'credit' && card.includeInTotalBalance === false);
    const creditCards = currencyCards.filter(card => card.cardType === "credit");
    const leftCards = currencyCards.filter(card => card.includeInTotalBalance !== false && (card.cardType === "cash" || card.cardType === "debit"))

    return [...leftCards, ...creditCards, ...hiddenCards]
  }, [currencyCards])

  const selectedSegment = segments.find(segment => segment.card.id === selectedCardId);
  const selectedCard = selectedSegment?.card;

  return createPortal(
    <motion.div
      className={styles.overlay}
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: isClosing ? 0 : 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.2 }}
      onClick={requestClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="balance-details-title"
    >
      <div className={styles.swipeLayer} style={swipeStyle}>
        <motion.section
          className={styles.sheet}
          initial={reduceMotion ? false : { y: '8%', opacity: 0.7 }}
          animate={{ y: isClosing ? '8%' : 0, opacity: isClosing ? 0.7 : 1 }}
          transition={{ duration: reduceMotion ? 0 : isClosing ? 0.22 : 0.42, ease: [0.22, 1, 0.36, 1] }}
          onClick={event => event.stopPropagation()}
          ref={swipeRef}
          {...swipeAreaProps}
        >
          <header className={styles.header}>
            <div className={styles.headerIcon}><HiChartPie size={20} /></div>
            <div className={styles.headerCopy}>
              <h2 id="balance-details-title">{t('home.balance_details_title')}</h2>
              <p>{t('home.balance_details_subtitle')}</p>
            </div>
            <button className={styles.closeBtn} type="button" onClick={requestClose} aria-label={t('common.close')}>
              <HiXMark size={21} />
            </button>
          </header>

        <div className={styles.scroller}>
          {currencies.length > 1 && (
            <div className={styles.currencyTabs} style={{
              gridTemplateColumns: `repeat(${currencies.length}, calc(100% / ${currencies.length}))`
            }} role="tablist" aria-label={t('common.currency')}>
              {currencies.map(currency => (
                <button
                  key={currency}
                  className={`${styles.currencyTab} ${activeCurrency === currency ? styles.currencyTabActive : ''}`}
                  type="button"
                  role="tab"
                  aria-selected={activeCurrency === currency}
                  onClick={() => {
                    setSelectedCurrency(currency);
                    setSelectedCardId(null);
                  }}
                >
                  {currency}
                </button>
              ))}
            </div>
          )}

          {currencyCards.length === 0 ? (
            <div className={styles.emptyState}>
              <span><HiChartPie size={30} /></span>
              <strong>{t('home.balance_details_empty')}</strong>
              <p>{t('home.current_balance_hint')}</p>
            </div>
          ) : (
            <>
              <section className={styles.hero}>
                <div className={styles.chartWrap}>
                  <svg className={styles.chart} viewBox="0 0 300 300" aria-label={t('home.balance_details_chart_label')}>
                    <circle className={styles.chartTrack} cx="150" cy="150" r="112" />
                    <g transform="rotate(-90 150 150)">
                      {segments.map((segment, index) => (
                        <motion.circle
                          key={`${activeCurrency}-${segment.card.id}`}
                          className={`${styles.chartSegment} ${selectedCardId === segment.card.id ? styles.chartSegmentSelected : ''}`}
                          cx="150"
                          cy="150"
                          r="112"
                          pathLength={1}
                          stroke={segment.color}
                          strokeDashoffset={-segment.start}
                          initial={reduceMotion ? false : { strokeDasharray: '0 1', opacity: 0.5 }}
                          animate={{
                            strokeDasharray: `${segment.visible} ${1 - segment.visible}`,
                            opacity: selectedCardId === null || selectedCardId === segment.card.id ? 1 : 0.38,
                          }}
                          transition={{
                            strokeDasharray: {
                              duration: reduceMotion ? 0 : 0.72,
                              delay: reduceMotion ? 0 : 0.18 + index * 0.13,
                              ease: [0.22, 1, 0.36, 1],
                            },
                            opacity: { duration: reduceMotion ? 0 : 0.18, delay: 0 },
                          }}
                          role="button"
                          tabIndex={0}
                          aria-label={`${segment.card.name}: ${formatAmount(getAvailableAmount(segment.card), segment.card.currency)}`}
                          onClick={() => setSelectedCardId(current => current === segment.card.id ? null : segment.card.id)}
                          onKeyDown={event => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              setSelectedCardId(current => current === segment.card.id ? null : segment.card.id);
                            }
                          }}
                        />
                      ))}
                    </g>
                  </svg>
                  <motion.div
                    className={styles.chartCenter}
                    key={selectedCard ? `card-${selectedCard.id}` : `total-${activeCurrency}`}
                    initial={reduceMotion ? false : { scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {selectedCard ? (
                      <>
                        <span style={{ '--selected-color': selectedSegment.color } as React.CSSProperties}>
                          {selectedCard.cardType === 'cash' ? <HiBanknotes size={18} /> : <HiCreditCard size={18} />}
                        </span>
                        <small>{selectedCard.bank || (selectedCard.cardType === 'credit'
                          ? t('home.balance_details_credit')
                          : selectedCard.cardType === 'cash'
                            ? t('home.balance_details_cash')
                            : t('home.balance_details_debit'))}
                        </small>
                        <strong className={styles.selectedName}>{selectedCard.name}</strong>
                        <b>{formatAmount(getAvailableAmount(selectedCard), selectedCard.currency)}</b>
                      </>
                    ) : (
                      <>
                        <small>{t('home.balance_details_total')}</small>
                        <strong className={styles.centerTotal}>{formatAmount(total, activeCurrency)}</strong>
                        <em>{t('home.balance_details_tap_segment')}</em>
                      </>
                    )}
                  </motion.div>
                </div>

              </section>

              <section className={styles.accountsSection}>
                <div className={styles.sectionHeader}>
                  <div>
                    <p>{t('home.balance_details_accounts_title')}</p>
                    <span>{t('home.balance_details_currency_hint', { currency: activeCurrency })}</span>
                  </div>
                  <strong>{currencyCards.length}</strong>
                </div>

                <div className={styles.accountList}>
                  {filterCards.map((card, index) => {
                    const segment = segments.find(item => item.card.id === card.id);
                    const availableAmount = getAvailableAmount(card);
                    const isCredit = card.cardType === 'credit';
                    const isExcluded = !isCredit && card.includeInTotalBalance === false;
                    return (
                      <motion.article
                        className={styles.accountCard}
                        key={`${activeCurrency}-${card.id}`}
                        initial={reduceMotion ? false : { y: -30, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{
                          duration: reduceMotion ? 0 : 0.48,
                          delay: reduceMotion ? 0 : 0.58 + index * 0.09,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                      >
                        <div
                          className={styles.accountIcon}
                          style={{ '--account-color': segment?.color ?? 'var(--text3)' } as React.CSSProperties}
                        >
                          {card.cardType === 'cash' ? <HiBanknotes size={21} /> : <HiCreditCard size={21} />}
                        </div>
                        <div className={styles.accountCopy}>
                          <div className={styles.accountMeta}>
                            <span>{card.cardType === 'cash'
                              ? t('home.balance_details_cash')
                              : (card.bank || t(isCredit ? 'home.balance_details_credit' : 'home.balance_details_debit'))}
                            </span>
                            {isCredit && <span className={styles.accountStatus}>{t('home.balance_details_credit_available')}</span>}
                            {isExcluded && <span className={`${styles.accountStatus} ${styles.accountStatusMuted}`}>{t('home.balance_details_not_included')}</span>}
                          </div>
                          <strong>{card.name}</strong>
                          <p className={availableAmount < 0 ? styles.negativeBalance : ''}>{formatAmount(availableAmount, card.currency)}</p>
                          {isCredit && (
                            <small className={styles.accountLimit}>
                              {t('home.balance_details_credit_limit', { amount: formatAmount(card.limit ?? 0, card.currency) })}
                            </small>
                          )}
                        </div>
                      </motion.article>
                    );
                  })}
                </div>
              </section>
            </>
          )}
          </div>
        </motion.section>
      </div>
    </motion.div>,
    document.body,
  );
};

export default BalanceDetails;
