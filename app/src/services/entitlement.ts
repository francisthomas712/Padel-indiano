import { Platform } from 'react-native';
import { storage } from './storage';

/**
 * RevenueCat entitlement for the $0.99 day pass, following the OtterCycle
 * pattern: the native module is lazy-required and never touched unless an
 * API key is configured (so Expo Go / CI still runs).
 *
 * The 3-day trial is NOT an App Store trial (those only exist for
 * auto-renewable subs) — it's server-tracked by the Hetzner ledger via the
 * anonymous RevenueCat appUserID.
 */

const API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
const ENTITLEMENT_SERVER =
  process.env.EXPO_PUBLIC_ENTITLEMENT_SERVER ?? 'https://padel-entitlement.ottercycle.com';

export const purchasesEnabled = Platform.OS === 'ios' && !!API_KEY && API_KEY !== 'SET-ME-appl-key' && API_KEY !== 'SET-ME-test-key';

let Purchases: unknown = null;
function rc(): { getAppUserID: () => Promise<string> } | null {
  if (!purchasesEnabled) return null;
  if (!Purchases) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      Purchases = require('react-native-purchases').default;
    } catch {
      Purchases = null;
    }
  }
  return Purchases as { getAppUserID: () => Promise<string> } | null;
}

export interface AccessState {
  hasAccess: boolean;
  accessUntil: number | null;
  source: 'trial' | 'pass' | 'none' | 'never-started' | 'offline-cache';
  trialUsed: boolean;
}

const CACHE_KEY = 'entitlement-cache';
const OFFLINE_GRACE_MS = 5 * 60 * 1000; // allow brief network blips without nagging

interface CachedVerdict {
  state: AccessState;
  fetchedAt: number;
}

const readCache = (): CachedVerdict | null => {
  try {
    const raw = storage.getString(CACHE_KEY);
    return raw ? (JSON.parse(raw) as CachedVerdict) : null;
  } catch {
    return null;
  }
};

const writeCache = (state: AccessState): void => {
  try {
    storage.setString(CACHE_KEY, JSON.stringify({ state, fetchedAt: Date.now() } satisfies CachedVerdict));
  } catch {
    // cache write failures don't matter
  }
};

/** Configure RevenueCat once at app start (no-op without a key). */
export const configurePurchases = async (): Promise<void> => {
  const P = rc();
  if (!P || !API_KEY) return;
  try {
    const { default: RNPPurchases } = require('react-native-purchases');
    await RNPPurchases.configure({ apiKey: API_KEY });
  } catch {
    // leave entitlement unconfigured; verdict falls back to server/cache
  }
};

/**
 * Ask the ledger for the current verdict. Registers the device on first call
 * (starting its 72h trial). Falls back to the cached verdict with a short
 * offline grace window; a stale cache beyond grace reports locked unless the
 * cached state said access until a future timestamp.
 */
export const getAccess = async (): Promise<AccessState> => {
  let appUserId: string | null = null;
  const P = rc();
  if (P) {
    try {
      appUserId = await P.getAppUserID();
    } catch {
      appUserId = null;
    }
  }

  // No RevenueCat (Expo Go / misconfigured build): use a stable local id so
  // development still exercises the trial flow.
  if (!appUserId) {
    appUserId = storage.getString('dev-app-user-id');
    if (!appUserId) {
      appUserId = `dev-${Math.random().toString(36).slice(2)}`;
      storage.setString('dev-app-user-id', appUserId);
    }
  }

  try {
    const res = await fetch(`${ENTITLEMENT_SERVER}/access?rc=${encodeURIComponent(appUserId)}`);
    if (res.ok) {
      const state = (await res.json()) as AccessState;
      writeCache(state);
      return state;
    }
    throw new Error(`status ${res.status}`);
  } catch {
    const cached = readCache();
    if (cached) {
      const age = Date.now() - cached.fetchedAt;
      const stillValidByTime = cached.state.accessUntil !== null && cached.state.accessUntil > Date.now();
      if (stillValidByTime || age < OFFLINE_GRACE_MS) {
        return { ...cached.state, source: 'offline-cache' };
      }
    }
    return { hasAccess: false, accessUntil: null, source: 'offline-cache', trialUsed: false };
  }
};
