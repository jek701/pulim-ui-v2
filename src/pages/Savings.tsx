import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context';
import { useSavingsGoals } from '../hooks/useSavingsGoals';
import { useCards } from '../hooks/useCards';
import { useEntitlements } from '../hooks/useEntitlements';
import { usePremiumGate, PremiumBanner } from '../components/PremiumLock';
import { useConfirm } from '../components/ConfirmDialog';
import { formatAmount, formatTotalsByCurrency } from '../utils/format';
import { goalProgress } from '../utils/goalMath';
import PageLoader from '../components/PageLoader';
import PlasticSection, { PlasticItem, PlasticList, PlasticStack } from '../components/plastic/PlasticSection';
import EmptyState from '../components/plastic/EmptyState';
import GoalPlastic from '../components/savings/GoalPlastic';
import GoalSheet from '../components/savings/GoalSheet';
import GoalFormModal from '../components/savings/GoalFormModal';
import ContributeModal from '../components/savings/ContributeModal';

type Overlay =
  | { kind: 'sheet'; id: string }
  | { kind: 'add' }
  | { kind: 'edit'; id: string }
  | { kind: 'contribute'; id: string }
  | null;

/** Savings goals tab of the Accounts page. `addTrigger` bumps when the page FAB is tapped. */
const Savings = ({ addTrigger, onEmptyChange }: { addTrigger?: number; onEmptyChange?: (empty: boolean) => void }) => {
  const { t } = useTranslation();
  const { user } = useApp();
  const { goals, loading, add, contribute, update, remove } = useSavingsGoals(user?.uid ?? null);
  const { cards } = useCards(user?.uid ?? null);
  const { isPremium } = useEntitlements();
  const premiumGate = usePremiumGate();
  const { confirm, node: confirmNode } = useConfirm();
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [showDone, setShowDone] = useState(false);

  const isEmpty = !loading && goals.length === 0;
  useEffect(() => { onEmptyChange?.(isEmpty); }, [isEmpty, onEmptyChange]);

  const requestAdd = () => {
    if (!isPremium) { premiumGate.open('savings'); return; }
    setOverlay({ kind: 'add' });
  };

  useEffect(() => {
    if (addTrigger && addTrigger > 0) requestAdd();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addTrigger]);

  const goal = overlay && 'id' in overlay ? goals.find(g => g.id === overlay.id) : undefined;

  const handleDelete = async (id: string) => {
    const target = goals.find(g => g.id === id);
    if (!target) return;
    setOverlay(null);
    const ok = await confirm({
      title: t('savings.confirm_delete'),
      message: `${target.name} · ${formatAmount(target.savedAmount, target.currency)} / ${formatAmount(target.targetAmount, target.currency)}`,
      warning: t('common.action_irreversible'),
      confirmLabel: t('common.delete'),
    });
    if (ok) await remove(id);
  };

  if (loading) return <PageLoader />;

  const active = goals.filter(g => !goalProgress(g).done);
  const done = goals.filter(g => goalProgress(g).done);
  let index = 0;

  return (
    <>
      {!isPremium && <PremiumBanner feature="savings" />}

      {goals.length === 0 ? (
        <EmptyState
          title={t('savings.empty')}
          hint={t('savings.empty_hint')}
          actionLabel={t('savings.empty_btn')}
          onAction={requestAdd}
          ghosts={[['#A16207', '#F59E0B'], ['#0369A1', '#22D3EE'], ['#7C3AED', '#C026D3']]}
          emoji="🐷"
        />
      ) : (
        <PlasticList>
          {active.length > 0 && (
            <PlasticSection
              title={t('savings.section_active')}
              count={active.length}
              total={formatTotalsByCurrency(active, g => g.savedAmount)}
            >
              <PlasticStack>
                {active.map(g => (
                  <PlasticItem key={g.id} index={index++} label={g.name} onOpen={() => setOverlay({ kind: 'sheet', id: g.id })}>
                    <GoalPlastic goal={g} />
                  </PlasticItem>
                ))}
              </PlasticStack>
            </PlasticSection>
          )}
          {done.length > 0 && (
            <PlasticSection
              title={t('savings.section_done')}
              count={done.length}
              toggle={{ open: showDone, onToggle: () => setShowDone(v => !v) }}
            >
              {showDone && (
                <PlasticStack>
                  {done.map(g => (
                    <PlasticItem key={g.id} index={index++} label={g.name} onOpen={() => setOverlay({ kind: 'sheet', id: g.id })}>
                      <GoalPlastic goal={g} />
                    </PlasticItem>
                  ))}
                </PlasticStack>
              )}
            </PlasticSection>
          )}
        </PlasticList>
      )}

      {overlay?.kind === 'sheet' && goal && (
        <GoalSheet
          goal={goal}
          onContribute={() => setOverlay({ kind: 'contribute', id: goal.id })}
          onEdit={() => setOverlay({ kind: 'edit', id: goal.id })}
          onDelete={() => handleDelete(goal.id)}
          onClose={() => setOverlay(null)}
        />
      )}
      {overlay?.kind === 'add' && <GoalFormModal onAdd={add} onClose={() => setOverlay(null)} />}
      {overlay?.kind === 'edit' && goal && (
        <GoalFormModal goal={goal} onUpdate={update} onClose={() => setOverlay(null)} />
      )}
      {overlay?.kind === 'contribute' && goal && (
        <ContributeModal
          goal={goal}
          cards={cards}
          // Atomic: increment savedAmount + optional account debit + transaction, server-side.
          onContribute={(amount, cardId) => contribute(goal.id, amount, cardId || undefined)}
          onClose={() => setOverlay(null)}
        />
      )}
      {premiumGate.node}
      {confirmNode}
    </>
  );
};

export default Savings;
