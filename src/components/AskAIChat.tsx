import { useEffect, useRef, useState, useMemo, memo } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
  HiXMark, HiPaperAirplane, HiSparkles, HiStop,
  HiBars3, HiPencilSquare, HiTrash, HiChatBubbleLeftRight,
  HiClipboardDocument, HiHandThumbUp, HiHandThumbDown, HiCheck,
} from 'react-icons/hi2';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useQueryClient } from '@tanstack/react-query';
import { streamChatReply, type ChatMessage } from '../utils/aiChat';
import { useAiChats } from '../hooks/useAiChats';
import { qk } from '../api/queryClient';
import { api } from '../api/client';
import { useApp } from '../context';
import { useEntitlements } from '../hooks/useEntitlements';
import PremiumModal from './PremiumModal';
import { PremiumBadge } from './PremiumLock';
import dayjs from '../utils/dayjs';
import styles from './AskAIChat.module.css';

const MarkdownContent = memo(({ text }: { text: string }) => (
  <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
));

interface Props {
  onClose: () => void;
}

const AskAIChat = ({ onClose }: Props) => {
  const { t, i18n } = useTranslation();
  const { user } = useApp();
  const qc = useQueryClient();
  const { chats, remove } = useAiChats(user?.uid ?? null);
  const { isPremium, aiRemaining, aiUsed } = useEntitlements();

  const [showPremium, setShowPremium] = useState(false);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [pendingMessages, setPendingMessages] = useState<ChatMessage[]>([]); // optimistic local view before Firestore writes settle
  const [input, setInput] = useState('');
  const [streamingText, setStreamingText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showChatList, setShowChatList] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Record<number, 'up' | 'down'>>({});

  const abortRef = useRef<(() => void) | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-pick the most recent chat on first load (if any)
  useEffect(() => {
    if (activeChatId === null && chats.length > 0) {
      // Don't auto-select — let user start fresh OR pick from list
      // Actually: pick most recent for continuity
      // Comment kept: see decision in Issue #X
    }
  }, [chats, activeChatId]);

  const activeChat = activeChatId ? chats.find(c => c.id === activeChatId) : null;

  // During an active session the optimistic `pendingMessages` are the source of
  // truth; once cleared (switch/new chat), the loaded chat's messages take over.
  const displayedMessages: ChatMessage[] = useMemo(() => {
    if (pendingMessages.length) return pendingMessages;
    if (activeChat) return activeChat.messages.map(m => ({ role: m.role, content: m.content }));
    return [];
  }, [activeChat, pendingMessages]);

  // Auto-scroll on new content
  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [displayedMessages, streamingText, isThinking]);

  // Cleanup any in-flight stream on unmount
  useEffect(() => {
    return () => abortRef.current?.();
  }, []);

  // Lock body scroll while modal is open
  useEffect(() => {
    const orig = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = orig; };
  }, []);

  const suggestions = useMemo(() => [
    t('ask_ai.suggestion_1'),
    t('ask_ai.suggestion_2'),
    t('ask_ai.suggestion_3'),
    t('ask_ai.suggestion_4'),
  ], [t]);

  const startNewChat = () => {
    // Free tier limited to 1 chat — block creating a second if one already exists.
    if (!isPremium && chats.length >= 1) {
      setShowPremium(true);
      return;
    }
    abortRef.current?.();
    setActiveChatId(null);
    setPendingMessages([]);
    setStreamingText('');
    setIsStreaming(false);
    setIsThinking(false);
    setError(null);
    setShowChatList(false);
  };

  const switchToChat = (chatId: string) => {
    if (isStreaming) abortRef.current?.();
    setActiveChatId(chatId);
    setPendingMessages([]);
    setStreamingText('');
    setIsStreaming(false);
    setIsThinking(false);
    setError(null);
    setShowChatList(false);
  };

  const deleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(t('ask_ai.confirm_delete'))) return;
    await remove(chatId);
    if (activeChatId === chatId) startNewChat();
  };

  const language = i18n.language === 'ru' ? 'ru' : i18n.language === 'uz' ? 'uz' : 'en';

  const copyMessage = async (content: string, index: number) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedIndex(index);
      window.setTimeout(() => setCopiedIndex(current => current === index ? null : current), 1500);
    } catch {
      setError(t('ask_ai.copy_failed'));
    }
  };

  const rateMessage = async (index: number, rating: 'up' | 'down') => {
    if (!activeChatId) return;
    try {
      await api.post<void>('/v1/ai/feedback', { chatId: activeChatId, messageIndex: index, rating });
      setFeedback(current => ({ ...current, [index]: rating }));
    } catch {
      setError(t('ask_ai.feedback_failed'));
    }
  };

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming || !user) return;
    if (!isPremium && aiRemaining <= 0) {
      setShowPremium(true);
      return;
    }
    setError(null);

    // Optimistic view of the whole session (server persists user + assistant).
    const prior = displayedMessages.map(m => ({ role: m.role, content: m.content }));
    setPendingMessages([...prior, { role: 'user', content: trimmed }]);
    setInput('');
    setIsStreaming(true);
    setIsThinking(true);
    setStreamingText('');

    const abort = streamChatReply(
      { chatId: activeChatId ?? undefined, message: trimmed, language },
      {
        onMeta: (chatId) => setActiveChatId(chatId),
        onThinkingStart: () => setIsThinking(true),
        onDelta: (chunk) => {
          setIsThinking(false);
          setStreamingText(prev => prev + chunk);
        },
        onComplete: (full, incomplete) => {
          setPendingMessages(prev => [...prev, { role: 'assistant', content: full }]);
          setStreamingText('');
          setIsStreaming(false);
          setIsThinking(false);
          if (incomplete) setError(t('ask_ai.incomplete_response'));
          // Refresh the chat list (titles, order) + the loaded chat's messages.
          qc.invalidateQueries({ queryKey: qk.aiChats(user.uid) });
          qc.invalidateQueries({ queryKey: qk.profile(user.uid) });
        },
        onError: (err) => {
          setError(err.message || 'Failed to get a response');
          setIsStreaming(false);
          setIsThinking(false);
          setStreamingText('');
        },
      },
    );
    abortRef.current = abort;
  };

  const stop = () => {
    abortRef.current?.();
    if (streamingText) {
      setPendingMessages(prev => [...prev, { role: 'assistant', content: streamingText + ' …' }]);
    }
    setStreamingText('');
    setIsStreaming(false);
    setIsThinking(false);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 140) + 'px';
  };

  const showSuggestions = displayedMessages.length === 0 && !isStreaming;
  const headerTitle = activeChat?.title ?? t('ask_ai.title');

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <button
              className={styles.iconBtn}
              onClick={() => setShowChatList(true)}
              aria-label={t('ask_ai.show_chats')}
            >
              <HiBars3 size={18} />
            </button>
            <div className={styles.headerIcon}>
              <HiSparkles size={16} />
            </div>
            <div className={styles.headerText}>
              <p className={styles.headerTitle}>
                {headerTitle}
                {!isPremium && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--text3)' }}>· Standard</span>}
                {isPremium && <span style={{ marginLeft: 6 }}><PremiumBadge /></span>}
              </p>
              <p className={styles.headerSubtitle}>
                {isPremium
                  ? t('ask_ai.subtitle')
                  : t('premium.ai_usage_banner', { used: aiUsed, limit: 10 })}
              </p>
            </div>
          </div>
          <div className={styles.headerRight}>
            <button
              className={styles.iconBtn}
              onClick={startNewChat}
              aria-label={t('ask_ai.new_chat')}
              title={t('ask_ai.new_chat')}
            >
              <HiPencilSquare size={18} />
            </button>
            <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
              <HiXMark size={20} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className={styles.scroller} ref={scrollerRef}>
          {showSuggestions && (
            <div className={styles.welcome}>
              <div className={styles.welcomeIcon}><HiSparkles size={28} /></div>
              <p className={styles.welcomeTitle}>{t('ask_ai.welcome_title')}</p>
              <p className={styles.welcomeText}>{t('ask_ai.welcome_text')}</p>
              <div className={styles.suggestions}>
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    className={styles.suggestion}
                    onClick={() => send(s)}
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {displayedMessages.map((m, i) => (
            <div key={i} className={`${styles.bubble} ${m.role === 'user' ? styles.user : styles.assistant}`}>
              {m.role === 'assistant' && (
                <div className={styles.assistantIcon}><HiSparkles size={12} /></div>
              )}
              <div className={`${styles.bubbleText} ${m.role === 'assistant' ? styles.markdown : ''}`}>
                {m.role === 'assistant'
                  ? (
                    <>
                      <MarkdownContent text={m.content} />
                      <div className={styles.messageActions}>
                        <button onClick={() => copyMessage(m.content, i)} title={t('ask_ai.copy')}>
                          {copiedIndex === i ? <HiCheck size={14} /> : <HiClipboardDocument size={14} />}
                        </button>
                        <button
                          className={feedback[i] === 'up' ? styles.actionActive : ''}
                          onClick={() => rateMessage(i, 'up')}
                          title={t('ask_ai.helpful')}
                        >
                          <HiHandThumbUp size={14} />
                        </button>
                        <button
                          className={feedback[i] === 'down' ? styles.actionActive : ''}
                          onClick={() => rateMessage(i, 'down')}
                          title={t('ask_ai.not_helpful')}
                        >
                          <HiHandThumbDown size={14} />
                        </button>
                      </div>
                    </>
                  )
                  : m.content}
              </div>
            </div>
          ))}

          {isThinking && (
            <div className={`${styles.bubble} ${styles.assistant}`}>
              <div className={styles.assistantIcon}><HiSparkles size={12} /></div>
              <div className={styles.thinking}>
                <span className={styles.dot} />
                <span className={styles.dot} />
                <span className={styles.dot} />
              </div>
            </div>
          )}

          {streamingText && (
            <div className={`${styles.bubble} ${styles.assistant}`}>
              <div className={styles.assistantIcon}><HiSparkles size={12} /></div>
              <div className={`${styles.bubbleText} ${styles.markdown}`}>
                <MarkdownContent text={streamingText} />
                <span className={styles.cursor} />
              </div>
            </div>
          )}

          {error && <div className={styles.errorRow}>{error}</div>}
        </div>

        {/* Input */}
        <div className={styles.inputBar}>
          <textarea
            ref={inputRef}
            className={styles.textarea}
            placeholder={t('ask_ai.placeholder')}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKey}
            rows={1}
            disabled={isStreaming}
          />
          {isStreaming ? (
            <button className={styles.stopBtn} onClick={stop} aria-label="Stop">
              <HiStop size={18} />
            </button>
          ) : (
            <button
              className={`${styles.sendBtn} ${input.trim() ? styles.sendActive : ''}`}
              onClick={() => send(input)}
              disabled={!input.trim()}
              aria-label="Send"
            >
              <HiPaperAirplane size={16} />
            </button>
          )}
        </div>

        {/* Chat list overlay */}
        {showChatList && (
          <div className={styles.chatListPanel} onClick={(e) => e.stopPropagation()}>
            <div className={styles.chatListHeader}>
              <p className={styles.chatListTitle}>{t('ask_ai.chats_title')}</p>
              <button className={styles.iconBtn} onClick={() => setShowChatList(false)} aria-label="Close">
                <HiXMark size={18} />
              </button>
            </div>
            <button className={styles.newChatBtn} onClick={startNewChat}>
              <HiPencilSquare size={16} />
              <span>{t('ask_ai.new_chat')}</span>
            </button>
            <div className={styles.chatListScroller}>
              {chats.length === 0 && (
                <div className={styles.chatListEmpty}>
                  <HiChatBubbleLeftRight size={26} />
                  <p>{t('ask_ai.empty_chats')}</p>
                </div>
              )}
              {chats.map(c => {
                const last = c.messages[c.messages.length - 1];
                const preview = last?.content?.slice(0, 80).replace(/\s+/g, ' ') ?? '';
                return (
                  <button
                    key={c.id}
                    className={`${styles.chatListItem} ${activeChatId === c.id ? styles.chatListItemActive : ''}`}
                    onClick={() => switchToChat(c.id)}
                  >
                    <div className={styles.chatListItemMain}>
                      <p className={styles.chatListItemTitle}>{c.title}</p>
                      <p className={styles.chatListItemPreview}>{preview}</p>
                      <p className={styles.chatListItemTime}>{dayjs(c.updatedAt).format('D MMM, HH:mm')}</p>
                    </div>
                    <button
                      className={styles.chatListItemDelete}
                      onClick={(e) => deleteChat(c.id, e)}
                      aria-label={t('common.delete')}
                    >
                      <HiTrash size={14} />
                    </button>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      {showPremium && <PremiumModal feature="ai_chat" onClose={() => setShowPremium(false)} />}
    </div>,
    document.body,
  );
};

export default AskAIChat;
