import { useEffect, useRef, useState } from 'react';
import { HiCheck, HiCheckCircle, HiChevronDown, HiClipboardDocument, HiPaperAirplane, HiPlus, HiUser, HiUserPlus, HiUsers } from 'react-icons/hi2';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context';
import { useHousehold } from '../hooks/useHousehold';
import { ApiError } from '../api/client';
import type { HouseholdInvite } from '../types';
import { openTelegramLink, telegramApp, tgAtLeast } from '../utils/telegram';
import Modal from './Modal';
import styles from './WorkspaceSwitcher.module.css';

/** Invites arrive as `?familyInvite=` (bot button, web) or `startapp=family_<token>` (t.me link). */
const FAMILY_START_PREFIX = 'family_';
const HANDLED_INVITE_KEY = 'pulim.familyInviteHandled';

const handledInvite = () => {
  try { return sessionStorage.getItem(HANDLED_INVITE_KEY); } catch { return null; }
};

const inviteTokenFromLaunch = (): string | null => {
  const fromUrl = new URL(window.location.href).searchParams.get('familyInvite');
  const startParam = telegramApp?.initDataUnsafe?.start_param;
  const fromStart = startParam?.startsWith(FAMILY_START_PREFIX) ? startParam.slice(FAMILY_START_PREFIX.length) : null;
  const token = fromUrl || fromStart;
  // start_param stays in the init data for the whole session; don't reopen a handled invite.
  return token && token !== handledInvite() ? token : null;
};

const cleanInviteUrl = (token: string | null) => {
  if (token) {
    try { sessionStorage.setItem(HANDLED_INVITE_KEY, token); } catch { /* storage can be unavailable */ }
  }
  const url = new URL(window.location.href);
  url.searchParams.delete('familyInvite');
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
};

const WorkspaceSwitcher = ({ controllerOnly = false }: { controllerOnly?: boolean }) => {
  const { t } = useTranslation();
  const { user, workspace, setWorkspace } = useApp();
  const family = useHousehold(user?.uid ?? null);
  const [inviteToken, setInviteToken] = useState<string | null>(() => controllerOnly ? inviteTokenFromLaunch() : null);
  const [showSetup, setShowSetup] = useState(() => controllerOnly && Boolean(inviteToken));
  const [showChooser, setShowChooser] = useState(false);

  useEffect(() => {
    if (!family.householdLoading && workspace === 'household' && !family.household) {
      setWorkspace('personal');
    }
  }, [family.household, family.householdLoading, setWorkspace, workspace]);

  const openFamily = () => {
    setShowChooser(false);
    if (family.household) setWorkspace('household');
    else setShowSetup(true);
  };

  return (
    <>
      {!controllerOnly && (
        <button
          className={styles.current}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={showChooser}
          onClick={() => setShowChooser(true)}
        >
          <span className={`${styles.currentIcon} ${workspace === 'household' ? styles.currentFamilyIcon : ''}`}>
            {workspace === 'household' ? <HiUsers size={19} /> : <HiUser size={19} />}
          </span>
          <span className={styles.currentCopy}>
            <b>{t('family.workspace_label')}</b>
            <small>{workspace === 'household' ? family.household?.name || t('family.shared') : t('family.personal')}</small>
          </span>
          <HiChevronDown size={17} />
        </button>
      )}

      {showChooser && (
        <Modal title={t('family.workspace_label')} onClose={() => setShowChooser(false)}>
          <div className={styles.workspaceList} role="list">
            <button
              type="button"
              className={workspace === 'personal' ? styles.workspaceActive : ''}
              onClick={() => { setWorkspace('personal'); setShowChooser(false); }}
            >
              <span className={styles.workspaceIcon}><HiUser size={20} /></span>
              <span><b>{t('family.personal')}</b><small>{t('family.personal_workspace_hint')}</small></span>
              {workspace === 'personal' && <HiCheck size={18} />}
            </button>
            <button
              type="button"
              className={workspace === 'household' ? styles.workspaceActive : ''}
              onClick={openFamily}
            >
              <span className={`${styles.workspaceIcon} ${styles.workspaceFamilyIcon}`}>
                {family.household ? <HiUsers size={20} /> : <HiPlus size={20} />}
              </span>
              <span><b>{family.household?.name || t('family.shared')}</b><small>{t('family.family_workspace_hint')}</small></span>
              {workspace === 'household' && <HiCheck size={18} />}
            </button>
          </div>
          {family.household && (
            <button
              className={styles.secondary}
              type="button"
              onClick={() => { setShowChooser(false); setShowSetup(true); }}
            >
              <HiUsers size={17} />{t('family.manage_members')}
            </button>
          )}
        </Modal>
      )}

      {showSetup && (
        <FamilySetup
          inviteToken={inviteToken}
          onInviteHandled={() => { cleanInviteUrl(inviteToken); setInviteToken(null); }}
          onClose={() => { setShowSetup(false); if (inviteToken) { cleanInviteUrl(inviteToken); setInviteToken(null); } }}
        />
      )}
    </>
  );
};

const FamilySetup = ({ inviteToken, onInviteHandled, onClose }: {
  inviteToken: string | null;
  onInviteHandled: () => void;
  onClose: () => void;
}) => {
  const { t } = useTranslation();
  const { user, setWorkspace } = useApp();
  const family = useHousehold(user?.uid ?? null);
  const [name, setName] = useState(t('family.default_name'));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [invite, setInvite] = useState<HouseholdInvite | null>(null);
  const [incoming, setIncoming] = useState<HouseholdInvite | null>(null);

  useEffect(() => {
    if (!inviteToken) return;
    let cancelled = false;
    setLoading(true);
    family.getInvite(inviteToken)
      .then(info => { if (!cancelled) setIncoming(info); })
      .catch(err => { if (!cancelled) setError((err as Error).message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [inviteToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const create = async () => {
    if (!name.trim()) return;
    setLoading(true); setError('');
    try {
      await family.create(name.trim());
      const createdInvite = await family.createInvite();
      setInvite(createdInvite);
      setWorkspace('household');
    } catch (err) {
      setError((err as Error).message);
    } finally { setLoading(false); }
  };

  const accept = async () => {
    if (!inviteToken) return;
    setLoading(true); setError('');
    try {
      await family.acceptInvite(inviteToken);
      setWorkspace('household');
      onInviteHandled();
      onClose();
    } catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  };

  if (inviteToken) {
    return (
      <Modal title={t('family.invite_title')} onClose={onClose} footer={incoming && (
        <button className={styles.primary} type="button" disabled={loading} onClick={accept}>
          <HiCheck size={18} />{loading ? t('family.joining') : t('family.join')}
        </button>
      )}>
        <div className={styles.heroIcon}><HiUsers size={28} /></div>
        {loading && !incoming ? <p className={styles.centerMuted}>{t('family.invite_loading')}</p> : incoming ? (
          <div className={styles.inviteIntro}>
            <h3>{incoming.householdName}</h3>
            <p>{t('family.invite_desc')}</p>
          </div>
        ) : null}
        {error && <p className={styles.error}>{error}</p>}
      </Modal>
    );
  }

  if (family.household) {
    return (
      <Modal title={family.household.name} onClose={onClose}>
        <div className={styles.memberList}>
          {family.household.members.map(member => (
            <div className={styles.member} key={member.userId}>
              <span className={styles.avatar}>{member.name.slice(0, 1).toUpperCase()}</span>
              <span><strong>{member.name}</strong><small>{t(`family.role_${member.role}`)}</small></span>
              {member.userId === user?.uid && <em>{t('family.you')}</em>}
            </div>
          ))}
          {family.household.members.length < 2 && (
            <div className={`${styles.member} ${styles.memberEmpty}`}>
              <span className={styles.avatar}><HiPlus size={17} /></span>
              <span><strong>{t('family.partner_waiting')}</strong><small>{t('family.partner_waiting_hint')}</small></span>
            </div>
          )}
        </div>
        {family.household.members.length < 2 && (
          <InvitePanel householdName={family.household.name} invite={invite} onInvite={setInvite} />
        )}
        {error && <p className={styles.error}>{error}</p>}
      </Modal>
    );
  }

  return (
    <Modal title={t('family.create_title')} onClose={onClose} footer={(
      <button className={styles.primary} type="button" disabled={!name.trim() || loading} onClick={create}>
        <HiUsers size={18} />{loading ? t('common.saving') : t('family.create_action')}
      </button>
    )}>
      <div className={styles.heroIcon}><HiUsers size={28} /></div>
      <div className={styles.inviteIntro}>
        <h3>{t('family.create_heading')}</h3>
        <p>{t('family.create_desc')}</p>
      </div>
      <label className={styles.field}>
        <span>{t('family.name_label')}</span>
        <input value={name} maxLength={60} onChange={event => setName(event.target.value)} />
      </label>
      <div className={styles.privacyNote}>
        <span>🔒</span><p><strong>{t('family.private_title')}</strong>{t('family.private_desc')}</p>
      </div>
      {error && <p className={styles.error}>{error}</p>}
    </Modal>
  );
};

type PickState =
  | { phase: 'waiting' }
  | { phase: 'delivered' | 'not_delivered'; name: string }
  | { phase: 'timeout' };

const PICK_POLL_MS = 1500;
const PICK_POLL_ATTEMPTS = 14;

/** Never derived from window.location: inside Telegram its hash carries signed tgWebAppData. */
const fallbackInviteLink = (token: string) => {
  const url = new URL('/', window.location.origin);
  url.searchParams.set('familyInvite', token);
  return url.toString();
};

/**
 * Invite actions, best first: Telegram's contact picker (the bot notifies a partner who
 * already uses Pulim), an invite card sent from the user's own account, and a plain link.
 */
const InvitePanel = ({ householdName, invite, onInvite }: {
  householdName: string;
  invite: HouseholdInvite | null;
  onInvite: (invite: HouseholdInvite) => void;
}) => {
  const { t } = useTranslation();
  const { user } = useApp();
  const family = useHousehold(user?.uid ?? null);
  const [busy, setBusy] = useState<'pick' | 'share' | null>(null);
  const [pick, setPick] = useState<PickState | null>(null);
  const [shared, setShared] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const canPick = Boolean(telegramApp?.requestChat) && tgAtLeast('9.6');
  const canShareCard = Boolean(telegramApp?.shareMessage) && tgAtLeast('8.0');

  const ensureInvite = async () => {
    if (invite) return invite;
    const created = await family.createInvite();
    onInvite(created);
    return created;
  };
  const linkOf = (current: HouseholdInvite) => current.link || fallbackInviteLink(current.token);
  const showError = (err: unknown) => {
    setError(err instanceof ApiError && err.code === 'INVITE_LIMIT' ? t('family.invite_limit') : t('family.invite_error'));
  };

  const watchDelivery = async (token: string) => {
    for (let attempt = 0; attempt < PICK_POLL_ATTEMPTS; attempt += 1) {
      await new Promise(resolve => window.setTimeout(resolve, PICK_POLL_MS));
      if (!alive.current) return;
      const status = await family.getInviteStatus(token).catch(() => null);
      const delivery = status?.delivery;
      if (delivery?.status === 'delivered' || delivery?.status === 'not_delivered') {
        setPick({ phase: delivery.status, name: delivery.recipientName || t('family.member') });
        return;
      }
    }
    if (alive.current) setPick({ phase: 'timeout' });
  };

  const pickContact = async () => {
    if (!telegramApp?.requestChat) return;
    setBusy('pick'); setError(''); setPick(null);
    try {
      const current = await ensureInvite();
      const { buttonId } = await family.prepareInvitePick(current.token);
      telegramApp.requestChat(buttonId, picked => {
        if (!picked) return;
        setPick({ phase: 'waiting' });
        void watchDelivery(current.token);
      });
    } catch (err) {
      showError(err);
    } finally {
      setBusy(null);
    }
  };

  const shareLink = async (current: HouseholdInvite) => {
    const link = linkOf(current);
    const text = t('family.share_text', { name: householdName });
    if (telegramApp) {
      openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`);
    } else if (navigator.share) {
      await navigator.share({ text, url: link }).catch(() => undefined);
    } else {
      await copy(current);
    }
  };

  const sendToChat = async () => {
    setBusy('share'); setError('');
    try {
      const current = await ensureInvite();
      if (canShareCard && telegramApp?.shareMessage) {
        try {
          const { messageId } = await family.prepareInviteShare(current.token);
          telegramApp.shareMessage(messageId, sent => { if (sent) setShared(true); });
          return;
        } catch {
          // Fall through to a plain link share, which needs nothing from the bot.
        }
      }
      await shareLink(current);
    } catch (err) {
      showError(err);
    } finally {
      setBusy(null);
    }
  };

  const copy = async (current?: HouseholdInvite) => {
    setError('');
    try {
      const target = current ?? await ensureInvite();
      await navigator.clipboard.writeText(linkOf(target));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (err) {
      showError(err);
    }
  };

  return (
    <div className={styles.invitePanel}>
      <p className={styles.inviteTitle}>{t('family.invite_partner')}</p>
      {canPick && (
        <button className={styles.inviteAction} type="button" disabled={busy !== null} onClick={pickContact}>
          <span className={styles.inviteActionIcon}><HiUserPlus size={19} /></span>
          <span><b>{t('family.pick_contact')}</b><small>{t('family.pick_contact_hint')}</small></span>
        </button>
      )}
      <button
        className={`${styles.inviteAction} ${canPick ? styles.inviteActionSecondary : ''}`}
        type="button"
        disabled={busy !== null}
        onClick={sendToChat}
      >
        <span className={styles.inviteActionIcon}><HiPaperAirplane size={18} /></span>
        <span><b>{t('family.send_to_chat')}</b><small>{t('family.send_to_chat_hint')}</small></span>
      </button>
      <button className={styles.copyLink} type="button" onClick={() => void copy()}>
        {copied ? <HiCheck size={16} /> : <HiClipboardDocument size={16} />}
        {copied ? t('family.copied') : t('family.copy_link')}
        <small>{t('family.link_valid')}</small>
      </button>

      {pick?.phase === 'waiting' && <p className={styles.inviteStatus}>{t('family.invite_sending')}</p>}
      {pick?.phase === 'delivered' && (
        <p className={`${styles.inviteStatus} ${styles.inviteStatusOk}`}>
          <HiCheckCircle size={17} />{t('family.invite_delivered', { name: pick.name })}
        </p>
      )}
      {pick?.phase === 'not_delivered' && (
        <p className={styles.inviteStatus}>{t('family.invite_not_delivered', { name: pick.name })}</p>
      )}
      {pick?.phase === 'timeout' && <p className={styles.inviteStatus}>{t('family.invite_timeout')}</p>}
      {shared && (
        <p className={`${styles.inviteStatus} ${styles.inviteStatusOk}`}>
          <HiCheckCircle size={17} />{t('family.invite_shared')}
        </p>
      )}
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
};

export default WorkspaceSwitcher;
