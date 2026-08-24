import { describe, it, expect } from 'vitest';
import {
  createLedgerEntry,
  evaluateAccess,
  recordPass,
  TRIAL_DURATION_MS,
  PASS_DURATION_MS
} from '../ledger';

const HOUR = 60 * 60 * 1000;

describe('evaluateAccess', () => {
  it('returns never-started for unknown devices', () => {
    const state = evaluateAccess(null, Date.now());
    expect(state.hasAccess).toBe(false);
    expect(state.source).toBe('never-started');
    expect(state.trialUsed).toBe(false);
  });

  it('grants 72h trial from registration', () => {
    const start = Date.now();
    const entry = createLedgerEntry('device-1', start);
    const state = evaluateAccess(entry, start + 1);
    expect(state.hasAccess).toBe(true);
    expect(state.source).toBe('trial');
    expect(state.accessUntil).toBe(start + TRIAL_DURATION_MS);
  });

  it('expires the trial after 72h', () => {
    const start = Date.now();
    const entry = createLedgerEntry('device-1', start);
    const state = evaluateAccess(entry, start + TRIAL_DURATION_MS + HOUR);
    expect(state.hasAccess).toBe(false);
    expect(state.source).toBe('none');
    expect(state.trialUsed).toBe(true);
  });

  it('grants access via a pass after the trial has ended', () => {
    const start = Date.now();
    const entry = createLedgerEntry('device-1', start);
    // Buy a pass 70h in (trial still active, 2h left)
    const { entry: withPass } = recordPass(entry, 'tx-1', start + 70 * HOUR, start + 70 * HOUR);
    // At 73h the trial is over but the pass (ends at 94h) is still valid
    const state = evaluateAccess(withPass, start + 73 * HOUR);
    expect(state.hasAccess).toBe(true);
    expect(state.source).toBe('pass');
    expect(state.accessUntil).toBe(start + 70 * HOUR + PASS_DURATION_MS);
  });

  it('expires passes 24h after purchase once the trial is over', () => {
    const start = Date.now();
    const entry = createLedgerEntry('device-1', start - 10 * 24 * HOUR); // trial long gone
    const { entry: withPass } = recordPass(entry, 'tx-1', start, start);
    const state = evaluateAccess(withPass, start + PASS_DURATION_MS + 1000);
    expect(state.hasAccess).toBe(false);
  });

  it('prefers the pass end over the trial end when a pass is active', () => {
    const start = Date.now();
    const entry = createLedgerEntry('device-1', start);
    const { entry: withPass } = recordPass(entry, 'tx-1', start + 70 * HOUR, start + 70 * HOUR);
    const state = evaluateAccess(withPass, start + 71 * HOUR);
    expect(state.hasAccess).toBe(true);
    expect(state.source).toBe('pass');
    expect(state.accessUntil).toBe(start + 70 * HOUR + PASS_DURATION_MS);
  });
});

describe('recordPass', () => {
  it('is idempotent per transaction id', () => {
    const start = Date.now();
    let entry = createLedgerEntry('device-1', start);
    const first = recordPass(entry, 'tx-1', start, start);
    expect(first.duplicate).toBe(false);
    const second = recordPass(first.entry, 'tx-1', start, start + HOUR);
    expect(second.duplicate).toBe(true);
    expect(second.entry.passes).toHaveLength(1);
  });

  it('stacks a second pass bought before the first expires', () => {
    const start = Date.now();
    const entry = createLedgerEntry('device-1', start);
    const { entry: withFirst } = recordPass(entry, 'tx-1', start, start);
    // Second pass bought 20h in (first still has 4h left)
    const { entry: withBoth } = recordPass(withFirst, 'tx-2', start + 20 * HOUR, start + 20 * HOUR);
    expect(withBoth.passes).toHaveLength(2);
    // Expires 24h after the first pass would have ended, not after purchase
    expect(withBoth.passes[1].expiresAt).toBe(start + PASS_DURATION_MS + PASS_DURATION_MS);
  });

  it('uses the later of apple expiration and purchase time', () => {
    const start = Date.now();
    const entry = createLedgerEntry('device-1', start);
    // Apple reports an expiration 2h in the past relative to purchase
    const { entry: withPass } = recordPass(entry, 'tx-1', start - 2 * HOUR, start);
    expect(withPass.passes[0].expiresAt).toBe(start + PASS_DURATION_MS);
  });
});
