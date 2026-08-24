import { describe, it, expect } from 'vitest';
import {
  INITIAL_ELO,
  K_FACTOR,
  calculateExpectedScore,
  calculateNewRating,
  calculatePairRating,
  calculatePointMultiplier,
  calculateWeightedPoints,
  updateMatchElo
} from '../elo';

describe('ELO Utilities', () => {
  describe('calculateExpectedScore', () => {
    it('should return 0.5 for equal ratings', () => {
      const expected = calculateExpectedScore(1500, 1500);
      expect(expected).toBeCloseTo(0.5, 2);
    });

    it('should return > 0.5 when player A has higher rating', () => {
      const expected = calculateExpectedScore(1600, 1500);
      expect(expected).toBeGreaterThan(0.5);
      expect(expected).toBeCloseTo(0.64, 2);
    });

    it('should return < 0.5 when player A has lower rating', () => {
      const expected = calculateExpectedScore(1400, 1500);
      expect(expected).toBeLessThan(0.5);
      expect(expected).toBeCloseTo(0.36, 2);
    });

    it('should handle large rating differences', () => {
      const expected = calculateExpectedScore(1800, 1200);
      expect(expected).toBeCloseTo(0.97, 2);
    });
  });

  describe('calculateNewRating', () => {
    it('should increase rating when winning as expected', () => {
      const newRating = calculateNewRating(1500, 0.5, 1);
      expect(newRating).toBe(1516); // 1500 + 32 * (1 - 0.5) = 1516
    });

    it('should decrease rating when losing as expected', () => {
      const newRating = calculateNewRating(1500, 0.5, 0);
      expect(newRating).toBe(1484); // 1500 + 32 * (0 - 0.5) = 1484
    });

    it('should increase rating more when beating higher-rated opponent', () => {
      const newRating = calculateNewRating(1400, 0.36, 1);
      expect(newRating).toBe(1420); // 1400 + 32 * (1 - 0.36) ≈ 1420
    });

    it('should decrease rating less when losing to higher-rated opponent', () => {
      const newRating = calculateNewRating(1400, 0.36, 0);
      expect(newRating).toBe(1388); // 1400 + 32 * (0 - 0.36) ≈ 1388
    });

    it('should round to nearest integer', () => {
      const newRating = calculateNewRating(1500, 0.45, 1);
      expect(Number.isInteger(newRating)).toBe(true);
    });
  });

  describe('calculatePairRating', () => {
    it('should return average of two ratings', () => {
      const pairRating = calculatePairRating(1600, 1400);
      expect(pairRating).toBe(1500);
    });

    it('should handle equal ratings', () => {
      const pairRating = calculatePairRating(1500, 1500);
      expect(pairRating).toBe(1500);
    });

    it('should handle decimal results', () => {
      const pairRating = calculatePairRating(1601, 1400);
      expect(pairRating).toBe(1500.5);
    });
  });

  describe('calculatePointMultiplier', () => {
    it('should return 1.0 for equal ELO pairs regardless of result', () => {
      expect(calculatePointMultiplier(1500, 1500, true)).toBeCloseTo(1.0, 2);
      expect(calculatePointMultiplier(1500, 1500, false)).toBeCloseTo(1.0, 2);
    });

    it('should return > 1.0 when winning against stronger opponents', () => {
      const multiplier = calculatePointMultiplier(1400, 1600, true);
      expect(multiplier).toBeGreaterThan(1.0);
      expect(multiplier).toBeCloseTo(1.35, 2);
    });

    it('should return < 1.0 when winning against weaker opponents', () => {
      const multiplier = calculatePointMultiplier(1600, 1400, true);
      expect(multiplier).toBeLessThan(1.0);
      expect(multiplier).toBeCloseTo(0.65, 2);
    });

    it('should dampen the multiplier on losses so losing never out-earns winning', () => {
      // Losing to a stronger pair keeps only half the bonus
      const loseUp = calculatePointMultiplier(1400, 1600, false);
      expect(loseUp).toBeGreaterThan(1.0);
      expect(loseUp).toBeCloseTo(1 + (1.35 - 1) * 0.5, 5);

      // Losing to a weaker pair is softened (penalty halved)
      const loseDown = calculatePointMultiplier(1600, 1400, false);
      expect(loseDown).toBeLessThan(1.0);
      expect(loseDown).toBeCloseTo(1 - (1 - 0.65) * 0.5, 5);

      // Core invariant: identical performance against identical opponents
      // always earns more with a win than with a loss
      expect(calculatePointMultiplier(1400, 1600, true) * 7)
        .toBeGreaterThan(calculatePointMultiplier(1400, 1600, false) * 7);
    });

    it('should clamp minimum at 0.5', () => {
      expect(calculatePointMultiplier(2000, 1000, false)).toBeGreaterThanOrEqual(0.5);
    });

    it('should clamp maximum at 1.5', () => {
      expect(calculatePointMultiplier(1000, 2000, true)).toBeLessThanOrEqual(1.5);
    });
  });

  describe('calculateWeightedPoints', () => {
    it('should apply multiplier to base points', () => {
      expect(calculateWeightedPoints(7, 1500, 1500, true)).toBeCloseTo(7.0, 1); // 7 * 1.0 = 7.0
    });

    it('should give bonus points when beating stronger opponent', () => {
      const weighted = calculateWeightedPoints(7, 1400, 1600, true);
      expect(weighted).toBeGreaterThan(7);
      expect(weighted).toBeCloseTo(9.45, 1); // 7 * 1.35 ≈ 9.45
    });

    it('should give reduced points when beating weaker opponent', () => {
      const weighted = calculateWeightedPoints(7, 1600, 1400, true);
      expect(weighted).toBeLessThan(7);
      expect(weighted).toBeCloseTo(4.55, 1); // 7 * 0.65 ≈ 4.55
    });

    it('should ensure identical performances rank win-first (result-aware damping)', () => {
      // Same opponents, same score: winning must out-earn losing
      const winPts = calculateWeightedPoints(7, 1400, 1600, true);
      const losePts = calculateWeightedPoints(7, 1400, 1600, false);
      expect(winPts).toBeGreaterThan(losePts); // 9.45 vs ~8.23
      // And the tough-loss bonus is halved vs the old unconditional weighting
      expect(losePts).toBeLessThan(7 * 1.35); // no longer full strength bonus
    });

    it('should handle zero points', () => {
      expect(calculateWeightedPoints(0, 1500, 1600, true)).toBe(0);
    });
  });

  describe('updateMatchElo', () => {
    const mkPlayers = (
      rating = 1500,
      matchesPlayed = 10
    ): { id: string; rating: number; matchesPlayed: number }[] =>
      ['p1', 'p2', 'p3', 'p4'].map(id => ({ id, rating, matchesPlayed }));

    it('should raise winners and lower losers when pair 1 wins', () => {
      const [a, b, c, d] = mkPlayers();
      const result = updateMatchElo(a, b, c, d, 7, 3);

      expect(result.p1).toBeGreaterThan(1500);
      expect(result.p2).toBeGreaterThan(1500);
      expect(result.p3).toBeLessThan(1500);
      expect(result.p4).toBeLessThan(1500);
    });

    it('should update all four players ELO ratings when pair 2 wins', () => {
      const [a, b, c, d] = mkPlayers();
      const result = updateMatchElo(a, b, c, d, 3, 7);

      expect(result.p1).toBeLessThan(1500);
      expect(result.p2).toBeLessThan(1500);
      expect(result.p3).toBeGreaterThan(1500);
      expect(result.p4).toBeGreaterThan(1500);
    });

    it('should be margin-aware: a blowout moves ratings more than a squeaker', () => {
      // Same upset (1400 pair beats 1600 pair), different margins
      const [a, b, c, d] = mkPlayers(1500);
      const closeWin = updateMatchElo(a, b, c, d, 7, 6);
      const blowout = updateMatchElo({ ...a }, { ...b }, { ...c }, { ...d }, 7, 0);

      const closeGain = closeWin.p1 - 1500;
      const blowoutGain = blowout.p1 - 1500;

      expect(closeGain).toBeGreaterThan(0);       // winner still gains
      expect(blowoutGain).toBeGreaterThan(closeGain * 2); // margin matters a lot
    });

    it('should give bigger rating boost when underdog wins', () => {
      const result = updateMatchElo(
        { id: 'p1', rating: 1400, matchesPlayed: 10 },
        { id: 'p2', rating: 1400, matchesPlayed: 10 },
        { id: 'p3', rating: 1600, matchesPlayed: 10 },
        { id: 'p4', rating: 1600, matchesPlayed: 10 },
        7,
        0
      );

      const pair1Gain = result.p1 - 1400;
      const pair2Loss = 1600 - result.p3;

      // Underdog winning by a blowout gains more than K/2
      expect(pair1Gain).toBeGreaterThan(16); // More than K_FACTOR / 2
      expect(pair2Loss).toBeGreaterThan(16); // Also more than K_FACTOR / 2
    });

    it('should use a higher K factor for provisional players so they converge fast', () => {
      const veteranResult = updateMatchElo(
        { id: 'v1', rating: 1500, matchesPlayed: 10 },
        { id: 'v2', rating: 1500, matchesPlayed: 10 },
        { id: 'v3', rating: 1500, matchesPlayed: 10 },
        { id: 'v4', rating: 1500, matchesPlayed: 10 },
        7, 0
      );
      const rookieResult = updateMatchElo(
        { id: 'r1', rating: 1500, matchesPlayed: 0 },
        { id: 'r2', rating: 1500, matchesPlayed: 0 },
        { id: 'r3', rating: 1500, matchesPlayed: 10 },
        { id: 'r4', rating: 1500, matchesPlayed: 10 },
        7, 0
      );

      const vetGain = Math.abs(veteranResult.v1 - 1500);
      const rookieGain = Math.abs(rookieResult.r1 - 1500);
      expect(rookieGain).toBeGreaterThan(vetGain); // PROVISIONAL_K > K_FACTOR
    });

    it('should conserve total ELO points', () => {
      const result = updateMatchElo(
        { id: 'p1', rating: 1520, matchesPlayed: 10 },
        { id: 'p2', rating: 1480, matchesPlayed: 10 },
        { id: 'p3', rating: 1550, matchesPlayed: 10 },
        { id: 'p4', rating: 1450, matchesPlayed: 10 },
        7, 4
      );

      const oldTotal = 1520 + 1480 + 1550 + 1450;
      const newTotal = result.p1 + result.p2 + result.p3 + result.p4;

      // Total ELO should be conserved (within rounding error)
      expect(newTotal).toBeCloseTo(oldTotal, 0);
    });

    it('should return integer ratings', () => {
      const [a, b, c, d] = mkPlayers();
      const result = updateMatchElo(a, b, c, d, 7, 2);

      expect(Number.isInteger(result.p1)).toBe(true);
      expect(Number.isInteger(result.p2)).toBe(true);
      expect(Number.isInteger(result.p3)).toBe(true);
      expect(Number.isInteger(result.p4)).toBe(true);
    });
  });

  describe('Constants', () => {
    it('should have correct initial ELO', () => {
      expect(INITIAL_ELO).toBe(1500);
    });

    it('should have correct K-factor', () => {
      expect(K_FACTOR).toBe(32);
    });
  });
});
