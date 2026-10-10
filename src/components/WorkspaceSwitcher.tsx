import { useEffect, useMemo, useState } from 'react';
import { HiCheck, HiClipboardDocument, HiPlus, HiUser, HiUsers } from 'react-icons/hi2';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context';
import { useHousehold } from '../hooks/useHousehold';
import type { HouseholdInvite } from '../types';
import Modal from './Modal';
import styles from './WorkspaceSwitcher.module.css';

const inviteTokenFromUrl = () => new URL(window.location.href).searchParams.get('familyInvite');

const cleanInviteUrl = () => {
  const url = new URL(window.location.href);
  url.searchParams.delete('familyInvite');
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
};

const WorkspaceSwitcher = () => {
  const { t } = useTranslation();
  const { user, workspace, setWorkspace } = useApp();
  const family = useHousehold(user?.uid ?? null);
  const [showSetup, setShowSetup] = useState(() => Boolean(inviteTokenFromUrl()));
  const [inviteToken, setInviteToken] = useState<string | null>(inviteTokenFromUrl);

  useEffect(() => {
    if (!family.householdLoading && workspace === 'household' && !family.household) {
      setWorkspace('personal');
    }
  }, [family.household, family.householdLoading, setWorkspace, workspace]);

  const openFamily = () => {
    if (family.household) setWorkspace('household');
    else setShowSetup(true);
  };

  return (
    <>
      <div className={styles.wrap}>
        <div className={styles.switcher} role="tablist" aria-label={t('family.workspace_label')}>
          <button
            type="button"
            role="tab"
            aria-selected={workspace === 'personal'}
            className={`${styles.option} ${workspace === 'personal' ? styles.active : ''}`}
            onClick={() => setWorkspace('personal')}
          >
            <HiUser size={15} />
            <span>{t('family.personal')}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={workspace === 'household'}
            className={`${styles.option} ${workspace === 'household' ? styles.familyActive : ''}`}
            onClick={openFamily}
          >
            {family.household ? <HiUsers size={16} /> : <HiPlus size={16} />}
            <span>{family.household?.name || t('family.shared')}</span>
          </button>
        </div>
        {workspace === 'household' && family.household && (
          <button className={styles.manage} type="button" onClick={() => setShowSetup(true)}>
            <span>{family.household.members.length}/2</span>
            <HiUsers size={16} />
          </button>
        )}
      </div>

      {showSetup && (
        <FamilySetup
          inviteToken={inviteToken}
          onInviteHandled={() => { setInviteToken(null); cleanInviteUrl(); }}
          onClose={() => { setShowSetup(false); if (inviteToken) cleanInviteUrl(); }}
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
  const [copied, setCopied] = useState(false);

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

  const inviteUrl = useMemo(() => {
    if (!invite) return '';
    // Never copy the current query/hash: inside Telegram the hash carries this
    // user's signed tgWebAppData, which would sign the partner in as them.
    const url = new URL(window.location.pathname, window.location.origin);
    url.searchParams.set('familyInvite', invite.token);
    return url.toString();
  }, [invite]);

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

  const makeInvite = async () => {
    setLoading(true); setError('');
    try { setInvite(await family.createInvite()); }
    catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
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

  const copy = async () => {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
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
        {invite ? (
          <div className={styles.linkCard}>
            <p>{t('family.share_link')}</p>
            <button type="button" onClick={copy}>
              {copied ? <HiCheck size={17} /> : <HiClipboardDocument size={17} />}
              {copied ? t('family.copied') : t('family.copy_link')}
            </button>
          </div>
        ) : family.household.members.length < 2 ? (
          <button className={styles.secondary} type="button" disabled={loading} onClick={makeInvite}>
            <HiPlus size={17} />{t('family.invite_partner')}
          </button>
        ) : null}
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

export default WorkspaceSwitcher;
