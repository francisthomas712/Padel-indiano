# Padel Indiano Scoring Guide

## Overview

The Padel Indiano tournament uses a simple, point-based scoring system with service rotation.

## Match Scoring

### Points to Win
- **Default**: First team to **7 points** wins
- **Configurable**: Can be changed in Settings (range: 3-21 points)
- **No advantage**: First to reach the target wins (e.g., 7-6 is a valid final score)
- **Optional variants** (must be enabled before the tournament starts):
  - **Win by 2**: at the target score a team must lead by 2 (e.g., 8-6 instead of 7-6)
  - **Golden point**: with Win by 2 on, once *both* teams are at/above the target,
    the next point wins — no marathon games

### How Matches Work

1. **Starting a Match**
   - Both teams start at 0-0
   - Service starts with Pair 1, Player 1

2. **Scoring Points**
   - Use the +/- buttons to adjust scores
   - Each point won increases the team's score by 1

3. **Winning a Match**
   - First team to reach the "Points to Win" target wins
   - Examples (with default 7 points):
     - 7-0, 7-1, 7-2, 7-3, 7-4, 7-5, 7-6 are all valid winning scores
     - Maximum points played in a match: 13 (for a 7-6 game)

## Service Rotation

Service rotates **every point** in a fixed pattern:

### Rotation Order
1. **Pair 1, Player 1** serves
2. **Pair 2, Player 1** serves
3. **Pair 1, Player 2** serves
4. **Pair 2, Player 2** serves
5. Back to **Pair 1, Player 1**

### Visual Example

```
Point 1:  Pair 1-P1 serves
Point 2:  Pair 2-P1 serves
Point 3:  Pair 1-P2 serves
Point 4:  Pair 2-P2 serves
Point 5:  Pair 1-P1 serves (cycle repeats)
```

This ensures:
- Fair distribution of serves
- Both teams serve equally
- Both players on each team get equal service opportunities

## Tournament Scoring

### Regular Rounds
- All matches use the same "Points to Win" setting
- Each player earns points equal to their team's score
- Example: If your team scores 7 points, you earn 7 points (even if you lose 7-6)

### Leaderboard Rankings
Players are ranked by:
1. **Points Per Game (PPG)** - Primary ranking method
2. Win rate percentage
3. Overall point differential (points won minus conceded)
4. Head-to-head record (if still tied)
5. Head-to-head point differential
6. Strength of schedule (quality of opponents)
7. Total matches played, then total points scored

### Weighted Points & ELO

- **Weighted points** are earned at match completion and depend on both the
  opponent's strength *and* the result: facing stronger opponents boosts your
  multiplier, but on a loss only half of that adjustment is kept
  (`LOSER_MULTIPLIER_WEIGHT = 0.5`), so a tough narrow loss can't out-earn
  winning at the same level of opposition.
- **ELO updates are margin-aware**: ratings move by point share
  (e.g., 7-6 barely moves them, 7-0 moves them a lot), and players in their
  first 3 matches use a higher K-factor so starting ratings converge quickly.
- Every third round uses **snake pairing** (strongest partners weakest) so
  strong players regularly face the whole group instead of only their tier.

### Finals
- Top 4 players compete: 1st+4th vs 2nd+3rd
- Uses the same scoring system as regular matches
- Same service rotation pattern
- Winner is crowned tournament champion

## Settings Configuration

### Changing Points to Win

1. Go to **Settings** tab before starting tournament
2. Adjust "Points to Win" field (range: 3-21)
3. Common values:
   - **5 points**: Quick games (~5-10 minutes)
   - **7 points**: Default, balanced (~10-15 minutes)
   - **11 points**: Longer games (~15-20 minutes)
   - **21 points**: Full-length games (~25-30 minutes)

**Note**: Settings cannot be changed once the tournament starts.

### Optional Win Conditions

| Setting | Effect | Example (target 7) |
|---------|--------|--------------------|
| *(default)* | First to target wins | 7-6 wins |
| **Win by 2** | Lead of 2 required at/above target | 8-6 wins, 7-6 keeps playing |
| **Win by 2 + Golden point** | Once both teams reach the target, next point wins | 7-6 → 8-7 wins |

These suit groups that dislike sudden-death finishes at 7-6 (enable Win by 2)
or that want a hard stop instead of endless deuce-style play (add Golden point).

## Match Examples

### Example 1: Close Match (7 Points to Win)
```
Score: 7-6
Points played: 13
Winner: Team with 7 points
Both players on winning team earn: 7 points
Both players on losing team earn: 6 points
```

### Example 2: Dominant Win (7 Points to Win)
```
Score: 7-2
Points played: 9
Winner: Team with 7 points
Winning team players each earn: 7 points
Losing team players each earn: 2 points
```

### Example 3: Custom Setting (11 Points to Win)
```
Score: 11-9
Points played: 20
Winner: Team with 11 points
Winning team players each earn: 11 points
Losing team players each earn: 9 points
```

## Tips for Organizers

1. **Quick Tournaments**: Set to 5 points for faster rotation
2. **Standard Play**: Keep default 7 points for balanced games
3. **Competitive**: Use 11-21 points for more decisive matches
4. **Time Management**: Lower points = more rounds possible in limited time

## Groups (Recurring Player Sets)

Hit **Save** (or Ctrl+S) during setup to store all current players *with their
current ELOs* under a unique one-word name (e.g. `Pawri`). Next tournament,
load the group from the Groups bar — no re-adding players, no losing rating
history. Names are one word (letters/digits/`-`/`_`, max 24) and globally
unique; saving again under your own group's name updates it mid-season.

Spectators get a dedicated space per group too: open
`<site-url>/#/watch/Pawri` on any device holding that saved group to see live
scores and standings fullscreen.

## Differences from Traditional Padel

This scoring system differs from traditional Padel tennis:

| Traditional Padel | Padel Indiano |
|-------------------|---------------|
| Games, sets, matches | Single game to X points |
| 15-30-40-game scoring | Simple numeric scoring |
| Deuce/advantage | No deuce - first to X wins |
| Service changes every 2 points | Service changes every point |
| Tied sets go to tiebreak | N/A - single game format |

## Why This System?

Benefits of the Indiano scoring system:
- ✅ **Simpler**: Easy to understand and track
- ✅ **Faster**: Games finish in predictable time
- ✅ **Fairer**: All players earn points based on performance
- ✅ **Flexible**: Adjustable to tournament time constraints
- ✅ **Inclusive**: Keeps all scores visible in rankings (no binary win/loss)
