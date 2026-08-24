# Padel Indiano iOS App — build & launch runbook

Native iOS app (Expo) + Hetzner entitlement server. The web app (this repo's
`src/`, deployed on Netlify) remains the free spectator surface; the iOS app
is the paid organizer console.

## Architecture

```
app/       Expo iOS app (organizer console, $0.99/day after 3 free days)
  src/core/      shared pure-TS core, copied from ../src/utils (verbatim)
  src/services/  storage (MMKV localStorage shim), entitlement, api (live sync)
  App.tsx        single-file UI: welcome/groups, roster, rounds, CourtMode, Paywall
server/    Hetzner entitlement ledger (Express, JSON-file store)
  GET  /access?rc=<appUserID>   → trial/pass verdict (registers device on first call)
  POST /webhook/revenuecat      → records day-pass purchases (idempotent)
src/ + netlify/functions   unchanged web app + live-state sync (spectators)
```

**Identity = group code** ("Pawri"), no login. **Payments = RevenueCat
non-renewing subscription** (`day_pass_099`, $0.99 / 24h). **Trial = 72h from
first launch**, tracked server-side by anonymous RevenueCat `appUserID`
(reinstall resets it — accepted).

## One-time setup checklist

1. **EAS**: `cd app && npx eas init` → put the projectId in `app/app.json`
   (`extra.eas.projectId`) and replace `SET-AT-FIRST-EAS-BUILD`.
2. **RevenueCat**: new project + iOS app (bundle `sg.lothaltech.padelindiano`).
   Product: non-renewing subscription `day_pass_099`, $0.99, 1 day.
   Copy the **public** iOS SDK key.
3. **Hetzner**: deploy `server/` (see `server/README.md`), set
   `RC_WEBHOOK_AUTH`, point RevenueCat webhooks at
   `https://<host>/webhook/revenuecat` with that secret.
4. **Secrets into EAS** (never commit real keys):
   ```bash
   cd app
   npx eas secret:create --name EXPO_PUBLIC_REVENUECAT_IOS_KEY --value appl_...
   npx eas secret:create --name EXPO_PUBLIC_ENTITLEMENT_SERVER --value https://<hetzner-host>
   ```
   (or fill the `env` blocks in `app/eas.json` profiles)
5. **Build**: `npx eas build -p ios --profile production`
6. **App Store Connect**: new app record, IAP product `day_pass_099`
   (non-consumable? NO — non-renewing subscription), screenshot, privacy
   policy (reuse OtterCycle template, rebrand), review notes explaining:
   "Tournament scoreboard. 3-day free trial then $0.99 per 24h day pass via
   non-renewing subscription. No account required."

## Invariants

- `app/src/core/` is **copied** from `../src/utils` + `../src/types`. Don't
  hand-edit both copies — change the web one, re-copy, fix the `./types`
  imports (sed one-liner in git history).
- Bundle id `sg.lothaltech.padelindiano` is frozen once RevenueCat is wired.
- The entitlement server is the ONLY place trials are tracked. Never trust a
  client-side "trial used" flag for enforcement decisions.
- Web app stays free and is the spectator surface — don't gate it.

## Local development

```bash
cd server && npm i && npm test          # ledger unit tests
cd server && npm run dev                # :3010
cd app && npm i && npx expo start       # Expo Go (purchases disabled, trial flows via dev- ids)
cd app && npx tsc --noEmit              # typecheck
```
