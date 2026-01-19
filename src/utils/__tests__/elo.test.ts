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
    it('should return 1.0 for equal ELO pairs', () => {
      const multiplier = calculatePointMultiplier(1500, 1500);
      expect(multiplier).toBeCloseTo(1.0, 2);
    });

    it('should return > 1.0 when opponent is stronger', () => {
      const multiplier = calculatePointMultiplier(1400, 1600);
      expect(multiplier).toBeGreaterThan(1.0);
      expect(multiplier).toBeCloseTo(1.35, 2);
    });

    it('should return < 1.0 when opponent is weaker', () => {
      const multiplier = calculatePointMultiplier(1600, 1400);
      expect(multiplier).toBeLessThan(1.0);
      expect(multiplier).toBeCloseTo(0.65, 2);
    });

    it('should clamp minimum at 0.5', () => {
      const multiplier = calculatePointMultiplier(2000, 1000);
      expect(multiplier).toBeGreaterThanOrEqual(0.5);
    });

    it('should clamp maximum at 1.5', () => {
      const multiplier = calculatePointMultiplier(1000, 2000);
      expect(multiplier).toBeLessThanOrEqual(1.5);
    });
  });

  describe('calculateWeightedPoints', () => {
    it('should apply multiplier to base points', () => {
      const weighted = calculateWeightedPoints(7, 1500, 1500);
      expect(weighted).toBeCloseTo(7.0, 1); // 7 * 1.0 = 7.0
    });

    it('should give bonus points when beating stronger opponent', () => {
      const weighted = calculateWeightedPoints(7, 1400, 1600);
      expect(weighted).toBeGreaterThan(7);
      expect(weighted).toBeCloseTo(9.45, 1); // 7 * 1.35 ≈ 9.45
    });

    it('should give reduced points when beating weaker opponent', () => {
      const weighted = calculateWeightedPoints(7, 1600, 1400);
      expect(weighted).toBeLessThan(7);
      expect(weighted).toBeCloseTo(4.55, 1); // 7 * 0.65 ≈ 4.55
    });

    it('should handle zero points', () => {
      const weighted = calculateWeightedPoints(0, 1500, 1600);
      expect(weighted).toBe(0);
    });
  });

  describe('updateMatchElo', () => {
    it('should update all four players ELO ratings when pair 1 wins', () => {
      const result = updateMatchElo(
        { id: 'p1', rating: 1500 },
        { id: 'p2', rating: 1500 },
        { id: 'p3', rating: 1500 },
        { id: 'p4', rating: 1500 },
        true
      );

      expect(result.p1).toBeGreaterThan(1500);
      expect(result.p2).toBeGreaterThan(1500);
      expect(result.p3).toBeLessThan(1500);
      expect(result.p4).toBeLessThan(1500);

      // Both players in same pair get same rating
      expect(result.p1).toBe(result.p2);
      expect(result.p3).toBe(result.p4);
    });

    it('should update all four players ELO ratings when pair 2 wins', () => {
      const result = updateMatchElo(
        { id: 'p1', rating: 1500 },
        { id: 'p2', rating: 1500 },
        { id: 'p3', rating: 1500 },
        { id: 'p4', rating: 1500 },
        false
      );

      expect(result.p1).toBeLessThan(1500);
      expect(result.p2).toBeLessThan(1500);
      expect(result.p3).toBeGreaterThan(1500);
      expect(result.p4).toBeGreaterThan(1500);

      expect(result.p1).toBe(result.p2);
      expect(result.p3).toBe(result.p4);
    });

    it('should give bigger rating boost when underdog wins', () => {
      const result = updateMatchElo(
        { id: 'p1', rating: 1400 },
        { id: 'p2', rating: 1400 },
        { id: 'p3', rating: 1600 },
        { id: 'p4', rating: 1600 },
        true // Underdog pair 1 wins
      );

      const pair1Gain = result.p1 - 1400;
      const pair2Loss = 1600 - result.p3;

      // Underdog gains more than K_FACTOR / 2 when winning
      // ELO is zero-sum, so gains equal losses
      expect(pair1Gain).toBeGreaterThan(16); // More than K_FACTOR / 2
      expect(pair2Loss).toBeGreaterThan(16); // Also more than K_FACTOR / 2
      expect(pair1Gain).toBeCloseTo(pair2Loss, 0); // Approximately equal (zero-sum)
    });

    it('should conserve total ELO points', () => {
      const result = updateMatchElo(
        { id: 'p1', rating: 1520 },
        { id: 'p2', rating: 1480 },
        { id: 'p3', rating: 1550 },
        { id: 'p4', rating: 1450 },
        true
      );

      const oldTotal = 1520 + 1480 + 1550 + 1450;
      const newTotal = result.p1 + result.p2 + result.p3 + result.p4;

      // Total ELO should be conserved (within rounding error)
      expect(newTotal).toBeCloseTo(oldTotal, 0);
    });

    it('should return integer ratings', () => {
      const result = updateMatchElo(
        { id: 'p1', rating: 1500 },
        { id: 'p2', rating: 1500 },
        { id: 'p3', rating: 1500 },
        { id: 'p4', rating: 1500 },
        true
      );

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
