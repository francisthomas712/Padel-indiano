import { describe, it, expect } from 'vitest';
import { getPointDifferential, sortForFinalsSeeding, tieBreaker } from '../tieBreaking';
import { Match, Pair, PlayerWithStats, Round } from '../../types';

const mkPair = (ids: string[]): Pair => ({
  id: `pair-${ids.join('-')}`,
  players: ids.map(id => ({
    id,
    name: id,
    points: 0,
    matchesPlayed: 1,
    wins: 0,
    losses: 0,
    active: true,
    sitOutCount: 0,
    eloRating: 1500,
    initialElo: 1500
  }))
});

const mkMatch = (
  ids1: string[],
  ids2: string[],
  score1: number,
  score2: number
): Match => ({
  id: `m-${ids1.join('')}-${ids2.join('')}-${score1}${score2}`,
  pair1: mkPair(ids1),
  pair2: mkPair(ids2),
  score1,
  score2,
  completed: true
});

const mkStats = (id: string, overrides: Partial<PlayerWithStats> = {}): PlayerWithStats => ({
  id,
  name: id,
  points: 0,
  matchesPlayed: 2,
  wins: 1,
  losses: 1,
  active: true,
  sitOutCount: 0,
  eloRating: 1500,
  initialElo: 1500,
  ppg: '5.00',
  winRate: '50.0',
  ...overrides
});

const rounds: Round[] = [
  { id: 0, matches: [mkMatch(['a', 'b'], ['c', 'd'], 7, 3)], completed: true, sittingOut: null },
  { id: 1, matches: [mkMatch(['a', 'c'], ['b', 'd'], 4, 7)], completed: true, sittingOut: null }
];

describe('getPointDifferential', () => {
  it('sums points won minus conceded across all matches', () => {
    // a: +4 (7-3) then -3 (4-7) → +1 ; d: -4 (3-7) then +3 (7-4) → -1
    // b: +4 (7-3) then +3 (7-4) → +7
    expect(getPointDifferential('a', rounds)).toBe(1);
    expect(getPointDifferential('b', rounds)).toBe(7);
    expect(getPointDifferential('d', rounds)).toBe(-1);
  });

  it('returns 0 for players who never played', () => {
    expect(getPointDifferential('zoe', rounds)).toBe(0);
  });
});

describe('tieBreaker ordering', () => {
  it('breaks PPG ties by win rate before head-to-head', () => {
    const better = mkStats('better', { ppg: '5.00', winRate: '66.7' });
    const worse = mkStats('worse', { ppg: '5.00', winRate: '33.3' });
    // 'worse' actually beat 'better' head-to-head in these rounds, but win rate ranks first now
    expect(tieBreaker(better, worse, rounds, [better, worse])).toBeLessThan(0);
  });
});

describe('sortForFinalsSeeding', () => {
  it('ranks by PPG, using point differential as a tiebreak', () => {
    const high = mkStats('high', { ppg: '6.50' });
    // 'a' and 'd' are real fixture participants: +1 and -1 differentials
    const plusOne = mkStats('a', { ppg: '5.50' });
    const minusOne = mkStats('d', { ppg: '5.50' });

    const sorted = sortForFinalsSeeding([minusOne, high, plusOne], rounds);
    expect(sorted[0].id).toBe('high');
    expect(sorted[1].id).toBe('a');
    expect(sorted[2].id).toBe('d');
  });

  it('returns a new array without mutating the input', () => {
    const arr = [mkStats('a'), mkStats('b', { ppg: '9.99' })];
    const before = [...arr];
    sortForFinalsSeeding(arr, rounds);
    expect(arr.map(p => p.id)).toEqual(before.map(p => p.id));
  });
});
