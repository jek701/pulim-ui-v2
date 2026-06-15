import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import "./global.css"
import './i18n/index'

// Telegram Mini App bootstrap
const tg = (window as any).Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}

// Theme: follow Telegram colorScheme when in TG, otherwise system preference
const THEME_BG = { dark: '#161618', light: '#F2F2F7' } as const;
const applyTheme = (scheme: 'light' | 'dark') => {
  document.documentElement.setAttribute('data-theme', scheme);
  const bg = THEME_BG[scheme];
  if (tg) {
    try { tg.setHeaderColor(bg); tg.setBackgroundColor(bg); } catch { /* ignore */ }
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
};
export const detectScheme = (): 'light' | 'dark' => {
  if (tg?.colorScheme === 'light' || tg?.colorScheme === 'dark') return tg.colorScheme;
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
};
applyTheme(detectScheme());
if (tg) tg.onEvent('themeChanged', () => applyTheme(detectScheme()));
window.matchMedia?.('(prefers-color-scheme: light)').addEventListener?.('change', () => {
  if (!tg) applyTheme(detectScheme());
});

// Set real viewport height as a CSS variable (fixes 100vh in mobile browsers & Telegram)
const setVh = () => {
  const h = tg?.viewportStableHeight || window.innerHeight;
  document.documentElement.style.setProperty('--vh', `${h}px`);
};
setVh();
window.addEventListener('resize', setVh);
if (tg) tg.onEvent('viewportChanged', setVh);

// Push content below Telegram's top control buttons
const setTopInset = () => {
  const top = tg?.contentSafeAreaInset?.top ?? tg?.safeAreaInset?.top ?? 0;
  document.documentElement.style.setProperty('--tg-top', `${top}px`);
};
setTopInset();
if (tg) tg.onEvent('safeAreaChanged', setTopInset);
if (tg) tg.onEvent('contentSafeAreaChanged', setTopInset);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
