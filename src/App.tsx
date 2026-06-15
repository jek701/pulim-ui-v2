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
import PhoneNameSetup from './pages/PhoneNameSetup';
import styles from './App.module.css';

const PageContent = () => {
  const { activeTab } = useApp();
  return (
    <div key={activeTab} className={styles.pageAnim}>
      {activeTab === 'home'         && <Home />}
      {activeTab === 'transactions' && <Transactions />}
      {activeTab === 'cards'        && <Accounts />}
      {activeTab === 'subscriptions' && <Subscriptions />}
      {activeTab === 'charts'        && <Charts />}
      {activeTab === 'calendar'      && <Calendar />}
      {activeTab === 'settings'     && <Settings />}
    </div>
  );
};

const AppShell = () => {
  const {
    user,
    authLoading,
    authProvider,
    profile,
    profileLoading,
    telegramAuthPending,
    telegramAuthError,
  } = useApp();

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
    <div className={styles.shell}>
      <TelegramLinkBanner />
      <PageContent />
      <BottomNav />
    </div>
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
