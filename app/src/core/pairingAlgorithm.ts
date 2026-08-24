import { Player, Pair, Match, PartnershipHistory, OppositionHistory } from './types';

export const getPlayerSkill = (player: Player): number => {
  // Use ELO rating as primary skill metric
  // This provides more accurate skill assessment than PPG
  return player.eloRating;
};

/** ELO band within which players are considered equals and shuffled randomly. */
const ELO_BUCKET_WIDTH = 10;

const shuffle = <T,>(items: T[]): T[] => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

/**
 * Order players deterministically by ELO (desc), shuffling only within bands of
 * near-equal ELO. Shuffling the data up front keeps Array.sort's comparator
 * consistent (a random comparator is undefined behavior) while preserving
 * variety among equals.
 */
const orderPlayersForPairing = (players: Player[]): Player[] => {
  const sorted = [...players].sort((a, b) => b.eloRating - a.eloRating);
  const result: Player[] = [];
  let bucket: Player[] = [];

  const flushBucket = () => {
    if (bucket.length > 0) {
      result.push(...shuffle(bucket));
      bucket = [];
    }
  };

  sorted.forEach(player => {
    if (
      bucket.length === 0 ||
      bucket[0].eloRating - player.eloRating < ELO_BUCKET_WIDTH
    ) {
      bucket.push(player);
    } else {
      flushBucket();
      bucket = [player];
    }
  });
  flushBucket();

  return result;
};

/**
 * Improved pairing algorithm using ELO-based skill assessment with greedy approach
 * Players are ordered by ELO rating (with randomness only within equal-ELO bands)
 * and paired to maximize variety and balance
 */
export const generatePairs = (
  activePlayers: Player[],
  partnershipHistory: PartnershipHistory
): Pair[] => {
  // Deterministic ELO order with shuffling confined to near-equal bands
  const sortedPlayers = orderPlayersForPairing(activePlayers);

  const pairs: Pair[] = [];
  const usedPlayers = new Set<string>();

  while (sortedPlayers.length - usedPlayers.size >= 2) {
    let bestPair: [Player, Player] | null = null;
    let bestScore = -Infinity;

    // Find best pairing from remaining players
    for (let i = 0; i < sortedPlayers.length; i++) {
      const p1 = sortedPlayers[i];
      if (usedPlayers.has(p1.id)) continue;

      for (let j = i + 1; j < sortedPlayers.length; j++) {
        const p2 = sortedPlayers[j];
        if (usedPlayers.has(p2.id)) continue;

        // Calculate pairing score
        const partnerCount = partnershipHistory[p1.id]?.[p2.id] || 0;
        const skillDiff = Math.abs(getPlayerSkill(p1) - getPlayerSkill(p2));

        // Scoring weights (heavily prioritize variety):
        // - Never played together: +2000 (high priority)
        // - Played once: -500 (strong penalty to avoid repeats)
        // - Played twice: -1500 (very strong penalty)
        // - Played 3+ times: -2000 per additional time (massive penalty)
        const varietyScore = partnerCount === 0 ? 2000 :
                            partnerCount === 1 ? -500 :
                            partnerCount === 2 ? -1500 : -2000 * (partnerCount - 1);

        // Prefer skill balance (lower diff is better)
        // But make this less important than variety
        const skillScore = -skillDiff * 20;

        const totalScore = varietyScore + skillScore;

        if (totalScore > bestScore) {
          bestScore = totalScore;
          bestPair = [p1, p2];
        }
      }
    }

    if (bestPair) {
      const [p1, p2] = bestPair;
      pairs.push({
        id: `pair-${pairs.length}`,
        players: [p1, p2],
        avgSkill: (getPlayerSkill(p1) + getPlayerSkill(p2)) / 2
      });
      usedPlayers.add(p1.id);
      usedPlayers.add(p2.id);
    } else {
      break;
    }
  }

  return pairs;
};

/**
 * Snake-style pairing: strongest with weakest, second strongest with second
 * weakest, etc. Used periodically so strong players regularly mix with the
 * whole group instead of only ever facing their own skill tier.
 * Callers must have already removed sitting-out players.
 */
export const generateSnakePairs = (activePlayers: Player[]): Pair[] => {
  const sorted = [...activePlayers].sort((a, b) => b.eloRating - a.eloRating);
  const pairs: Pair[] = [];

  for (let i = 0; i < sorted.length / 2; i++) {
    const strong = sorted[i];
    const weak = sorted[sorted.length - 1 - i];
    if (strong.id === weak.id) break; // odd leftover — caller handles sit-outs
    pairs.push({
      id: `pair-${pairs.length}`,
      players: [strong, weak],
      avgSkill: (strong.eloRating + weak.eloRating) / 2
    });
  }

  return pairs;
};

export const matchPairs = (
  pairs: Pair[],
  oppositionHistory: OppositionHistory,
  roundId: number
): Match[] => {
  const matches: Match[] = [];
  const usedPairs = new Set<number>();

  // Sort pairs by average skill
  const sortedPairs = [...pairs].sort((a, b) => (b.avgSkill || 0) - (a.avgSkill || 0));

  for (let i = 0; i < sortedPairs.length; i++) {
    if (usedPairs.has(i)) continue;

    let bestOpponent = -1;
    let bestScore = -Infinity;

    for (let j = i + 1; j < sortedPairs.length; j++) {
      if (usedPairs.has(j)) continue;

      const pair1 = sortedPairs[i];
      const pair2 = sortedPairs[j];

      // Calculate how many times these players have faced each other
      let oppCount = 0;
      pair1.players.forEach(p1 => {
        pair2.players.forEach(p2 => {
          oppCount += oppositionHistory[p1.id]?.[p2.id] || 0;
        });
      });

      const skillDiff = Math.abs((pair1.avgSkill || 0) - (pair2.avgSkill || 0));

      // Scoring (heavily prioritize variety over balance):
      // - Never played against each other: +2000 (high priority)
      // - Played once or more: strong penalty (-300 per time)
      // - Balance is secondary concern
      const varietyScore = oppCount === 0 ? 2000 : -oppCount * 300;
      const balanceScore = -skillDiff * 50;

      const totalScore = varietyScore + balanceScore;

      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestOpponent = j;
      }
    }

    if (bestOpponent !== -1) {
      matches.push({
        id: `r${roundId}-m${matches.length}`,
        pair1: sortedPairs[i],
        pair2: sortedPairs[bestOpponent],
        score1: 0,
        score2: 0,
        completed: false,
        startTime: Date.now()
      });
      usedPairs.add(i);
      usedPairs.add(bestOpponent);
    }
  }

  return matches;
};

export const findPlayersToSitOut = (
  activePlayers: Player[],
  count: 1 | 2
): Player[] => {
  const sorted = [...activePlayers]
    .map(p => ({
      player: p,
      sitOutCount: p.sitOutCount || 0,
      matchesPlayed: p.matchesPlayed
    }))
    .sort((a, b) => {
      // Prioritize: fewer sit-outs, then more matches played
      if (a.sitOutCount !== b.sitOutCount) {
        return a.sitOutCount - b.sitOutCount;
      }
      return b.matchesPlayed - a.matchesPlayed;
    });

  return sorted.slice(0, count).map(s => s.player);
};
