You are an experienced, pragmatic software engineering AI agent. Do not over-engineer a solution when a simple one is possible. Keep edits minimal. If you want an exception to ANY rule, you MUST stop and get permission first.

# AGENTS.md — Padel Indiano Tournament Manager

## Project Overview

A client-only React SPA that manages "Padel Indiano" tournaments (Mexican-style padel: one game, first team to X points wins, service rotates every point). Players are dynamically paired each round by skill, ranked by a hybrid PPG (points per game) + ELO system with weighted points, and the top 4 qualify for finals.

- **Language**: TypeScript (strict mode), 100% typed — no `.js` in `src/`.
- **Framework**: React 18 + Vite 5 (dev server on port 3000).
- **Styling**: Tailwind CSS 3 (config in `tailwind.config.js`, custom utilities in `src/styles/index.css`).
- **State**: No backend, no Redux. A single `TournamentState` object in `useTournamentState`, auto-persisted to `localStorage`.
- **Testing**: Vitest (jsdom) + Testing Library.
- **Other libs**: lucide-react (icons), react-hot-toast, jsPDF + html2canvas (export).

## Reference

- `src/types/index.ts` — all shared types (`Player`, `Match`, `Round`, `TournamentState`, `TournamentSettings`). Change types here first; they drive everything else.
- `src/App.tsx` — main component (~1750 lines): tournament flow, round generation, match completion, ELO updates, finals, all tabs.
- `src/hooks/useTournamentState.ts` — centralized state, undo/redo history (last 50 snapshots), auto-save effect.
- `src/hooks/useKeyboardShortcuts.ts`, `src/hooks/useMatchTimer.ts` — shortcuts (Q/A, P/L, Enter, Ctrl+Z/Y/S) and match timing.
- `src/utils/pairingAlgorithm.ts` — greedy pairing with weighted scoring (partnership/opposition variety, skill balance) and sit-out rotation.
- `src/utils/scoring.ts` — first-to-X win check, service rotation (`pair1-p1 → pair2-p1 → pair1-p2 → pair2-p2`).
- `src/utils/elo.ts` — ELO math (`INITIAL_ELO = 1500`, `K_FACTOR = 32`) and the weighted-points multiplier (clamped 0.5×–1.5×).
- `src/utils/tieBreaking.ts` — 7-level leaderboard tie-breaking.
- `src/utils/localStorage.ts` — persistence; keys: `padel-indiano-tournament`, `-templates`, `-history`, `-version`.
- `src/utils/groups.ts` — named Groups (unique one-word player sets + historical ELOs); key: `padel-indiano-groups`. Independent of state versioning.
- `netlify/functions/live-state.mts` + `src/utils/liveSync.ts` — cross-device spectator sync: the admin device publishes a live snapshot (scores/standings) to Netlify Blobs, spectator devices poll `GET /api/live-state?group=<name>`. All sync failures are silent; the app must stay fully usable offline.
- `src/components/` — `PlayerList`, `Leaderboard`, `MatchCard`, `Settings`, `Toast`, `PlayerAvatar`, `CourtMode` (fullscreen scoring), `SpectatorMode` (live boards + watch deep links).
- `padel-indiano.js` (repo root) — the legacy pre-refactor single-file app. Reference only; **do not edit or import it**.
- Docs: `README.md`, `SCORING_GUIDE.md` (domain rules), `DEPLOYMENT.md`, `IMPROVEMENTS.md` (refactor history).

## Essential Commands

```bash
npm install          # install dependencies (Node 18+)
npm run dev          # dev server at http://localhost:3000 (opens browser)
npm run build        # tsc && vite build → dist/  (typecheck + build)
npm run lint         # eslint, --max-warnings 0 (zero tolerance)
npx vitest run       # run tests once (npm test watches)
npm run preview      # serve the production build
```

There is no formatter configured (no Prettier). Match the surrounding style.

**Before committing, run and pass:** `npm run lint`, `npx vitest run`, and `npm run build` (build doubles as the typecheck since tsconfig has `noEmit`).

## Patterns

- **State mutations** go through `updateState(updates, historyEntry?)` from `useTournamentState`. Pass a `HistoryEntry` for any user-visible action so undo/redo works; snapshot state via the entry's `previousState`.
- **Sit-out counts are credited at round generation**, not at match completion — `generateNextRound` applies `sitOutCount + 1` when creating the round so the sitter picker never sees stale counts.
- **Finals seeding must go through `sortForFinalsSeeding()`** (same chain as the leaderboard). Don't write ad-hoc sort comparators for qualification.
- **Group names are case-insensitively unique**; enforce via `saveGroup()`'s `name-taken` result rather than custom checks.
- **Weighted points are stored, not recomputed.** At match completion, `weightedPoints1/2` are calculated from the ELO diff *at that moment* and saved on the `Match`. Everywhere else, read them with the fallback `match.weightedPoints1 ?? match.score1`. Never recalculate them from current ELO ratings for display or reversal.
- **Tests** live in `src/utils/__tests__/*.test.ts` next to the util they cover (see `elo.test.ts`, `scoring.test.ts`). Vitest `globals: true` is on, but existing tests still import from `vitest` explicitly — follow that. Pure utils (scoring, elo, pairing, tieBreaking) are unit-testable by design; keep new logic in `src/utils/` so it stays testable.
- **Path alias**: `@/*` maps to `./src/*`.
- **Settings are immutable once started**: `TournamentSettings` can only change while `tournamentStarted === false`.
- **localStorage migrations**: bump `CURRENT_VERSION` in `localStorage.ts` when `TournamentState` shape changes, and *migrate* via `normalizeTournamentState` (fill new fields with defaults) — never clear user data on version mismatch; tournaments live on players' phones.

## Anti-patterns

- **Don't auto-generate rounds.** Round generation was deliberately made manual (`generateNextRound`, button-triggered). Don't reintroduce automatic generation.
- **Don't include away players** (`active === false`) in finals qualification or new-round pairing.
- **Don't round weighted points late.** Round at calculation time (see commit "Fix PPG calculation accuracy by rounding weighted points"); floating-point drift in PPG was a real bug here.
- **Don't break undo/redo** by calling `setState` directly or mutating state in place — always use `updateState`.

## Commit and Pull Request Guidelines

- Commits: short imperative subject, capitalized, no type prefix (matches history, e.g. "Add ELO-based ranking and custom round generation", "Fix match card to display stored weighted points instead of recalculated"). One logical change per commit.
- PRs: describe what changed and why, list the validation commands run (`lint`, `vitest run`, `build`), and note any `TournamentState`/localStorage shape changes (they affect saved user data).
