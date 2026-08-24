/**
 * Entitlement ledger logic — pure functions, no I/O, fully unit-testable.
 *
 * Model:
 *  - Every device (RevenueCat anonymous appUserID) gets ONE trial of
 *    TRIAL_DURATION_MS starting at its first /register call.
 *  - Day passes are non-renewing subscriptions: each purchase grants
 *    PASS_DURATION_MS from its purchase/expiration time, tracked by the
 *    Apple transaction_id (webhook deliveries are at-least-once, so
 *    duplicate events for the same transaction must be idempotent).
 *  - Access = now < trial end OR any pass is currently valid.
 *  - Offline grace: the client caches the last verdict; enforcement is
 *    client-side, the server is the source of truth for honesty.
 */

export const TRIAL_DURATION_MS = 3 * 24 * 60 * 60 * 1000; // 72h from first launch
export const PASS_DURATION_MS = 24 * 60 * 60 * 1000; // 24h day pass

export interface LedgerEntry {
  rcUserId: string;
  trialStartedAt: number | null;
  /** All recorded day passes, keyed by Apple transaction id */
  passes: Array<{ transactionId: string; expiresAt: number; purchasedAt: number }>;
  updatedAt: number;
}

export const createLedgerEntry = (rcUserId: string, now: number): LedgerEntry => ({
  rcUserId,
  trialStartedAt: now,
  passes: [],
  updatedAt: now
});

export interface AccessState {
  hasAccess: boolean;
  /** Epoch ms when access ends (trial or latest pass); null = never started */
  accessUntil: number | null;
  source: 'trial' | 'pass' | 'none' | 'never-started';
  trialUsed: boolean;
}

export const evaluateAccess = (entry: LedgerEntry | null, now: number): AccessState => {
  if (!entry) {
    return { hasAccess: false, accessUntil: null, source: 'never-started', trialUsed: false };
  }

  const trialEnd = entry.trialStartedAt !== null ? entry.trialStartedAt + TRIAL_DURATION_MS : 0;
  const latestPassEnd = entry.passes.reduce((max, p) => Math.max(max, p.expiresAt), 0);
  const accessUntil = Math.max(trialEnd, latestPassEnd) || null;

  if (latestPassEnd > now) {
    return { hasAccess: true, accessUntil, source: 'pass', trialUsed: entry.trialStartedAt !== null };
  }
  if (entry.trialStartedAt !== null && trialEnd > now) {
    return { hasAccess: true, accessUntil: trialEnd, source: 'trial', trialUsed: true };
  }
  return {
    hasAccess: false,
    accessUntil,
    source: entry.trialStartedAt === null ? 'never-started' : 'none',
    trialUsed: entry.trialStartedAt !== null
  };
};

/**
 * Record a day-pass purchase. Idempotent per transaction id: a repeated
 * webhook for the same transaction returns "duplicate" and changes nothing.
 * `baseExpiresAt` lets the webhook pass Apple's own expiration (non-renewing
 * subs report it); we extend from the latest existing pass so buying a second
 * pass before the first ends stacks time instead of truncating it.
 */
export const recordPass = (
  entry: LedgerEntry,
  transactionId: string,
  baseExpiresAt: number,
  purchasedAt: number
): { entry: LedgerEntry; duplicate: boolean } => {
  if (entry.passes.some(p => p.transactionId === transactionId)) {
    return { entry, duplicate: true };
  }
  const stackedBase = Math.max(baseExpiresAt, ...entry.passes.map(p => p.expiresAt), purchasedAt);
  const updated: LedgerEntry = {
    ...entry,
    passes: [
      ...entry.passes,
      { transactionId, expiresAt: stackedBase + PASS_DURATION_MS, purchasedAt }
    ],
    updatedAt: purchasedAt
  };
  return { entry: updated, duplicate: false };
};
