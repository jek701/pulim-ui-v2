import { useState } from 'react';
import { HiCheck, HiEnvelope, HiPaperAirplane, HiXMark } from 'react-icons/hi2';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context';
import { useCommunicationAdminAccess, useCommunications } from '../hooks/useCommunications';
import { useCommunicationAdmin } from '../hooks/useCommunicationAdmin';
import type { CampaignDraft, CommunicationChannel, CommunicationLanguage } from './types';
import styles from './Communications.module.css';
import { followCommunicationLink } from './followLink';

const languages: CommunicationLanguage[] = ['ru', 'uz', 'en'];
const blankDraft = (): CampaignDraft => ({
  name: '',
  content: { ru: { title: '', body: '', ctaLabel: '' }, uz: { title: '', body: '', ctaLabel: '' }, en: { title: '', body: '', ctaLabel: '' } },
  channels: ['in_app'], presentation: 'inbox', audience: { tier: 'all', languages: [], telegram: 'any' }, ctaUrl: '',
});

const copy = {
  ru: { inbox: 'Сообщения', empty: 'Пока сообщений нет', settings: 'Настройки рассылок', inApp: 'Новости внутри Pulim', inAppHint: 'Обновления и полезные подсказки в приложении', telegram: 'Новости в Telegram', telegramHint: 'Только с вашего явного согласия', admin: 'Управление рассылками', unread: 'Новое' },
  uz: { inbox: 'Xabarlar', empty: 'Hozircha xabarlar yo‘q', settings: 'Xabar sozlamalari', inApp: 'Pulim ichidagi yangiliklar', inAppHint: 'Ilovadagi yangilanishlar va foydali maslahatlar', telegram: 'Telegram yangiliklari', telegramHint: 'Faqat sizning roziligingiz bilan', admin: 'Xabarlarni boshqarish', unread: 'Yangi' },
  en: { inbox: 'Messages', empty: 'No messages yet', settings: 'Message settings', inApp: 'News inside Pulim', inAppHint: 'Product updates and helpful tips in the app', telegram: 'News in Telegram', telegramHint: 'Only with your explicit consent', admin: 'Manage campaigns', unread: 'New' },
};

function PreferenceSwitch({ on, disabled, onClick, label }: { on: boolean; disabled: boolean; onClick: () => void; label: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} className={`${styles.switch} ${on ? styles.switchOn : ''}`} onClick={onClick}><span/></button>;
}

function CampaignAdmin({ uid }: { uid: string }) {
  const admin = useCommunicationAdmin(uid);
  const [draft, setDraft] = useState(blankDraft);
  const [language, setLanguage] = useState<CommunicationLanguage>('ru');
  const [schedule, setSchedule] = useState('');
  const [error, setError] = useState('');
  const content = draft.content[language];
  const setContent = (patch: Partial<typeof content>) => setDraft(current => ({ ...current, content: { ...current.content, [language]: { ...current.content[language], ...patch } } }));
  const toggleChannel = (channel: CommunicationChannel) => setDraft(current => ({
    ...current,
    channels: current.channels.includes(channel) ? current.channels.filter(item => item !== channel) : [...current.channels, channel],
  }));
  const submit = async (mode: 'draft' | 'now' | 'schedule') => {
    setError('');
    try {
      const campaign = await admin.create.mutateAsync({ ...draft, ctaUrl: draft.ctaUrl || undefined });
      if (mode !== 'draft') await admin.send.mutateAsync({ id: campaign.id, scheduledAt: mode === 'schedule' && schedule ? new Date(schedule).getTime() : null });
      setDraft(blankDraft()); setSchedule('');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Не удалось сохранить кампанию'); }
  };
  const valid = draft.name.trim() && draft.channels.length && languages.every(item => draft.content[item].title.trim() && draft.content[item].body.trim());

  return (
    <div className={styles.admin}>
      <div className={styles.sectionHeading}><HiPaperAirplane size={19}/><h2>Новая кампания</h2></div>
      <input className={styles.input} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} placeholder="Внутреннее название" />
      <div className={styles.segmented}>{languages.map(item => <button type="button" className={language === item ? styles.active : ''} onClick={() => setLanguage(item)} key={item}>{item.toUpperCase()}</button>)}</div>
      <input className={styles.input} value={content.title} maxLength={80} onChange={event => setContent({ title: event.target.value })} placeholder={`Заголовок (${language.toUpperCase()})`} />
      <textarea className={styles.textarea} value={content.body} maxLength={2000} onChange={event => setContent({ body: event.target.value })} placeholder={`Текст (${language.toUpperCase()})`} />
      <input className={styles.input} value={content.ctaLabel ?? ''} maxLength={40} onChange={event => setContent({ ctaLabel: event.target.value })} placeholder="Текст кнопки (необязательно)" />
      <input className={styles.input} value={draft.ctaUrl ?? ''} onChange={event => setDraft({ ...draft, ctaUrl: event.target.value })} placeholder="Ссылка: /?tab=... или https://..." />
      <div className={styles.checkRow}>
        {(['in_app', 'telegram'] as const).map(channel => <button type="button" className={draft.channels.includes(channel) ? styles.checked : ''} onClick={() => toggleChannel(channel)} key={channel}>{draft.channels.includes(channel) && <HiCheck/>}{channel === 'in_app' ? 'В приложении' : 'Telegram'}</button>)}
      </div>
      <div className={styles.grid}>
        <label>Формат<select value={draft.presentation} onChange={event => setDraft({ ...draft, presentation: event.target.value as CampaignDraft['presentation'] })}><option value="inbox">Входящие</option><option value="banner">Баннер</option><option value="modal">Модальное окно</option></select></label>
        <label>Тариф<select value={draft.audience.tier} onChange={event => setDraft({ ...draft, audience: { ...draft.audience, tier: event.target.value as CampaignDraft['audience']['tier'] } })}><option value="all">Все</option><option value="free">Free</option><option value="premium">Premium</option><option value="trial">Trial</option></select></label>
        <label>Telegram<select value={draft.audience.telegram} onChange={event => setDraft({ ...draft, audience: { ...draft.audience, telegram: event.target.value as CampaignDraft['audience']['telegram'] } })}><option value="any">Все</option><option value="linked">Привязан</option><option value="unlinked">Не привязан</option></select></label>
        <label>Дата отправки<input type="datetime-local" value={schedule} onChange={event => setSchedule(event.target.value)}/></label>
      </div>
      <div className={styles.checkRow}>{languages.map(item => <button type="button" className={draft.audience.languages.includes(item) ? styles.checked : ''} onClick={() => setDraft(current => ({ ...current, audience: { ...current.audience, languages: current.audience.languages.includes(item) ? current.audience.languages.filter(lang => lang !== item) : [...current.audience.languages, item] } }))} key={item}>{draft.audience.languages.includes(item) && <HiCheck/>}{item.toUpperCase()}</button>)}</div>
      <p className={styles.hint}>Языки не выбраны — аудитория любого языка. Telegram получат только пользователи, включившие маркетинговые сообщения.</p>
      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.actions}>
        <button type="button" disabled={!valid || admin.create.isPending} onClick={() => void submit('draft')}>Черновик</button>
        <button type="button" disabled={!valid || admin.create.isPending} onClick={() => void submit('now')}>Отправить сейчас</button>
        <button type="button" disabled={!valid || !schedule || admin.create.isPending} onClick={() => void submit('schedule')}>Запланировать</button>
      </div>
      <div className={styles.campaignList}>
        <h2>Кампании</h2>
        {admin.campaigns.map(item => <article key={item.id} className={styles.campaignCard}>
          <div><strong>{item.name}</strong><span className={styles.status}>{item.status}</span></div>
          <p>{item.stats.audience} аудитория · {item.stats.inAppDelivered} in-app · {item.stats.telegramSent}/{item.stats.telegramQueued} Telegram</p>
          <p>{item.stats.seen} прочитали · {item.stats.clicked} перешли · {item.stats.dismissed} закрыли</p>
          {item.status === 'draft' && <button type="button" onClick={() => admin.send.mutate({ id: item.id, scheduledAt: null })}>Отправить</button>}
          {item.status === 'scheduled' && <button type="button" onClick={() => admin.pause.mutate(item.id)}>Пауза</button>}
          {item.lastError && <p className={styles.error}>{item.lastError}</p>}
        </article>)}
      </div>
    </div>
  );
}

export default function CommunicationCenter() {
  const { user, setActiveTab } = useApp();
  const { i18n } = useTranslation();
  const communications = useCommunications(user?.uid ?? null);
  const access = useCommunicationAdminAccess(user?.uid ?? null);
  const [tab, setTab] = useState<'inbox' | 'settings' | 'admin'>('inbox');
  const lang = i18n.language.startsWith('uz') ? 'uz' : i18n.language.startsWith('en') ? 'en' : 'ru';
  const c = copy[lang];
  if (!user) return null;
  return (
    <div className={styles.center}>
      <div className={styles.tabs}>
        <button className={tab === 'inbox' ? styles.active : ''} onClick={() => setTab('inbox')}>{c.inbox}{communications.unread ? ` (${communications.unread})` : ''}</button>
        <button className={tab === 'settings' ? styles.active : ''} onClick={() => setTab('settings')}>{c.settings}</button>
        {access.data?.enabled && <button className={tab === 'admin' ? styles.active : ''} onClick={() => setTab('admin')}>{c.admin}</button>}
      </div>
      {tab === 'inbox' && <div className={styles.inbox}>
        {!communications.messages.length && <div className={styles.empty}><HiEnvelope size={30}/><p>{c.empty}</p></div>}
        {communications.messages.map(message => <article key={message.id} className={`${styles.message} ${!message.readAt ? styles.messageUnread : ''}`}>
          <button className={styles.messageMain} type="button" onClick={() => !message.readAt && communications.event.mutate({ id: message.id, action: 'read' })}>
            <div><strong>{message.title}</strong>{!message.readAt && <span>{c.unread}</span>}</div><p>{message.body}</p><time>{new Date(message.createdAt).toLocaleDateString(lang)}</time>
          </button>
          <div className={styles.messageActions}>
            {message.ctaUrl && <button type="button" onClick={() => { communications.event.mutate({ id: message.id, action: 'click' }); followCommunicationLink(message.ctaUrl, setActiveTab); }}>{message.ctaLabel || 'Открыть'}</button>}
            {!message.dismissedAt && <button type="button" aria-label="Закрыть" onClick={() => communications.event.mutate({ id: message.id, action: 'dismiss' })}><HiXMark/></button>}
          </div>
        </article>)}
      </div>}
      {tab === 'settings' && <div className={styles.preferences}>
        <div><span><strong>{c.inApp}</strong><small>{c.inAppHint}</small></span><PreferenceSwitch label={c.inApp} on={communications.preferences.marketing.inApp} disabled={communications.updatePreferences.isPending} onClick={() => communications.updatePreferences.mutate({ inApp: !communications.preferences.marketing.inApp })}/></div>
        <div><span><strong>{c.telegram}</strong><small>{c.telegramHint}</small></span><PreferenceSwitch label={c.telegram} on={communications.preferences.marketing.telegram} disabled={communications.updatePreferences.isPending} onClick={() => communications.updatePreferences.mutate({ telegram: !communications.preferences.marketing.telegram })}/></div>
      </div>}
      {tab === 'admin' && access.data?.enabled && <CampaignAdmin uid={user.uid}/>} 
    </div>
  );
}
