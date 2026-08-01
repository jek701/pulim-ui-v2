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
  paymentResult: PaymentResult | null;
  dismissPaymentResult: () => void;
}

export type PaymentResult =
  | { phase: 'checking' }
  | { phase: 'success'; order: CheckoutSession }
  | { phase: 'delayed'; orderId: string };

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
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [historyFilters, setHistoryFilters] = useState<HistoryFilters>(EMPTY_HISTORY_FILTERS);
  const [tabResetNonce, setTabResetNonce] = useState(0);
  const requestTabReset = useCallback(() => setTabResetNonce(value => value + 1), []);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null);
  const telegramAuthInFlight = useRef(false);

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
    const provider = tokenResult.claims.provider === 'telegram'
      ? 'telegram'
      : mapProviderIdToAuthMethod(signInProviderId)
        ?? mapProviderIdToAuthMethod(nextUser.providerData[0]?.providerId)
        ?? (nextUser.email ? 'email' : null);
    const methods = dedupeAuthMethods([
      provider === 'telegram' ? 'telegram' : null,
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

  // ATMOS returns through the public web URL. The query string is only a hint:
  // always ask the payment service for the authenticated, provider-verified status.
  useEffect(() => {
    if (!uid) return;
    const url = new URL(window.location.href);
    const orderId = url.searchParams.get('order');
    const paymentHint = url.searchParams.get('payment');
    const returnState = url.searchParams.get('state');
    if (orderId && returnState && !paymentHint) {
      window.location.replace(paymentApi.returnUrl(orderId, returnState));
      return;
    }
    if (!orderId || !paymentHint) return;

    let cancelled = false;
    setPaymentResult({ phase: 'checking' });
    void (async () => {
      try {
        let paidOrder: CheckoutSession | null = null;
        for (let attempt = 0; attempt < 10 && !cancelled; attempt += 1) {
          const order = await paymentApi.refreshOrder(orderId);
          if (order.status === 'PAID') {
            paidOrder = order;
            break;
          }
          if (order.status !== 'PENDING_PAYMENT') break;
          if (attempt < 9) {
            await new Promise((resolve) => window.setTimeout(resolve, 3_000));
          }
        }

        if (!paidOrder || cancelled) {
          if (!cancelled) setPaymentResult({ phase: 'delayed', orderId });
          return;
        }

        const entitlementUntil = paidOrder.entitlementEndAt
          ? Date.parse(paidOrder.entitlementEndAt)
          : null;
        setPaymentResult({ phase: 'success', order: paidOrder });

        // The authenticated payment API result is provider-verified. Reflect it
        // immediately in the local profile cache, then keep polling the main API
        // until the durable Firestore projection catches up through the outbox.
        if (entitlementUntil && Number.isFinite(entitlementUntil)) {
          queryClient.setQueryData<UserProfile & { id?: string }>(qk.profile(uid), (current) => current ? ({
            ...current,
            isPremium: true,
            subscription: {
              ...current.subscription,
              tier: 'premium',
              isTrial: false,
              source: 'atmos',
              premiumUntil: entitlementUntil,
              lastOrderId: paidOrder.orderId,
            },
          }) : current);
        }

        for (let attempt = 0; attempt < 12 && !cancelled; attempt += 1) {
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
            await new Promise((resolve) => window.setTimeout(resolve, 1_500));
          }
        }
      } catch (err) {
        console.error('[billing] payment status refresh failed:', err);
        if (!cancelled) setPaymentResult({ phase: 'delayed', orderId });
      } finally {
        if (!cancelled) {
          url.searchParams.delete('payment');
          url.searchParams.delete('order');
          url.searchParams.delete('state');
          window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [uid, queryClient]);

  const reloadUser = async () => {
    if (!auth.currentUser) return;
    await auth.currentUser.reload();
    try {
      await applyAuthState(auth.currentUser);
    } catch (err) {
      console.error('[auth] failed to refresh token claims:', err);
    }
  };

  const saveProfile = async (data: Partial<UserProfile>) => {
    if (!uid) return;
    const updated = await api.patch<UserProfile & { id: string }>('/v1/profile', data);
    queryClient.setQueryData(qk.profile(uid), updated);
  };

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

  const dismissPaymentResult = () => setPaymentResult(null);

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
