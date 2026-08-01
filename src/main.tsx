import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import "./global.css"
import './i18n/index'
import { telegramApp, tgAtLeast, type TelegramInset } from './utils/telegram'
import { detectScheme } from './utils/theme'

// Telegram Mini App bootstrap
let fullscreenRequested = Boolean(telegramApp?.isFullscreen);
if (telegramApp) {
  document.documentElement.classList.add('telegram-mini-app');
  telegramApp.ready();
  telegramApp.expand();
  try {
    if (!telegramApp.isFullscreen && telegramApp.requestFullscreen && tgAtLeast('8.0')) {
      fullscreenRequested = true;
      telegramApp.requestFullscreen();
    }
  } catch {
    fullscreenRequested = false;
    // Older clients still get the tallest non-fullscreen viewport via expand().
  }
}

// Theme: follow Telegram colorScheme when in TG, otherwise system preference
const THEME_BG = { dark: '#161618', light: '#F2F2F7' } as const;
const applyTheme = (scheme: 'light' | 'dark') => {
  document.documentElement.setAttribute('data-theme', scheme);
  const bg = THEME_BG[scheme];
  if (telegramApp) {
    try {
      // Both colour setters landed in 6.1; calling them on older clients only
      // produces "… is not supported in version 6.0" console warnings.
      if (tgAtLeast('6.1')) {
        telegramApp.setHeaderColor(bg);
        telegramApp.setBackgroundColor(bg);
      }
      if (tgAtLeast('7.10')) {
        telegramApp.setBottomBarColor?.(bg);
      }
    } catch { /* ignore */ }
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
};
applyTheme(detectScheme());
if (telegramApp) telegramApp.onEvent('themeChanged', () => applyTheme(detectScheme()));
window.matchMedia?.('(prefers-color-scheme: light)').addEventListener?.('change', () => {
  if (!telegramApp) applyTheme(detectScheme());
});

const setInsetVars = (prefix: string, inset?: TelegramInset) => {
  const root = document.documentElement.style;
  root.setProperty(`${prefix}-top-js`, `${inset?.top ?? 0}px`);
  root.setProperty(`${prefix}-right-js`, `${inset?.right ?? 0}px`);
  root.setProperty(`${prefix}-bottom-js`, `${inset?.bottom ?? 0}px`);
  root.setProperty(`${prefix}-left-js`, `${inset?.left ?? 0}px`);
};

// Keep the layout tied to the currently visible viewport. This also reacts to
// the iOS keyboard, unlike viewportStableHeight on its own.
const syncViewportMetrics = () => {
  const visualHeight = window.visualViewport?.height;
  const telegramHeight = telegramApp?.viewportHeight;
  const candidates = [visualHeight, telegramHeight, window.innerHeight]
    .filter((value): value is number => typeof value === 'number' && value > 0);
  const height = Math.min(...candidates);
  const stableHeight = telegramApp?.viewportStableHeight ?? window.innerHeight;
  const viewportTop = window.visualViewport?.offsetTop ?? 0;
  const root = document.documentElement.style;

  document.documentElement.toggleAttribute(
    'data-tg-fullscreen',
    fullscreenRequested || Boolean(telegramApp?.isFullscreen),
  );
  root.setProperty('--app-height', `${height}px`);
  root.setProperty('--app-stable-height', `${stableHeight}px`);
  root.setProperty('--app-viewport-top', `${viewportTop}px`);
  setInsetVars('--tg-safe', telegramApp?.safeAreaInset);
  setInsetVars('--tg-content-safe', telegramApp?.contentSafeAreaInset);
};

syncViewportMetrics();
window.addEventListener('resize', syncViewportMetrics);
window.visualViewport?.addEventListener('resize', syncViewportMetrics);
window.visualViewport?.addEventListener('scroll', syncViewportMetrics);
const tg = telegramApp;
if (tg) {
  tg.onEvent('viewportChanged', syncViewportMetrics);
  tg.onEvent('safeAreaChanged', syncViewportMetrics);
  tg.onEvent('contentSafeAreaChanged', syncViewportMetrics);
  tg.onEvent('fullscreenChanged', () => {
    fullscreenRequested = Boolean(tg.isFullscreen);
    syncViewportMetrics();
  });
  tg.onEvent('fullscreenFailed', () => {
    fullscreenRequested = false;
    syncViewportMetrics();
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
