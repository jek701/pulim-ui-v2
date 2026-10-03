import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context';
import { useDebts } from '../hooks/useDebts';
import { useCards } from '../hooks/useCards';
import { useEntitlements } from '../hooks/useEntitlements';
import { usePremiumGate, PremiumBanner } from '../components/PremiumLock';
import { useConfirm } from '../components/ConfirmDialog';
import { formatAmount, formatTotalsByCurrency } from '../utils/format';
import { debtRemaining } from '../utils/debtMath';
import type { Debt, DebtDirection } from '../types';
import PageLoader from '../components/PageLoader';
import PlasticSection, { PlasticItem, PlasticList, PlasticStack } from '../components/plastic/PlasticSection';
import EmptyState from '../components/plastic/EmptyState';
import DebtPlastic from '../components/debts/DebtPlastic';
import DebtSheet from '../components/debts/DebtSheet';
import DebtFormModal from '../components/debts/DebtFormModal';
import DebtEditModal from '../components/debts/DebtEditModal';
import PayDebtModal from '../components/debts/PayDebtModal';
import styles from './Debts.module.css';

type Overlay =
  | { kind: 'sheet'; id: string }
  | { kind: 'add' }
  | { kind: 'edit'; id: string }
  | { kind: 'pay'; id: string; full: boolean }
  | null;

const DIRECTIONS: DebtDirection[] = ['i_owe', 'owe_me'];

/** Who owes how much, merged across that person's records (case-insensitive name). */
function groupByPerson(debts: Debt[], locale: string) {
  const groups = new Map<string, { person: string; items: Debt[] }>();
  for (const d of debts) {
    const key = d.person.trim().toLocaleLowerCase(locale);
    const group = groups.get(key) ?? { person: d.person.trim(), items: [] };
    group.items.push(d);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => a.person.localeCompare(b.person, locale));
}

/** Debts tab of the Accounts page. `addTrigger` bumps when the page FAB is tapped. */
const Debts = ({ addTrigger, onEmptyChange }: { addTrigger?: number; onEmptyChange?: (empty: boolean) => void }) => {
  const { t, i18n } = useTranslation();
  const { user } = useApp();
  const { debts, add, togglePaid, pay, update, remove, loading } = useDebts(user?.uid ?? null);
  const { cards } = useCards(user?.uid ?? null);
  const { isPremium } = useEntitlements();
  const premiumGate = usePremiumGate();
  const { confirm, node: confirmNode } = useConfirm();
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [peopleOpen, setPeopleOpen] = useState<Record<DebtDirection, boolean>>({ i_owe: false, owe_me: false });
  const [showPaid, setShowPaid] = useState(false);

  const isEmpty = !loading && debts.length === 0;
  useEffect(() => { onEmptyChange?.(isEmpty); }, [isEmpty, onEmptyChange]);

  const requestAdd = () => {
    if (!isPremium) { premiumGate.open('debts'); return; }
    setOverlay({ kind: 'add' });
  };

  useEffect(() => {
    if (addTrigger && addTrigger > 0) requestAdd();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addTrigger]);

  const debt = overlay && 'id' in overlay ? debts.find(d => d.id === overlay.id) : undefined;

  const handleDelete = async (id: string) => {
    const target = debts.find(d => d.id === id);
    if (!target) return;
    setOverlay(null);
    const ok = await confirm({
      title: t('debts.confirm_delete'),
      message: `${target.person} · ${formatAmount(target.amount, target.currency)}`,
      warning: t('common.action_irreversible'),
      confirmLabel: t('common.delete'),
    });
    if (ok) await remove(id);
  };

  if (loading) return <PageLoader />;

  const paidDebts = debts.filter(d => d.isPaid);
  let index = 0;
  const renderStack = (items: Debt[]) => (
    <PlasticStack>
      {items.map(d => (
        <PlasticItem key={d.id} index={index++} label={d.person} onOpen={() => setOverlay({ kind: 'sheet', id: d.id })}>
          <DebtPlastic debt={d} />
        </PlasticItem>
      ))}
    </PlasticStack>
  );

  return (
    <>
      {!isPremium && <PremiumBanner feature="debts" />}

      {debts.length === 0 ? (
        <EmptyState
          title={t('debts.empty_title')}
          hint={t('debts.empty_hint')}
          actionLabel={t('debts.btn_add')}
          onAction={requestAdd}
          ghosts={[['#047857', '#34D399'], ['#374151', '#6B7280'], ['#B91C1C', '#F97316']]}
          emoji="🤝"
        />
      ) : (
        <PlasticList>
          {DIRECTIONS.map(direction => {
            const items = debts.filter(d => d.direction === direction && !d.isPaid);
            if (items.length === 0) return null;
            const open = peopleOpen[direction];
            const people = groupByPerson(items, i18n.language);
            return (
              <PlasticSection
                key={direction}
                title={direction === 'i_owe' ? t('debts.tab_i_owe') : t('debts.tab_owe_me')}
                count={items.length}
                total={formatTotalsByCurrency(items, debtRemaining)}
                toggle={{
                  open,
                  onToggle: () => setPeopleOpen(p => ({ ...p, [direction]: !p[direction] })),
                  label: t(open ? 'debts.summary_hide' : 'debts.summary_show'),
                }}
              >
                {open && (
                  <div className={styles.people}>
                    {people.map(g => (
                      <div key={g.person} className={styles.personRow}>
                        <span className={`${styles.avatar} ${direction === 'i_owe' ? styles.avatarOwe : styles.avatarOwed}`}>
                          {g.person.charAt(0).toUpperCase()}
                        </span>
                        <span className={styles.personName}>
                          <span>{g.person}</span>
                          <small>{t('debts.records_count', { count: g.items.length })}</small>
                        </span>
                        <span className={styles.personAmounts}>
                          {formatTotalsByCurrency(g.items, debtRemaining).split(' · ').map(a => <span key={a}>{a}</span>)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {renderStack(items)}
              </PlasticSection>
            );
          })}
          {paidDebts.length > 0 && (
            <PlasticSection
              title={t('debts.section_paid')}
              count={paidDebts.length}
              toggle={{ open: showPaid, onToggle: () => setShowPaid(v => !v) }}
            >
              {showPaid && renderStack(paidDebts)}
            </PlasticSection>
          )}
        </PlasticList>
      )}

      {overlay?.kind === 'sheet' && debt && (
        <DebtSheet
          debt={debt}
          onPayPart={() => setOverlay({ kind: 'pay', id: debt.id, full: false })}
          onPayAll={() => setOverlay({ kind: 'pay', id: debt.id, full: true })}
          onReopen={() => { setOverlay(null); void togglePaid(debt.id, false); }}
          onEdit={() => setOverlay({ kind: 'edit', id: debt.id })}
          onDelete={() => handleDelete(debt.id)}
          onClose={() => setOverlay(null)}
        />
      )}
      {overlay?.kind === 'add' && (
        <DebtFormModal debts={debts} cards={cards} onAdd={add} onClose={() => setOverlay(null)} />
      )}
      {overlay?.kind === 'edit' && debt && (
        <DebtEditModal debt={debt} onUpdate={update} onClose={() => setOverlay(null)} />
      )}
      {overlay?.kind === 'pay' && debt && (
        <PayDebtModal
          debt={debt}
          cards={cards}
          initialAmount={overlay.full ? Math.round(debtRemaining(debt) * 100) / 100 : undefined}
          // Atomic: increment paidAmount, auto-complete, record the transaction + balance.
          onPay={(amount, cardId) => pay(debt.id, amount, cardId)}
          onClose={() => setOverlay(null)}
        />
      )}
      {premiumGate.node}
      {confirmNode}
    </>
  );
};

export default Debts;
