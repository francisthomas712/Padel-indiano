import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { TournamentState, LeaderboardMode, PlayerWithStats } from '../core/types';

/**
 * Live-sync client for the Netlify function, mirroring the web app's
 * src/utils/liveSync.ts. Publishes the organizer's snapshot, polls for
 * spectator views. All failures are silent — offline-first.
 */

const LIVE_SYNC_BASE =
  Platform.OS === 'web'
    ? ''
    : 'https://padel-indiano.netlify.app';

const PUBLISH_DEBOUNCE_MS = 300;
const POLL_INTERVAL_MS = 1500;

export interface LiveScoreboard {
  id: string;
  title: string;
  team1Name: string;
  team2Name: string;
  score1: number;
  score2: number;
  pointsToWin: number;
  serverName: string | null;
}

export interface LiveSnapshot {
  groupName: string;
  updatedAt: number;
  boards: LiveScoreboard[];
  leaderboard: PlayerWithStats[];
  mode: LeaderboardMode;
  restingLabel: string | null;
}

export const hapticPoint = (): void => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
};
export const hapticCorrection = (): void => {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
};
export const hapticWin = (): void => {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
};

let publishTimer: ReturnType<typeof setTimeout> | null = null;

export const publishLiveState = (snapshot: LiveSnapshot): void => {
  if (publishTimer) clearTimeout(publishTimer);
  publishTimer = setTimeout(async () => {
    try {
      await fetch(`${LIVE_SYNC_BASE}/api/live-state?group=${encodeURIComponent(snapshot.groupName)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(snapshot)
      });
    } catch {
      // offline — spectators fall back to their last view
    }
  }, PUBLISH_DEBOUNCE_MS);
};

export const pollLiveState = (
  group: string,
  onUpdate: (snapshot: LiveSnapshot | null) => void
): (() => void) => {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const tick = async () => {
    if (cancelled) return;
    try {
      const res = await fetch(`${LIVE_SYNC_BASE}/api/live-state?group=${encodeURIComponent(group)}`);
      const data = res.ok ? await res.json() : null;
      if (!cancelled) onUpdate(data ?? null);
    } catch {
      if (!cancelled) onUpdate(null);
    }
    if (!cancelled) timer = setTimeout(tick, POLL_INTERVAL_MS);
  };
  tick();

  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
  };
};

/** Build the snapshot from state — same shape as the web app. */
export const buildSnapshot = (
  groupName: string,
  state: TournamentState,
  boards: LiveScoreboard[],
  leaderboard: PlayerWithStats[],
  mode: LeaderboardMode
): LiveSnapshot => {
  const lastRound = state.rounds[state.rounds.length - 1];
  return {
    groupName: groupName.toLowerCase(),
    updatedAt: Date.now(),
    boards,
    leaderboard,
    mode,
    restingLabel:
      state.tournamentStarted && lastRound?.sittingOut ? lastRound.sittingOut.name : null
  };
};
