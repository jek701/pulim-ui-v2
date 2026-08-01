import { useEffect, useState } from 'react';
import { telegramApp } from './telegram';

export type ColorScheme = 'light' | 'dark';

/** Telegram's colorScheme wins inside a real client; browser/PWA follows the OS. */
export const detectScheme = (): ColorScheme => {
  if (telegramApp?.colorScheme === 'light' || telegramApp?.colorScheme === 'dark') return telegramApp.colorScheme;
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
};

/**
 * Reactive counterpart of `detectScheme` — components must not call the plain
 * function, since it is read once at render and goes stale when the theme flips.
 */
export const useColorScheme = (): ColorScheme => {
  const [scheme, setScheme] = useState<ColorScheme>(detectScheme);

  useEffect(() => {
    const sync = () => setScheme(detectScheme());
    const media = window.matchMedia?.('(prefers-color-scheme: light)');
    media?.addEventListener?.('change', sync);
    telegramApp?.onEvent('themeChanged', sync);
    sync();
    return () => {
      media?.removeEventListener?.('change', sync);
      telegramApp?.offEvent?.('themeChanged', sync);
    };
  }, []);

  return scheme;
};
