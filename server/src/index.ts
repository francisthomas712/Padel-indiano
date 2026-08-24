import express from 'express';
import crypto from 'node:crypto';
import { LedgerStore } from './store';
import {
  createLedgerEntry,
  evaluateAccess,
  recordPass
} from './ledger';

const PORT = Number(process.env.PORT ?? 3010);
const DATA_FILE = process.env.LEDGER_FILE ?? '/data/ledger.json';
/** Shared secret configured in RevenueCat → Webhooks; rejects forged calls. */
const WEBHOOK_AUTH = process.env.RC_WEBHOOK_AUTH ?? '';
const PRODUCT_ID = process.env.PASS_PRODUCT_ID ?? 'day_pass_099';

const app = express();
// RevenueCat signs the raw body — keep it intact for verification
app.use(express.json({
  verify: (req, _res, buf) => { (req as express.Request & { rawBody?: Buffer }).rawBody = buf; }
}));

const store = new LedgerStore(DATA_FILE);

const ok = (res: express.Response, body: unknown): void => {
  res.set('cache-control', 'no-store').json(body);
};

/**
 * GET /access?rc=<appUserID>
 * The app's single source of truth: registers the device (starting its trial
 * on first call) and returns the current access verdict.
 */
app.get('/access', (req, res) => {
  const rcUserId = String(req.query.rc ?? '').trim();
  if (!rcUserId || rcUserId.length > 128) {
    res.status(400).set('cache-control', 'no-store').json({ error: 'missing rc' });
    return;
  }

  const now = Date.now();
  let entry = store.get(rcUserId);
  if (!entry) {
    entry = createLedgerEntry(rcUserId, now);
    store.put(entry);
  }
  ok(res, evaluateAccess(entry, now));
});

/**
 * POST /webhook/revenuecat — purchase events for the day pass.
 * Verified via the shared-secret Authorization header (RC "Authorization"
 * webhook setting). Idempotent per Apple transaction id.
 */
app.post('/webhook/revenuecat', (req, res) => {
  if (!WEBHOOK_AUTH) {
    res.status(503).set('cache-control', 'no-store').json({ error: 'webhooks not configured' });
    return;
  }
  const auth = req.header('authorization') ?? '';
  const expected = `Bearer ${WEBHOOK_AUTH}`;
  const a = Buffer.from(auth);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    res.status(401).set('cache-control', 'no-store').json({ error: 'unauthorized' });
    return;
  }

  const event = req.body?.event;
  const rcUserId: string | undefined = event?.app_user_id;
  const productId: string | undefined = event?.product_id;
  const transactionId: string | undefined = event?.transaction_id;
  const expiresMs: number | undefined = event?.expiration_at_ms;

  const isPurchaseEvent =
    event?.type === 'NON_RENEWING_PURCHASE' ||
    event?.type === 'INITIAL_PURCHASE' ||
    event?.type === 'UNCANCELLATION';
  const isRefundEvent = event?.type === 'REFUND' || event?.type === 'EXPIRATION';

  if (!rcUserId) {
    res.status(400).set('cache-control', 'no-store').json({ error: 'missing app_user_id' });
    return;
  }

  const now = Date.now();
  let entry = store.get(rcUserId) ?? createLedgerEntry(rcUserId, now);

  if (isPurchaseEvent && transactionId) {
    if (productId && productId !== PRODUCT_ID) {
      // Unknown product: ack so RC stops retrying, but don't grant anything
      res.json({ ok: true, ignored: 'unknown product' });
      return;
    }
    const baseExpires =
      typeof expiresMs === 'number' && expiresMs > 0 ? expiresMs : now;
    const result = recordPass(entry, transactionId, baseExpires, now);
    entry = result.entry;
    store.put(entry);
    ok(res, { ok: true, duplicate: result.duplicate });
    return;
  }

  if (isRefundEvent && transactionId) {
    const before = entry.passes.length;
    entry = {
      ...entry,
      passes: entry.passes.filter(p => p.transactionId !== transactionId),
      updatedAt: now
    };
    store.put(entry);
    ok(res, { ok: true, removed: entry.passes.length < before });
    return;
  }

  // Other event types (renewals won't occur, test events, etc.) — ack quietly
  ok(res, { ok: true, ignored: event?.type ?? 'unknown' });
});

/** Health check for uptime monitoring / deploy verification. */
app.get('/health', (_req, res) => {
  ok(res, { ok: true, uptime: process.uptime() });
});

app.listen(PORT, () => {
  console.log(`Padel Indiano entitlement server on :${PORT}`);
});
