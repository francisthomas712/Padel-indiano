# Padel Indiano — entitlement ledger (Hetzner)

Tracks the 72h free trial and $0.99 day passes for the iOS app.
RevenueCat is the source of purchases; this service is the source of truth
for "does this device have access". State: one JSON file on a volume.

## Run (Docker, same pattern as OtterCycle)

```bash
docker build -t padel-entitlement ./server
docker run -d --name padel-entitlement \
  -p 3010:3010 \
  -v padel-ledger:/data \
  -e RC_WEBHOOK_AUTH=<random-secret> \
  -e PASS_PRODUCT_ID=day_pass_099 \
  padel-entitlement
# put Caddy/nginx TLS in front, like pcn-cycling
curl localhost:3010/health
```

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/access?rc=<appUserID>` | none | Registers device (starts 72h trial on first call) + returns access verdict |
| POST | `/webhook/revenuecat` | `Authorization: Bearer <RC_WEBHOOK_AUTH>` | Records day-pass purchases (idempotent per Apple transaction id), removes on refund |
| GET | `/health` | none | Uptime check |

## RevenueCat setup (dashboard)

1. New app (iOS), product: **non-renewing subscription** `day_pass_099`, $0.99, 1 day.
2. Webhooks → URL `https://<your-host>/webhook/revenuecat`, authorization header
   `Bearer <same secret as RC_WEBHOOK_AUTH>`.
3. The webhook sends `event.type` ∈ `NON_RENEWING_PURCHASE` (purchase),
   `EXPIRATION`/`REFUND` (revoke), with `app_user_id`, `transaction_id`,
   `expiration_at_ms`.

## Environment

| Var | Default | Notes |
|---|---|---|
| `PORT` | 3010 | |
| `LEDGER_FILE` | `/data/ledger.json` | mount a volume here |
| `RC_WEBHOOK_AUTH` | *(unset)* | required for webhooks; unset → webhook returns 503 |
| `PASS_PRODUCT_ID` | `day_pass_099` | other products are acked and ignored |

## Design notes

- **No login**: devices are identified by RevenueCat's anonymous `appUserID`.
  Reinstalling the app creates a new anonymous ID → trial resets. Accepted.
- **Offline grace is client-side**: the app caches the last `/access` verdict
  and allows the current session to finish if the network is unavailable.
- **Pass stacking**: buying a pass before the current one ends extends from
  the later of (Apple expiration, latest pass end, purchase time).
- **Idempotency**: Apple/RC deliver webhooks at-least-once; duplicate
  `transaction_id`s are acknowledged with `duplicate: true`, no double-grant.
- **Refunds**: `REFUND` events drop the pass; access re-evaluates on next poll.
