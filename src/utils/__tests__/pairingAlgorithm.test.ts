import { describe, it, expect } from 'vitest';
import { generateSnakePairs } from '../pairingAlgorithm';
import { Player } from '../../types';

const mkPlayer = (name: string, eloRating: number): Player => ({
  id: name.toLowerCase(),
  name,
  points: 0,
  matchesPlayed: 0,
  wins: 0,
  losses: 0,
  active: true,
  sitOutCount: 0,
  eloRating,
  initialElo: eloRating
});

describe('generateSnakePairs', () => {
  it('pairs strongest with weakest (1v8, 2v7, 3v6, 4v5)', () => {
    const players = [1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700].map((elo, i) =>
      mkPlayer(`P${i}`, elo)
    );

    const pairs = generateSnakePairs(players);

    expect(pairs).toHaveLength(4);
    const members = pairs.map(p => p.players.map(pl => pl.eloRating).sort((a, b) => a - b));
    // Each pair: one from top half + one from bottom half
    expect(members).toContainEqual([1000, 1700]);
    expect(members).toContainEqual([1100, 1600]);
    expect(members).toContainEqual([1200, 1500]);
    expect(members).toContainEqual([1300, 1400]);
    // Everyone plays exactly once
    const allIds = pairs.flatMap(p => p.players.map(pl => pl.id));
    expect(new Set(allIds).size).toBe(8);
  });

  it('produces balanced average skills across pairs', () => {
    const players = [1000, 1200, 1400, 1600].map((elo, i) => mkPlayer(`P${i}`, elo));
    const pairs = generateSnakePairs(players);
    // Snake of 4: (1600+1000), (1400+1200) — both averages are 1300
    expect(pairs[0].avgSkill).toBeCloseTo(pairs[1].avgSkill!, 5);
  });

  it('handles odd counts by leaving out the middle player', () => {
    const players = [1000, 1100, 2000].map((elo, i) => mkPlayer(`P${i}`, elo));
    const pairs = generateSnakePairs(players);
    expect(pairs).toHaveLength(1); // 3 players → 1 pair; caller handles sit-out
  });
});
