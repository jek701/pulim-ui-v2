import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { getRedirectResult, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { auth } from './firebase';
import { api } from './api/client';
import { qk } from './api/queryClient';
import { paymentApi, type CheckoutSession } from './api/paymentClient';
import type { AuthMethod, Tab, UserProfile } from './types';
import { EMPTY_HISTORY_FILTERS, type HistoryFilters } from './utils/historyFilters';
import i18n from './i18n';

interface AppContextType {
  user: User | null;
  authLoading: boolean;
  authProvider: AuthMethod | null;
  linkedAuthMethods: AuthMethod[];
  authUpgradeRequired: boolean;
  telegramAuthPending: boolean;
  telegramAuthError: string | null;
  retryTelegramAuth: () => void;
  /** True when a logged-in email user is inside Telegram but hasn't linked it yet. */
  showTelegramLinkPrompt: boolean;
  telegramLinkPending: boolean;
  telegramLinkError: string | null;
  linkTelegram: () => Promise<void>;
  dismissTelegramLinkPrompt: () => void;
  reloadUser: () => Promise<void>;
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  categoryFilter: string | null;
  setCategoryFilter: (id: string | null) => void;
  /** History filters live here so switching tabs no longer silently clears them. */
  historyFilters: HistoryFilters;
  setHistoryFilters: React.Dispatch<React.SetStateAction<HistoryFilters>>;
  /** Bumped when the active tab is tapped again; sections reset to their root. */
  tabResetNonce: number;
  requestTabReset: () => void;
  profile: UserProfile | null;
  profileLoading: boolean;
  saveProfile: (data: Partial<UserProfile>) => Promise<void>;
  transactionDeepLinkId: string | null;
  clearTransactionDeepLink: () => void;
  startPaymentMonitoring: (orderId: string) => void;
  paymentResult: PaymentResult | null;
  dismissPaymentResult: () => void;
}

export type PaymentResult =
  | { phase: 'checking' }
  | { phase: 'success'; order: CheckoutSession }
  | { phase: 'delayed'; orderId: string }
  | { phase: 'expired'; orderId: string };

type PendingPayment = {
  orderId: string;
  createdAt: number;
};

const PAYMENT_STORAGE_PREFIX = 'pulim:pending-payment:';
const PAYMENT_START_PARAM_PREFIX = 'payment_';
const PAYMENT_POLL_ATTEMPTS = 12;
const PAYMENT_POLL_INTERVAL_MS = 5_000;
const PAYMENT_ORDER_PRIORITY_WINDOW_MS = 30 * 60_000;
const PAYMENT_STORAGE_TTL_MS = 24 * 60 * 60_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isOrderId(value: string | null | undefined): value is string {
  return Boolean(value && UUID_PATTERN.test(value));
}

function paymentStorageKey(uid: string): string {
  return `${PAYMENT_STORAGE_PREFIX}${uid}`;
}

function readPendingPayment(uid: string): PendingPayment | null {
  try {
    const raw = localStorage.getItem(paymentStorageKey(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingPayment>;
    if (!isOrderId(parsed.orderId) || typeof parsed.createdAt !== 'number') {
      localStorage.removeItem(paymentStorageKey(uid));
      return null;
    }
    if (Date.now() - parsed.createdAt > PAYMENT_STORAGE_TTL_MS) {
      localStorage.removeItem(paymentStorageKey(uid));
      return null;
    }
    return { orderId: parsed.orderId, createdAt: parsed.createdAt };
  } catch {
    return null;
  }
}

function savePendingPayment(uid: string, orderId: string): void {
  try {
    localStorage.setItem(
      paymentStorageKey(uid),
      JSON.stringify({ orderId, createdAt: Date.now() } satisfies PendingPayment),
    );
  } catch {
    // Private browsing and embedded webviews can disable storage. Polling still
    // works for the current Mini App session in that case.
  }
}

function clearPendingPayment(uid: string): void {
  try {
    localStorage.removeItem(paymentStorageKey(uid));
  } catch {
    // Ignore storage failures; the server remains the source of truth.
  }
}

function paymentOrderFromStartParam(value: string | undefined): string | null {
  if (!value?.startsWith(PAYMENT_START_PARAM_PREFIX)) return null;
  const orderId = value.slice(PAYMENT_START_PARAM_PREFIX.length);
  return isOrderId(orderId) ? orderId : null;
}

const AppContext = createContext<AppContextType | null>(null);

type TelegramWebAppUser = {
  id?: number;
  first_name?: string;
  last_name?: string;
  username?: string;
};

type TelegramWebApp = {
  initData?: string;
  initDataUnsafe?: {
    user?: TelegramWebAppUser;
    start_param?: string;
  };
};

const getTelegramWebApp = () => (window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp;
const getTgUser = () => getTelegramWebApp()?.initDataUnsafe?.user;
const telegramAuthApiUrl = import.meta.env.VITE_TELEGRAM_AUTH_API_URL?.trim();
const MODERN_AUTH_METHODS: AuthMethod[] = ['google', 'apple', 'phone'];

const mapProviderIdToAuthMethod = (providerId?: string | null): AuthMethod | null => {
  switch (providerId) {
    case 'password':
      return 'email';
    case 'google.com':
      return 'google';
    case 'apple.com':
      return 'apple';
    case 'phone':
      return 'phone';
    default:
      return null;
  }
};

const dedupeAuthMethods = (methods: Array<AuthMethod | null | undefined>) => (
  Array.from(new Set(methods.filter((value): value is AuthMethod => Boolean(value))))
);

const hasModernAuthMethod = (methods: AuthMethod[]) => methods.some(method => MODERN_AUTH_METHODS.includes(method));

const initialTransactionDeepLink = () => {
  const queryId = new URLSearchParams(window.location.search).get('tx');
  if (queryId) return queryId;
  const startParam = getTelegramWebApp()?.initDataUnsafe?.start_param;
  return startParam?.startsWith('tx_') ? startParam.slice(3) : null;
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authProvider, setAuthProvider] = useState<AuthMethod | null>(null);
  const [linkedAuthMethods, setLinkedAuthMethods] = useState<AuthMethod[]>([]);
  const [telegramAuthPending, setTelegramAuthPending] = useState(false);
  const [telegramAuthError, setTelegramAuthError] = useState<string | null>(null);
  const [telegramRetryKey, setTelegramRetryKey] = useState(0);
  const [telegramLinkPending, setTelegramLinkPending] = useState(false);
  const [telegramLinkError, setTelegramLinkError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [transactionDeepLinkId, setTransactionDeepLinkId] = useState<string | null>(initialTransactionDeepLink);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [historyFilters, setHistoryFilters] = useState<HistoryFilters>(EMPTY_HISTORY_FILTERS);
  const [tabResetNonce, setTabResetNonce] = useState(0);
  const requestTabReset = useCallback(() => setTabResetNonce(value => value + 1), []);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null);
  const telegramAuthInFlight = useRef(false);
  const paymentMonitorRef = useRef<{ orderId: string; cancelled: boolean } | null>(null);
  const paymentModalDismissedRef = useRef(false);

  const uid = user?.uid ?? null;

  const retryTelegramAuth = () => {
    setTelegramAuthError(null);
    setTelegramRetryKey((key) => key + 1);
  };

  const formatTelegramAuthError = (err: unknown) => {
    if (err instanceof Error && err.message) return err.message;
    return 'Telegram sign-in failed.';
  };

  // Derive the current auth provider + linked methods from the ID token (UI state only;
  // the server persists the authoritative auth metadata during /v1/profile/bootstrap).
  const applyAuthState = async (nextUser: User) => {
    const tokenResult = await nextUser.getIdTokenResult();
    const firebaseClaims = tokenResult.claims.firebase as { sign_in_provider?: string } | undefined;
    const signInProviderId = firebaseClaims?.sign_in_provider ?? null;
    // Phone sign-in goes through the API (Eskiz SMS) and lands as a custom token,
    // so `sign_in_provider` is `custom` and the real method travels in our claim.
    const claimProvider = tokenResult.claims.provider;
    const provider = claimProvider === 'telegram'
      ? 'telegram'
      : mapProviderIdToAuthMethod(signInProviderId)
        ?? (claimProvider === 'phone' ? 'phone' : null)
        ?? mapProviderIdToAuthMethod(nextUser.providerData[0]?.providerId)
        ?? (nextUser.email ? 'email' : null);
    const methods = dedupeAuthMethods([
      provider === 'telegram' ? 'telegram' : null,
      tokenResult.claims.phone ? 'phone' : null,
      ...nextUser.providerData.map((entry) => mapProviderIdToAuthMethod(entry.providerId)),
    ]);
    setAuthProvider(provider);
    setLinkedAuthMethods(methods);
  };

  useEffect(() => {
    getRedirectResult(auth).catch((err) => {
      console.error('[auth] redirect result failed:', err);
    });
  }, []);

  // ── Auth state listener ──────────────────────────────────────────────────────
  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        setAuthProvider(null);
        setLinkedAuthMethods([]);
        setAuthLoading(false);
        return;
      }
      try {
        await applyAuthState(u);
      } catch (err) {
        console.error('[auth] failed to read token claims:', err);
        const fallbackProvider = mapProviderIdToAuthMethod(u.providerData[0]?.providerId) ?? (u.email ? 'email' : null);
        setAuthProvider(fallbackProvider);
        setLinkedAuthMethods(dedupeAuthMethods([
          fallbackProvider,
          ...u.providerData.map((entry) => mapProviderIdToAuthMethod(entry.providerId)),
        ]));
      } finally {
        setAuthLoading(false);
      }
    });
  }, []);

  // ── Auto sign-in for Telegram users ─────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    if (user) return;
    const tg = getTelegramWebApp();
    const tgUser = getTgUser();
    if (!tgUser?.id) return;
    const telegramInitData = tg?.initData;
    if (!telegramInitData) {
      setTelegramAuthError('Telegram init data is missing.');
      return;
    }
    if (!telegramAuthApiUrl) {
      setTelegramAuthError('Missing VITE_TELEGRAM_AUTH_API_URL in the frontend environment.');
      return;
    }
    if (telegramAuthInFlight.current) return;

    telegramAuthInFlight.current = true;
    setTelegramAuthPending(true);

    fetch(telegramAuthApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
      body: JSON.stringify({ telegramInitData, chatId: String(tgUser.id) }),
    })
      .then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as { error?: string; customToken?: string };
        if (!response.ok) throw new Error(data.error || 'Telegram auth API request failed.');
        if (!data.customToken) throw new Error('Telegram auth API did not return a custom token.');
        return signInWithCustomToken(auth, data.customToken);
      })
      .then(() => setTelegramAuthError(null))
      .catch((err) => {
        console.error('[telegram] auth failed:', err);
        setTelegramAuthError(formatTelegramAuthError(err));
      })
      .finally(() => {
        telegramAuthInFlight.current = false;
        setTelegramAuthPending(false);
      });
  }, [authLoading, user, telegramRetryKey]);

  // ── Profile bootstrap + load (server-owned) ──────────────────────────────────
  // One idempotent call after login grants the trial, seeds default categories,
  // and syncs auth metadata; it returns the profile, which seeds the query cache.
  useEffect(() => {
    if (!uid) {
      setBootstrapped(false);
      return;
    }
    let cancelled = false;
    setBootstrapped(false);
    api.post<UserProfile & { id: string }>('/v1/profile/bootstrap')
      .then((data) => {
        if (cancelled) return;
        queryClient.setQueryData(qk.profile(uid), data);
        setBootstrapped(true);
      })
      .catch((err) => {
        console.error('[context] profile bootstrap failed:', err);
        if (!cancelled) setBootstrapped(true); // allow the GET query to retry
      });
    return () => { cancelled = true; };
  }, [uid, queryClient]);

  const profileQuery = useQuery({
    queryKey: qk.profile(uid ?? '_anon'),
    queryFn: () => api.get<UserProfile & { id: string }>('/v1/profile'),
    enabled: !!uid && bootstrapped,
    retry: false,
  });

  const profile = (profileQuery.data as UserProfile | undefined) ?? null;
  const profileLoading = !!uid && (!bootstrapped || profileQuery.isLoading);

  const startPaymentMonitoring = useCallback((orderId: string) => {
    if (!uid || !isOrderId(orderId)) return;

    const current = paymentMonitorRef.current;
    if (current?.orderId === orderId && !current.cancelled) return;
    if (current) current.cancelled = true;

    const monitor = { orderId, cancelled: false };
    paymentMonitorRef.current = monitor;
    paymentModalDismissedRef.current = false;
    savePendingPayment(uid, orderId);
    setPaymentResult({ phase: 'checking' });

    void (async () => {
      let paidOrder: CheckoutSession | null = null;
      let lastOrder: CheckoutSession | null = null;

      try {
        for (let attempt = 0; attempt < PAYMENT_POLL_ATTEMPTS && !monitor.cancelled; attempt += 1) {
          try {
            // This endpoint is authenticated and asks ATMOS for the current
            // provider status, so a successful result is safe to use for UI.
            const order = await paymentApi.refreshOrder(orderId);
            lastOrder = order;
            if (order.status === 'PAID') {
              paidOrder = order;
              break;
            }
            if (order.status !== 'PENDING_PAYMENT') break;
          } catch (error) {
            // ATMOS and the payment API can briefly be unavailable while the
            // customer is returning from the bank page. Keep the order pending
            // and spend the remaining polling attempts before showing delayed.
            console.warn('[billing] payment status attempt failed:', error);
          }

          if (attempt < PAYMENT_POLL_ATTEMPTS - 1 && !monitor.cancelled) {
            await new Promise<void>((resolve) => window.setTimeout(resolve, PAYMENT_POLL_INTERVAL_MS));
          }
        }

        if (monitor.cancelled) return;

        if (!paidOrder) {
          if (lastOrder?.status !== 'PENDING_PAYMENT') clearPendingPayment(uid);
          if (paymentMonitorRef.current === monitor) paymentMonitorRef.current = null;
          if (!paymentModalDismissedRef.current) {
            setPaymentResult({
              phase: lastOrder?.status === 'EXPIRED' || lastOrder?.status === 'CANCELLED'
                ? 'expired'
                : 'delayed',
              orderId,
            });
          }
          return;
        }

        const confirmedOrder = paidOrder;

        clearPendingPayment(uid);
        if (paymentMonitorRef.current === monitor) paymentMonitorRef.current = null;

        const entitlementUntil = paidOrder.entitlementEndAt
          ? Date.parse(paidOrder.entitlementEndAt)
          : null;

        // Show the success animation as soon as the payment service confirms
        // the order. Firestore projection is allowed to catch up in parallel.
        paymentModalDismissedRef.current = false;
        setPaymentResult({ phase: 'success', order: confirmedOrder });

        if (entitlementUntil && Number.isFinite(entitlementUntil)) {
          queryClient.setQueryData<UserProfile & { id?: string }>(qk.profile(uid), (currentProfile) => currentProfile ? ({
            ...currentProfile,
            isPremium: true,
            subscription: {
              ...currentProfile.subscription,
              tier: 'premium',
              isTrial: false,
              source: 'atmos',
              premiumUntil: entitlementUntil,
              lastOrderId: confirmedOrder.orderId,
            },
          }) : currentProfile);
        }

        void (async () => {
          // The payment API's outbox is authoritative for the durable profile,
          // but the success screen should not wait for network propagation.
          for (let attempt = 0; attempt < 12 && !monitor.cancelled; attempt += 1) {
            try {
              const durableProfile = await api.get<UserProfile & { id: string }>(
                `/v1/profile?billingRefresh=${Date.now()}`,
              );
              const durableUntil = durableProfile.subscription?.premiumUntil;
              if (durableProfile.isPremium === true
                && typeof durableUntil === 'number'
                && durableUntil > Date.now()) {
                queryClient.setQueryData(qk.profile(uid), durableProfile);
                break;
              }
            } catch (profileError) {
              console.warn('[billing] waiting for profile projection:', profileError);
            }
            if (attempt < 11) {
              await new Promise<void>((resolve) => window.setTimeout(resolve, 1_500));
            }
          }
        })();
      } catch (error) {
        console.error('[billing] payment status refresh failed:', error);
        if (!monitor.cancelled) {
          if (paymentMonitorRef.current === monitor) paymentMonitorRef.current = null;
          if (!paymentModalDismissedRef.current) setPaymentResult({ phase: 'delayed', orderId });
        }
      }
    })();
  }, [uid, queryClient]);

  // ATMOS returns through the public web URL. The query string and Telegram
  // start parameter are only hints; the payment API remains the source of truth.
  useEffect(() => {
    if (!uid || !bootstrapped || profileLoading) return;

    const url = new URL(window.location.href);
    const queryOrderId = url.searchParams.get('order');
    const paymentHint = url.searchParams.get('payment');
    const returnState = url.searchParams.get('state');
    if (queryOrderId && returnState && !paymentHint) {
      window.location.replace(paymentApi.returnUrl(queryOrderId, returnState));
      return;
    }

    const startParamOrderId = paymentOrderFromStartParam(getTelegramWebApp()?.initDataUnsafe?.start_param);
    const storedOrder = readPendingPayment(uid);
    const currentStoredOrder = storedOrder
      && Date.now() - storedOrder.createdAt <= PAYMENT_ORDER_PRIORITY_WINDOW_MS
      ? storedOrder
      : null;
    const orderId = isOrderId(queryOrderId) && paymentHint
      ? queryOrderId
      : currentStoredOrder
        ? currentStoredOrder.orderId
        : startParamOrderId ?? storedOrder?.orderId;
    if (!orderId) return;

    savePendingPayment(uid, orderId);
    startPaymentMonitoring(orderId);

    if (paymentHint || queryOrderId) {
      url.searchParams.delete('payment');
      url.searchParams.delete('order');
      url.searchParams.delete('state');
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }
  }, [uid, bootstrapped, profileLoading, startPaymentMonitoring]);

  // Telegram may suspend the Mini App while ATMOS is open in an external
  // browser. Resume the same authenticated order immediately when the app is
  // visible again, even when ATMOS did not navigate back through a return URL.
  useEffect(() => {
    if (!uid || !bootstrapped) return;
    const resumePayment = () => {
      if (document.visibilityState !== 'visible') return;
      const pending = readPendingPayment(uid);
      if (pending) startPaymentMonitoring(pending.orderId);
    };
    document.addEventListener('visibilitychange', resumePayment);
    window.addEventListener('pageshow', resumePayment);
    return () => {
      document.removeEventListener('visibilitychange', resumePayment);
      window.removeEventListener('pageshow', resumePayment);
    };
  }, [uid, bootstrapped, startPaymentMonitoring]);

  useEffect(() => () => {
    if (paymentMonitorRef.current) paymentMonitorRef.current.cancelled = true;
  }, [uid]);

  const reloadUser = async () => {
    if (!auth.currentUser) return;
    await auth.currentUser.reload();
    try {
      await applyAuthState(auth.currentUser);
    } catch (err) {
      console.error('[auth] failed to refresh token claims:', err);
    }
  };

  const saveProfile = useCallback(async (data: Partial<UserProfile>) => {
    if (!uid) return;
    const updated = await api.patch<UserProfile & { id: string }>('/v1/profile', data);
    queryClient.setQueryData(qk.profile(uid), updated);
  }, [uid, queryClient]);

  const languageSyncedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!uid || !profile) return;
    if (profile.language && profile.language !== i18n.language) {
      void i18n.changeLanguage(profile.language);
      localStorage.setItem('lang', profile.language);
      languageSyncedFor.current = uid;
      return;
    }
    if (!profile.language && languageSyncedFor.current !== uid) {
      languageSyncedFor.current = uid;
      const language = (['en', 'ru', 'uz'].includes(i18n.language) ? i18n.language : 'uz') as 'en' | 'ru' | 'uz';
      void saveProfile({ language }).catch((error) => {
        languageSyncedFor.current = null;
        console.warn('[profile] language sync failed:', error);
      });
    }
  }, [uid, profile, saveProfile]);

  useEffect(() => {
    if (!transactionDeepLinkId) return;
    setActiveTab('transactions');
    const url = new URL(window.location.href);
    if (url.searchParams.has('tx')) {
      url.searchParams.delete('tx');
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }
  }, [transactionDeepLinkId]);

  const clearTransactionDeepLink = useCallback(() => setTransactionDeepLinkId(null), []);

  // ── Consent-based Telegram linking for signed-in email users (option B) ──────
  const linkTelegram = async () => {
    const tg = getTelegramWebApp();
    const tgUser = getTgUser();
    const telegramInitData = tg?.initData;
    if (!user || !tgUser?.id || !telegramInitData) {
      setTelegramLinkError('Telegram is unavailable right now.');
      return;
    }
    if (!telegramAuthApiUrl) {
      setTelegramLinkError('Missing VITE_TELEGRAM_AUTH_API_URL in the frontend environment.');
      return;
    }
    setTelegramLinkPending(true);
    setTelegramLinkError(null);
    try {
      const firebaseIdToken = await user.getIdToken();
      const response = await fetch(telegramAuthApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({ telegramInitData, chatId: String(tgUser.id), firebaseIdToken }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Telegram link request failed.');
      await saveProfile({ telegramLinkPromptDismissed: true });
      await reloadUser();
    } catch (err) {
      console.error('[telegram] link failed:', err);
      setTelegramLinkError(formatTelegramAuthError(err));
    } finally {
      setTelegramLinkPending(false);
    }
  };

  const dismissTelegramLinkPrompt = () => {
    void saveProfile({ telegramLinkPromptDismissed: true });
  };

  const dismissPaymentResult = () => {
    paymentModalDismissedRef.current = true;
    setPaymentResult(null);
  };

  const currentTgChatId = getTgUser()?.id;
  const telegramAlreadyLinked = authProvider === 'telegram'
    || (currentTgChatId != null && (profile?.telegramChatIds?.includes(currentTgChatId) ?? false));
  const showTelegramLinkPrompt = Boolean(user)
    && !authLoading
    && !profileLoading
    && currentTgChatId != null
    && authProvider !== 'telegram'
    && !telegramAlreadyLinked
    && !profile?.telegramLinkPromptDismissed;

  return (
    <AppContext.Provider value={{
      user,
      authLoading,
      authProvider,
      linkedAuthMethods,
      authUpgradeRequired: !hasModernAuthMethod(linkedAuthMethods),
      telegramAuthPending,
      telegramAuthError,
      retryTelegramAuth,
      showTelegramLinkPrompt,
      telegramLinkPending,
      telegramLinkError,
      linkTelegram,
      dismissTelegramLinkPrompt,
      reloadUser,
      activeTab, setActiveTab,
      categoryFilter, setCategoryFilter,
      historyFilters, setHistoryFilters,
      tabResetNonce, requestTabReset,
      profile, profileLoading, saveProfile,
      transactionDeepLinkId, clearTransactionDeepLink,
      startPaymentMonitoring,
      paymentResult, dismissPaymentResult,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
};
