import type { Tab } from '../types';

const tabs: Tab[] = ['home', 'transactions', 'cards', 'subscriptions', 'charts', 'settings', 'calendar'];

export function followCommunicationLink(url: string | undefined, setActiveTab: (tab: Tab) => void) {
  if (!url) return;
  try {
    const target = new URL(url, window.location.origin);
    if (target.origin !== window.location.origin) {
      window.open(target.toString(), '_blank', 'noopener,noreferrer');
      return;
    }
    const tab = target.searchParams.get('tab');
    if (tabs.includes(tab as Tab)) setActiveTab(tab as Tab);
  } catch { /* Server validation rejects malformed URLs before delivery. */ }
}
