export type TelegramInset = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type TelegramWebApp = {
  initData?: string;
  initDataUnsafe?: {
    start_param?: string;
  };
  platform?: string;
  colorScheme?: 'light' | 'dark';
  version?: string;
  isFullscreen?: boolean;
  viewportHeight?: number;
  viewportStableHeight?: number;
  safeAreaInset?: TelegramInset;
  contentSafeAreaInset?: TelegramInset;
  ready: () => void;
  expand: () => void;
  requestFullscreen?: () => void;
  isVersionAtLeast?: (version: string) => boolean;
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
  setBottomBarColor?: (color: string) => void;
  showConfirm?: (message: string, callback: (confirmed: boolean) => void) => void;
  onEvent: (event: string, callback: (...args: unknown[]) => void) => void;
  offEvent?: (event: string, callback: (...args: unknown[]) => void) => void;
};

const rawWebApp = (window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp;

/**
 * `telegram-web-app.js` is loaded unconditionally by `index.html`, so `Telegram.WebApp`
 * also exists in a plain browser — reporting version "6.0", platform "unknown" and an
 * empty `initData`. Treat the SDK as live only when one of those actually looks real,
 * otherwise the browser/PWA build inherits Telegram's stub values (theme, insets…).
 */
export const telegramApp: TelegramWebApp | undefined =
  rawWebApp && (rawWebApp.initData || (rawWebApp.platform && rawWebApp.platform !== 'unknown'))
    ? rawWebApp
    : undefined;

export const isTelegram = Boolean(telegramApp);

/** Telegram throws console warnings for APIs the running client is too old for. */
export const tgAtLeast = (version: string): boolean => {
  if (!telegramApp) return false;
  if (!telegramApp.isVersionAtLeast) return false;
  try {
    return telegramApp.isVersionAtLeast(version);
  } catch {
    return false;
  }
};

/**
 * Native Telegram confirm (6.2+). Resolves `null` when unavailable so callers can
 * fall back to their own dialog instead of silently doing nothing.
 */
export const tgShowConfirm = (message: string): Promise<boolean> | null => {
  if (!telegramApp?.showConfirm || !tgAtLeast('6.2')) return null;
  try {
    return new Promise<boolean>(resolve => {
      telegramApp.showConfirm!(message, confirmed => resolve(Boolean(confirmed)));
    });
  } catch {
    return null;
  }
};
