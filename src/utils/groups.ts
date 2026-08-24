import { TournamentSettings } from '../types';

/**
 * Named Groups: a persistent, uniquely-named set of players and their
 * historical ELO ratings (e.g. "Pawri"), so recurring meetups don't require
 * re-adding players or losing rating history between tournaments.
 *
 * Storage is independent of the tournament-state version — groups survive
 * version migrations by design.
 */

const GROUPS_KEY = 'padel-indiano-groups';

export interface GroupPlayer {
  name: string;
  eloRating: number;
  avatar?: string;
}

export interface Group {
  /** Canonical display name (first casing it was saved with) */
  name: string;
  /** Lowercased unique key */
  key: string;
  players: GroupPlayer[];
  settings?: TournamentSettings;
  createdAt: number;
  updatedAt: number;
}

export type SaveGroupResult =
  | { ok: true; group: Group }
  | { ok: false; error: 'invalid-name' | 'name-taken' };

/** One-word names: letters/digits/underscore/hyphen, no spaces, ≤24 chars. */
export const isValidGroupName = (raw: string): boolean =>
  /^[A-Za-z0-9_-]{1,24}$/.test(raw.trim());

/** Names are case-insensitively unique: "Pawri" and "pawri" are the same group. */
export const normalizeGroupName = (raw: string): string => raw.trim().toLowerCase();

export const loadGroups = (): Record<string, Group> => {
  try {
    const serialized = localStorage.getItem(GROUPS_KEY);
    if (serialized === null) return {};
    return JSON.parse(serialized);
  } catch (error) {
    console.error('Failed to load groups:', error);
    return {};
  }
};

const persistGroups = (groups: Record<string, Group>): void => {
  try {
    localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
  } catch (error) {
    console.error('Failed to save groups:', error);
  }
};

export const findGroup = (rawName: string): Group | null => {
  const key = normalizeGroupName(rawName);
  return loadGroups()[key] ?? null;
};

/**
 * Create or update a group. Saving under an existing *different* group's name
 * is rejected — one-word names must be unique. Saving under your own current
 * group name overwrites (that's the "Save mid-tournament" path).
 */
export const saveGroup = (
  rawName: string,
  players: GroupPlayer[],
  settings?: TournamentSettings,
  currentSessionGroup?: string
): SaveGroupResult => {
  const trimmed = rawName.trim();
  if (!isValidGroupName(trimmed)) {
    return { ok: false, error: 'invalid-name' };
  }

  const key = normalizeGroupName(trimmed);
  const groups = loadGroups();
  const existing = groups[key];

  // Uniqueness: reject taking a name owned by a different group
  if (existing && normalizeGroupName(currentSessionGroup ?? '') !== key) {
    return { ok: false, error: 'name-taken' };
  }

  const group: Group = {
    name: existing?.name ?? trimmed,
    key,
    players,
    settings,
    createdAt: existing?.createdAt ?? Date.now(),
    updatedAt: Date.now()
  };

  groups[key] = group;
  persistGroups(groups);
  return { ok: true, group };
};

export const deleteGroup = (rawName: string): void => {
  const key = normalizeGroupName(rawName);
  const groups = loadGroups();
  delete groups[key];
  persistGroups(groups);
};

/**
 * Encode a group into a URL-safe string so it can travel between devices via
 * a share link (the app has no backend — localStorage is per-device).
 */
export const encodeGroup = (group: Group): string => {
  const payload = JSON.stringify({ n: group.name, p: group.players, s: group.settings });
  const bytes = new TextEncoder().encode(payload);
  let binary = '';
  bytes.forEach(b => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

/** Decode a share code back into a group. Returns null if invalid/corrupted. */
export const decodeGroup = (code: string): Group | null => {
  try {
    let b64 = code.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4 !== 0) b64 += '=';
    const binary = atob(b64);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    const raw = JSON.parse(new TextDecoder().decode(bytes)) as {
      n?: unknown; p?: unknown; s?: unknown;
    };

    if (typeof raw.n !== 'string' || !isValidGroupName(raw.n) || !Array.isArray(raw.p)) {
      return null;
    }

    const players = (raw.p as Array<Record<string, unknown>>)
      .map(p => ({
        name: String(p.name ?? ''),
        eloRating: typeof p.eloRating === 'number' ? p.eloRating : 1500,
        avatar: typeof p.avatar === 'string' ? p.avatar : undefined
      }))
      .filter(p => p.name.length > 0);

    if (players.length === 0) return null;

    const name = raw.n;
    return {
      name,
      key: normalizeGroupName(name),
      players,
      settings: (typeof raw.s === 'object' && raw.s !== null ? raw.s : undefined) as Group['settings'],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  } catch {
    return null;
  }
};
