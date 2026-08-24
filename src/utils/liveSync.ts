import { LiveScoreboard } from '../components/SpectatorMode';
import { PlayerWithStats, LeaderboardMode } from '../types';

/**
 * Client for the /api/live-state sync function (Netlify Function + Blobs).
 * The organizer device publishes a compact live snapshot after every state
 * change; spectator devices poll it every few seconds. All failures are
 * silent — the app stays fully usable offline, sync is a progressive
 * enhancement.
 */

const POLL_INTERVAL_MS = 4000;
const PUBLISH_DEBOUNCE_MS = 1500;

export interface LiveSnapshot {
  groupName: string;
  updatedAt: number;
  boards: LiveScoreboard[];
  leaderboard: PlayerWithStats[];
  mode: LeaderboardMode;
  restingLabel: string | null;
}

const isLiveSyncAvailable = (): boolean =>
  typeof fetch !== 'undefined';

const endpoint = (group: string): string =>
  `/api/live-state?group=${encodeURIComponent(group)}`;

/**
 * Publish a snapshot for a group. Debounced so rapid score taps don't spam
 * the function; the trailing call always wins. Returns false when offline.
 */
let publishTimer: ReturnType<typeof setTimeout> | null = null;
let lastPublishAttempt = 0;

export const publishLiveState = (snapshot: LiveSnapshot): void => {
  if (!isLiveSyncAvailable()) return;

  if (publishTimer) clearTimeout(publishTimer);
  const run = async () => {
    // Basic client-side rate limit: at most one publish per second
    const now = Date.now();
    if (now - lastPublishAttempt < 1000) return;
    lastPublishAttempt = now;
    try {
      await fetch(endpoint(snapshot.groupName), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(snapshot),
        keepalive: true
      });
    } catch {
      // Offline or function unavailable — spectators fall back to local view
    }
  };
  publishTimer = setTimeout(run, PUBLISH_DEBOUNCE_MS);
};

/**
 * Fetch the current snapshot for a group. Returns null when the group has
 * never published or the network/function is unavailable.
 */
export const fetchLiveState = async (group: string): Promise<LiveSnapshot | null> => {
  if (!isLiveSyncAvailable()) return null;
  try {
    const res = await fetch(endpoint(group));
    if (!res.ok) return null;
    const data = await res.json();
    return data ?? null;
  } catch {
    return null;
  }
};

/**
 * Poll a group's snapshot every POLL_INTERVAL_MS. Returns a cancel function.
 */
export const pollLiveState = (
  group: string,
  onUpdate: (snapshot: LiveSnapshot | null) => void
): (() => void) => {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const tick = async () => {
    if (cancelled) return;
    const snap = await fetchLiveState(group);
    if (!cancelled) onUpdate(snap);
    if (!cancelled) timer = setTimeout(tick, POLL_INTERVAL_MS);
  };
  tick();

  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
  };
};
