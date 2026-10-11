import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { AppProvider, useApp } from './context';
import { queryClient } from './api/queryClient';
import { firebaseConfigured } from './firebase';
import Login from './pages/Login';
import Home from './pages/Home';
import Transactions from './pages/Transactions';
import Accounts from './pages/Accounts';
import Subscriptions from './pages/Subscriptions';
import Charts from './pages/Charts';
import Calendar from './pages/Calendar';
import Settings from './pages/Settings';
import BottomNav from './components/BottomNav';
import AuthLanguageSelector from './components/AuthLanguageSelector';
import TelegramLinkBanner from './components/TelegramLinkBanner';
import NotificationEnableBanner from './components/NotificationEnableBanner';
import CommunicationSurface from './communications/CommunicationSurface';
import { communicationsEnabled } from './communications/config';
import PaymentResultModal from './components/PaymentResultModal';
import PremiumModal from './components/PremiumModal';
import PhoneNameSetup from './pages/PhoneNameSetup';
import HouseholdSpace from './pages/HouseholdSpace';
import WorkspaceSwitcher from './components/WorkspaceSwitcher';
import { useDevNotesAccess } from './hooks/useDevNotes';
import { adjacentNavTab } from './utils/tabNavigation';
import styles from './App.module.css';

// Owner-only feedback widget: never downloaded unless the server enables it for this uid.
const DevNotesRoot = lazy(() => import('./devNotes/DevNotesRoot'));

const PageContent = () => {
  const { activeTab, setActiveTab, tabTransitionDirection, workspace } = useApp();
  const gesture = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const lastWheelSwitch = useRef(0);
  const transitionClass = tabTransitionDirection === 'forward'
    ? styles.pageForward
    : tabTransitionDirection === 'backward' ? styles.pageBackward : '';

  const switchBy = (direction: -1 | 1) => {
    const next = adjacentNavTab(activeTab, workspace, direction);
    if (next) setActiveTab(next);
  };

  const ignoresTabSwipe = (target: EventTarget | null, boundary: HTMLElement) => {
    let element = target instanceof Element ? target : null;
    while (element && element !== boundary) {
      if (element.matches('button, a, input, textarea, select, [role="dialog"], [data-tab-swipe="ignore"]')) return true;
      const style = window.getComputedStyle(element);
      if (/(auto|scroll)/.test(style.overflowX) && element.scrollWidth > element.clientWidth + 4) return true;
      element = element.parentElement;
    }
    return false;
  };

  const page = workspace === 'household' ? <HouseholdSpace /> : (
    <>
      {activeTab === 'home'         && <Home />}
      {activeTab === 'transactions' && <Transactions />}
      {activeTab === 'cards'        && <Accounts />}
      {activeTab === 'subscriptions' && <Subscriptions />}
      {activeTab === 'charts'        && <Charts />}
      {activeTab === 'calendar'      && <Calendar />}
      {activeTab === 'settings'     && <Settings />}
    </>
  );

  return (
    <div
      className={styles.pageViewport}
      onPointerDown={event => {
        if (event.pointerType === 'mouse' || ignoresTabSwipe(event.target, event.currentTarget)) return;
        gesture.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
      }}
      onPointerUp={event => {
        const start = gesture.current;
        gesture.current = null;
        if (!start || start.pointerId !== event.pointerId) return;
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        if (Math.abs(dx) < 52 || Math.abs(dx) < Math.abs(dy) * 1.25) return;
        switchBy(dx < 0 ? 1 : -1);
      }}
      onPointerCancel={() => { gesture.current = null; }}
      onWheel={event => {
        if (ignoresTabSwipe(event.target, event.currentTarget)) return;
        if (Math.abs(event.deltaX) < 48 || Math.abs(event.deltaX) < Math.abs(event.deltaY) * 1.2) return;
        const now = Date.now();
        if (now - lastWheelSwitch.current < 450) return;
        lastWheelSwitch.current = now;
        switchBy(event.deltaX > 0 ? 1 : -1);
      }}
    >
      <div key={`${workspace}-${activeTab}`} className={`${styles.pageAnim} ${transitionClass}`}>
        {page}
      </div>
    </div>
  );
};

const AppShell = () => {
  const {
    user,
    activeTab,
    authLoading,
    authProvider,
    profile,
    profileLoading,
    telegramAuthPending,
    telegramAuthError,
    paymentResult,
    dismissPaymentResult,
  } = useApp();
  const devNotesAccess = useDevNotesAccess(user?.uid ?? null);
  const [showPremiumDeepLink, setShowPremiumDeepLink] = useState(
    () => new URL(window.location.href).searchParams.get('upgrade') === '1',
  );

  useEffect(() => {
    if (!user) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get('upgrade') === '1') url.searchParams.delete('upgrade');
    if (url.searchParams.has('tab')) url.searchParams.delete('tab');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }, [user]);

  if (authLoading || telegramAuthPending || (user && profileLoading)) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <AuthLanguageSelector />
        <Login externalError={telegramAuthError} />
      </>
    );
  }

  const phoneName = profile?.name?.trim() || user.displayName?.trim();
  if (authProvider === 'phone' && !phoneName) {
    return <PhoneNameSetup />;
  }

  return (
    <>
      <div className={styles.shell}>
        <TelegramLinkBanner />
        <NotificationEnableBanner />
        <WorkspaceSwitcher controllerOnly />
        <PageContent />
        <BottomNav />
      </div>
      <PaymentResultModal result={paymentResult} onClose={dismissPaymentResult} />
      {communicationsEnabled && <CommunicationSurface />}
      {showPremiumDeepLink && (
        <PremiumModal feature="generic" onClose={() => setShowPremiumDeepLink(false)} />
      )}
      {devNotesAccess.data?.enabled && (
        <Suspense fallback={null}><DevNotesRoot uid={user.uid} activeTab={activeTab} /></Suspense>
      )}
    </>
  );
};

const SetupScreen = () => (
  <div className={styles.setup}>
    <div className={styles.setupCard}>
      <p className={styles.setupIcon}>🔧</p>
      <h2>Firebase Setup Required</h2>
      <p>Create a <code>.env</code> file in the project root with your Firebase credentials:</p>
      <pre className={styles.setupCode}>{`VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_TELEGRAM_AUTH_API_URL=...`}</pre>
      <p className={styles.setupHint}>Get these from <strong>Firebase Console → Project Settings → Your apps</strong>, then restart the dev server.</p>
    </div>
  </div>
);

const App = () => {
  if (!firebaseConfigured) return <SetupScreen />;
  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <AppShell />
      </AppProvider>
    </QueryClientProvider>
  );
};

export default App;
