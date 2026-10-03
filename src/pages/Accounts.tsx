import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HiPlus, HiArrowsRightLeft, HiEye, HiEyeSlash } from 'react-icons/hi2';
import { useApp } from '../context';
import { useCards } from '../hooks/useCards';
import { useTransactions } from '../hooks/useTransactions';
import { useEntitlements } from '../hooks/useEntitlements';
import { usePremiumGate, PremiumCornerStar } from '../components/PremiumLock';
import { useConfirm } from '../components/ConfirmDialog';
import { formatAmount } from '../utils/format';
import PageLoader from '../components/PageLoader';
import AccountsList from '../components/accounts/AccountsList';
import AccountSheet from '../components/accounts/AccountSheet';
import AccountFormModal from '../components/accounts/AccountFormModal';
import TransferModal from '../components/accounts/TransferModal';
import RefillModal from '../components/accounts/RefillModal';
import Savings from './Savings';
import Debts from './Debts';
import styles from './Accounts.module.css';

type AccountView = 'accounts' | 'savings' | 'debts';
const VIEWS: AccountView[] = ['accounts', 'savings', 'debts'];

const HIDE_KEY = 'pulim.hideAccountBalances';

const readHidden = () => {
  try { return localStorage.getItem(HIDE_KEY) === '1'; } catch { return false; }
};

const initialAccountView = (): AccountView => {
  const requested = new URLSearchParams(window.location.search).get('tab');
  return requested === 'debts' || requested === 'savings' ? requested : 'accounts';
};

/** Which account modal is open; only one at a time. */
type Overlay =
  | { kind: 'sheet'; id: string }
  | { kind: 'add' }
  | { kind: 'edit'; id: string }
  | { kind: 'refill'; id: string }
  | { kind: 'transfer'; fromId?: string }
  | null;

const Accounts = () => {
  const { t } = useTranslation();
  const { user } = useApp();
  const { cards, loading, add, update, remove, refill, saveCardOrder } = useCards(user?.uid ?? null);
  const { transfer } = useTransactions(user?.uid ?? null);
  const { isPremium } = useEntitlements();
  const premiumGate = usePremiumGate();
  const { confirm, node: confirmNode } = useConfirm();
  const [view, setView] = useState<AccountView>(initialAccountView);
  const [addTrigger, setAddTrigger] = useState(0);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [hidden, setHidden] = useState(readHidden);
  const [dragging, setDragging] = useState(false);

  const byId = (id: string) => cards.find(c => c.id === id);
  const overlayCard = overlay && 'id' in overlay ? byId(overlay.id) : undefined;

  const toggleHidden = () => {
    const next = !hidden;
    setHidden(next);
    try { localStorage.setItem(HIDE_KEY, next ? '1' : '0'); } catch { /* private mode */ }
  };

  const requestAddAccount = () => {
    if (!isPremium && cards.length >= 1) {
      premiumGate.open('cards');
      return;
    }
    setOverlay({ kind: 'add' });
  };

  const handleFabClick = () => {
    if (view === 'accounts') { requestAddAccount(); return; }
    if (!isPremium) { premiumGate.open(view); return; }
    setAddTrigger(n => n + 1);
  };

  const handleDelete = async (id: string) => {
    const card = byId(id);
    if (!card) return;
    setOverlay(null);
    const ok = await confirm({
      title: t('cards.confirm_delete'),
      message: `${card.name} · ${formatAmount(card.balance, card.currency)}`,
      warning: t('common.action_irreversible'),
      confirmLabel: t('common.delete'),
    });
    if (ok) await remove(id);
  };

  const switchView = (v: AccountView) => { setView(v); setAddTrigger(0); };

  const TAB_LABELS: Record<AccountView, string> = {
    accounts: t('accounts.tab_accounts'),
    savings:  t('accounts.tab_savings'),
    debts:    t('accounts.tab_debts'),
  };

  const FAB_LABELS: Record<AccountView, string> = {
    accounts: t('accounts.fab_account'),
    savings:  t('accounts.fab_goal'),
    debts:    t('accounts.fab_debt'),
  };

  const viewIndex = VIEWS.indexOf(view);

  return (
    <div className={`${styles.page} ${dragging ? styles.pageLocked : ''}`}>
      <div className={styles.header}>
        <h1>{t('accounts.heading')}</h1>
        {view === 'accounts' && cards.length > 0 && (
          <div className={styles.headerActions}>
            <button
              className={styles.iconBtn}
              aria-label={hidden ? t('accounts.show_balances') : t('accounts.hide_balances')}
              aria-pressed={hidden}
              onClick={toggleHidden}
            >
              {hidden ? <HiEyeSlash size={18} /> : <HiEye size={18} />}
            </button>
            {cards.length >= 2 && (
              <button
                className={styles.iconBtn}
                aria-label={t('common.transfer')}
                onClick={() => setOverlay({ kind: 'transfer' })}
              >
                <HiArrowsRightLeft size={18} />
              </button>
            )}
          </div>
        )}
      </div>

      <div className={styles.segment} role="tablist">
        <span
          className={styles.segmentThumb}
          style={{ transform: `translateX(${viewIndex * 100}%)` }}
          aria-hidden
        />
        {VIEWS.map(v => {
          const locked = !isPremium && (v === 'savings' || v === 'debts');
          return (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              className={`${styles.segmentBtn} ${view === v ? styles.segmentBtnActive : ''}`}
              onClick={() => switchView(v)}
            >
              {TAB_LABELS[v]}
              {locked && <PremiumCornerStar />}
            </button>
          );
        })}
      </div>

      {view === 'accounts' && (
        loading ? <PageLoader /> : cards.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyArt} aria-hidden>
              <span className={styles.ghost1} />
              <span className={styles.ghost2} />
              <span className={styles.ghost3} />
            </div>
            <h2>{t('accounts.empty_title')}</h2>
            <p>{t('accounts.empty_hint')}</p>
            <button className={styles.emptyBtn} onClick={requestAddAccount}>
              <HiPlus size={18} /> {t('accounts.empty_btn')}
            </button>
          </div>
        ) : (
          <AccountsList
            cards={cards}
            hidden={hidden}
            onOpen={card => setOverlay({ kind: 'sheet', id: card.id })}
            onReorder={ids => { void saveCardOrder(ids); }}
            onDraggingChange={setDragging}
          />
        )
      )}
      {view === 'savings' && <Savings embedded addTrigger={addTrigger} />}
      {view === 'debts'   && <Debts   embedded addTrigger={addTrigger} />}

      {!(view === 'accounts' && cards.length === 0) && (
        <button className={styles.fab} onClick={handleFabClick}>
          <HiPlus size={20} />
          {FAB_LABELS[view]}
        </button>
      )}

      {overlay?.kind === 'sheet' && overlayCard && (
        <AccountSheet
          card={overlayCard}
          hidden={hidden}
          canTransfer={cards.length >= 2}
          onTransfer={() => setOverlay({ kind: 'transfer', fromId: overlayCard.id })}
          onRefill={() => setOverlay({ kind: 'refill', id: overlayCard.id })}
          onEdit={() => setOverlay({ kind: 'edit', id: overlayCard.id })}
          onDelete={() => handleDelete(overlayCard.id)}
          onToggleInclude={include => { void update(overlayCard.id, { includeInTotalBalance: include }); }}
          onClose={() => setOverlay(null)}
        />
      )}
      {overlay?.kind === 'add' && (
        <AccountFormModal
          isPremium={isPremium}
          onLockedType={() => premiumGate.open('credit_cash')}
          onAdd={add}
          onClose={() => setOverlay(null)}
        />
      )}
      {overlay?.kind === 'edit' && overlayCard && (
        <AccountFormModal
          card={overlayCard}
          isPremium={isPremium}
          onLockedType={() => premiumGate.open('credit_cash')}
          onUpdate={update}
          onClose={() => setOverlay(null)}
        />
      )}
      {overlay?.kind === 'refill' && overlayCard && (
        <RefillModal card={overlayCard} cards={cards} onRefill={refill} onClose={() => setOverlay(null)} />
      )}
      {overlay?.kind === 'transfer' && (
        <TransferModal
          cards={cards}
          fromId={overlay.fromId}
          onTransfer={transfer}
          onClose={() => setOverlay(null)}
        />
      )}

      {premiumGate.node}
      {confirmNode}
    </div>
  );
};

export default Accounts;
