import { useEffect } from 'react';

/**
 * Minimal structural types for the Screen Wake Lock API.
 * (Not present in older TS DOM libs; feature-detected at runtime.)
 */
interface WakeLockSentinel {
  release: () => Promise<void>;
}

interface WakeLockApi {
  request: (type: 'screen') => Promise<WakeLockSentinel>;
}

/**
 * Keeps the screen awake while `active` is true — essential on court so the
 * scoreboard doesn't lock mid-rally. Re-acquires automatically when the tab
 * becomes visible again (browsers force-release wake locks when hidden).
 */
export const useWakeLock = (active: boolean): void => {
  useEffect(() => {
    if (!active) return;

    const getWakeLock = (): WakeLockApi | undefined =>
      (navigator as unknown as { wakeLock?: WakeLockApi }).wakeLock;

    let sentinel: WakeLockSentinel | null = null;
    let released = false;

    const request = async () => {
      try {
        const api = getWakeLock();
        if (!api) return;
        // Drop any stale lock before re-requesting (e.g., after visibility change)
        if (sentinel) {
          await sentinel.release().catch(() => undefined);
          sentinel = null;
        }
        if (released) return;
        sentinel = await api.request('screen');
      } catch {
        // Wake Lock unsupported or denied — silently ignore
      }
    };

    request();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        request();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      released = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (sentinel) {
        sentinel.release().catch(() => undefined);
        sentinel = null;
      }
    };
  }, [active]);
};
