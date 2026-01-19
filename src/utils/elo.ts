/**
 * ELO Rating System Utilities
 *
 * This module provides functions for calculating and updating ELO ratings,
 * as well as calculating point multipliers based on opponent strength.
 */

export const INITIAL_ELO = 1500;
export const K_FACTOR = 32;

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
 * Calculate point multiplier based on ELO difference between pairs
 *
 * This creates a weighted point system where:
 * - Beating stronger opponents (higher ELO) = bonus points (multiplier > 1.0)
 * - Beating equal opponents = normal points (multiplier = 1.0)
 * - Beating weaker opponents (lower ELO) = reduced points (multiplier < 1.0)
 *
 * The formula scales linearly based on ELO difference:
 * - For every 100 ELO difference, multiplier changes by ~0.175
 * - Clamped between 0.5x and 1.5x to prevent extreme values
 *
 * Examples:
 * - Opponent +200 ELO stronger → 1.35x multiplier
 * - Opponent equal ELO → 1.0x multiplier
 * - Opponent -200 ELO weaker → 0.65x multiplier
 *
 * @param playerPairElo - Average ELO of your pair
 * @param opponentPairElo - Average ELO of opponent pair
 * @returns Point multiplier (0.5 to 1.5)
 */
export const calculatePointMultiplier = (
  playerPairElo: number,
  opponentPairElo: number
): number => {
  const eloDifference = opponentPairElo - playerPairElo;

  // Scale: ELO difference divided by 400, multiplied by 0.7
  // This gives a reasonable spread: ±300 ELO → ±0.525 multiplier change
  const multiplier = 1.0 + (eloDifference / 400) * 0.7;

  // Clamp between 0.5x and 1.5x to prevent extreme values
  return Math.max(0.5, Math.min(1.5, multiplier));
};

/**
 * Calculate weighted points for a match based on opponent strength
 *
 * @param basePoints - Raw points scored in the match
 * @param playerPairElo - Average ELO of your pair
 * @param opponentPairElo - Average ELO of opponent pair
 * @returns Weighted points (basePoints × multiplier)
 */
export const calculateWeightedPoints = (
  basePoints: number,
  playerPairElo: number,
  opponentPairElo: number
): number => {
  const multiplier = calculatePointMultiplier(playerPairElo, opponentPairElo);
  return basePoints * multiplier;
};

/**
 * Update ELO ratings for all 4 players after a match
 * Both players in a pair receive the same ELO adjustment
 *
 * @param pair1Player1 - First player of pair 1 with id and current rating
 * @param pair1Player2 - Second player of pair 1 with id and current rating
 * @param pair2Player1 - First player of pair 2 with id and current rating
 * @param pair2Player2 - Second player of pair 2 with id and current rating
 * @param pair1Won - Whether pair 1 won the match
 * @returns Object mapping player IDs to their new ELO ratings
 */
export const updateMatchElo = (
  pair1Player1: { id: string; rating: number },
  pair1Player2: { id: string; rating: number },
  pair2Player1: { id: string; rating: number },
  pair2Player2: { id: string; rating: number },
  pair1Won: boolean
): Record<string, number> => {
  // Calculate pair average ratings
  const pair1Rating = calculatePairRating(pair1Player1.rating, pair1Player2.rating);
  const pair2Rating = calculatePairRating(pair2Player1.rating, pair2Player2.rating);

  // Calculate expected scores
  const pair1Expected = calculateExpectedScore(pair1Rating, pair2Rating);
  const pair2Expected = 1 - pair1Expected;

  // Determine actual scores (1 for win, 0 for loss)
  const pair1Actual = pair1Won ? 1 : 0;
  const pair2Actual = pair1Won ? 0 : 1;

  // Calculate ELO adjustments (both players in pair get same adjustment)
  const pair1Adjustment = K_FACTOR * (pair1Actual - pair1Expected);
  const pair2Adjustment = K_FACTOR * (pair2Actual - pair2Expected);

  // Return new ratings for all players
  return {
    [pair1Player1.id]: Math.round(pair1Player1.rating + pair1Adjustment),
    [pair1Player2.id]: Math.round(pair1Player2.rating + pair1Adjustment),
    [pair2Player1.id]: Math.round(pair2Player1.rating + pair2Adjustment),
    [pair2Player2.id]: Math.round(pair2Player2.rating + pair2Adjustment),
  };
};
