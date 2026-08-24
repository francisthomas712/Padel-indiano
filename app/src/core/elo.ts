/**
 * ELO Rating System Utilities
 *
 * This module provides functions for calculating and updating ELO ratings,
 * as well as calculating point multipliers based on opponent strength.
 */

export const INITIAL_ELO = 1500;
export const K_FACTOR = 32;

/** Higher K for a player's first few matches so starting ratings self-correct quickly. */
export const PROVISIONAL_K = 48;
export const PROVISIONAL_MATCHES = 3;

/**
 * How much of the strength-based multiplier survives on a LOSS.
 * 0.5 means a tough loss against stronger opponents keeps half its bonus,
 * so losing can never out-earn an equivalent win.
 */
export const LOSER_MULTIPLIER_WEIGHT = 0.5;

/**
 * Calculate the expected score for a player/pair based on ELO ratings
 * Uses the standard ELO formula: E_A = 1 / (1 + 10^((R_B - R_A) / 400))
 *
 * @param ratingA - ELO rating of player/pair A
 * @param ratingB - ELO rating of player/pair B
 * @returns Expected score (0 to 1) for player/pair A
 */
export const calculateExpectedScore = (ratingA: number, ratingB: number): number => {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
};

/**
 * Calculate new ELO rating after a match
 * Uses the standard ELO update formula: R_new = R_old + K * (Actual - Expected)
 *
 * @param currentRating - Current ELO rating
 * @param expectedScore - Expected score (0 to 1) from calculateExpectedScore
 * @param actualScore - Actual result (1 for win, 0 for loss)
 * @param kFactor - K-factor controlling rating volatility (default: 32)
 * @returns New ELO rating (rounded to nearest integer)
 */
export const calculateNewRating = (
  currentRating: number,
  expectedScore: number,
  actualScore: number,
  kFactor: number = K_FACTOR
): number => {
  return Math.round(currentRating + kFactor * (actualScore - expectedScore));
};

/**
 * Calculate average ELO rating for a pair of players
 *
 * @param player1Rating - ELO rating of first player
 * @param player2Rating - ELO rating of second player
 * @returns Average ELO rating of the pair
 */
export const calculatePairRating = (player1Rating: number, player2Rating: number): number => {
  return (player1Rating + player2Rating) / 2;
};

/**
 * Calculate point multiplier based on ELO difference between pairs and match result
 *
 * This creates a weighted point system where:
 * - Facing stronger opponents (higher ELO) = bonus points (multiplier > 1.0)
 * - Facing equal opponents = normal points (multiplier = 1.0)
 * - Facing weaker opponents (lower ELO) = reduced points (multiplier < 1.0)
 *
 * The result-aware damping matters: the raw strength multiplier applies in full to
 * winners, but losers only keep LOSER_MULTIPLIER_WEIGHT of their deviation from 1.0.
 * Without this, a close loss to a much stronger pair could out-earn a dominant win
 * against a weaker pair, letting schedule luck decide rankings.
 *
 * Examples (±200 ELO gap):
 * - Win vs +200 stronger → 1.35x
 * - Lose vs +200 stronger → ~1.175x (half of the 0.35 deviation kept)
 * - Win vs -200 weaker → 0.65x
 * - Lose vs -200 weaker → ~0.825x (losing to weak opponents is softened)
 *
 * @param playerPairElo - Average ELO of your pair
 * @param opponentPairElo - Average ELO of opponent pair
 * @param won - Whether your pair won the match
 * @returns Point multiplier around 1.0 (roughly clamped 0.75–1.5)
 */
export const calculatePointMultiplier = (
  playerPairElo: number,
  opponentPairElo: number,
  won: boolean
): number => {
  const eloDifference = opponentPairElo - playerPairElo;

  // Scale: ELO difference divided by 400, multiplied by 0.7
  // This gives a reasonable spread: ±300 ELO → ±0.525 multiplier change
  const rawMultiplier = 1.0 + (eloDifference / 400) * 0.7;

  // Result-aware damping: winners get the full effect, losers half of it
  const weight = won ? 1 : LOSER_MULTIPLIER_WEIGHT;
  const multiplier = 1.0 + (rawMultiplier - 1.0) * weight;

  // Clamp between 0.5x and 1.5x to prevent extreme values
  return Math.max(0.5, Math.min(1.5, multiplier));
};

/**
 * Calculate weighted points for a match based on opponent strength and result
 *
 * @param basePoints - Raw points scored in the match
 * @param playerPairElo - Average ELO of your pair
 * @param opponentPairElo - Average ELO of opponent pair
 * @param won - Whether your pair won the match
 * @returns Weighted points (basePoints × multiplier) — round at the callsite
 */
export const calculateWeightedPoints = (
  basePoints: number,
  playerPairElo: number,
  opponentPairElo: number,
  won: boolean
): number => {
  const multiplier = calculatePointMultiplier(playerPairElo, opponentPairElo, won);
  return basePoints * multiplier;
};

/**
 * Update ELO ratings for all 4 players after a match.
 *
 * Two refinements over plain win/loss ELO:
 * 1. Margin-aware: the "actual score" is the point share (score1 / total points),
 *    so a 7-6 squeaker barely moves ratings while a 7-0 blowout moves them a lot.
 * 2. Provisional K: players in their first PROVISIONAL_MATCHES games move faster,
 *    letting custom starting ELOs self-correct quickly.
 *
 * @param pair1Player1 - First player of pair 1 (id, rating, matchesPlayed)
 * @param pair1Player2 - Second player of pair 1
 * @param pair2Player1 - First player of pair 2
 * @param pair2Player2 - Second player of pair 2
 * @param score1 - Final raw score for pair 1
 * @param score2 - Final raw score for pair 2
 * @returns Object mapping player IDs to their new ELO ratings
 */
export const updateMatchElo = (
  pair1Player1: { id: string; rating: number; matchesPlayed?: number },
  pair1Player2: { id: string; rating: number; matchesPlayed?: number },
  pair2Player1: { id: string; rating: number; matchesPlayed?: number },
  pair2Player2: { id: string; rating: number; matchesPlayed?: number },
  score1: number,
  score2: number
): Record<string, number> => {
  // Calculate pair average ratings
  const pair1Rating = calculatePairRating(pair1Player1.rating, pair1Player2.rating);
  const pair2Rating = calculatePairRating(pair2Player1.rating, pair2Player2.rating);

  // Calculate expected scores
  const pair1Expected = calculateExpectedScore(pair1Rating, pair2Rating);
  const pair2Expected = 1 - pair1Expected;

  // Margin-aware actual score: share of points won. Falls back to binary
  // win/loss if no points were scored (0-0 should never be completed anyway).
  const totalPoints = score1 + score2;
  const pair1Actual = totalPoints > 0 ? score1 / totalPoints : score1 > score2 ? 1 : 0;
  const pair2Actual = 1 - pair1Actual;

  // Per-player K factor: provisional players move faster
  const kFor = (matchesPlayed?: number): number =>
    (matchesPlayed ?? PROVISIONAL_MATCHES) < PROVISIONAL_MATCHES ? PROVISIONAL_K : K_FACTOR;

  const pair1Adjustment1 = kFor(pair1Player1.matchesPlayed) * (pair1Actual - pair1Expected);
  const pair1Adjustment2 = kFor(pair1Player2.matchesPlayed) * (pair1Actual - pair1Expected);
  const pair2Adjustment1 = kFor(pair2Player1.matchesPlayed) * (pair2Actual - pair2Expected);
  const pair2Adjustment2 = kFor(pair2Player2.matchesPlayed) * (pair2Actual - pair2Expected);

  // Return new ratings for all players
  return {
    [pair1Player1.id]: Math.round(pair1Player1.rating + pair1Adjustment1),
    [pair1Player2.id]: Math.round(pair1Player2.rating + pair1Adjustment2),
    [pair2Player1.id]: Math.round(pair2Player1.rating + pair2Adjustment1),
    [pair2Player2.id]: Math.round(pair2Player2.rating + pair2Adjustment2),
  };
};
