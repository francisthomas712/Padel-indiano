import { Player, Pair, Match, PartnershipHistory, OppositionHistory } from '../types';

export const getPlayerSkill = (player: Player): number => {
  // Use ELO rating as primary skill metric
  // This provides more accurate skill assessment than PPG
  return player.eloRating;
};

/**
 * Improved pairing algorithm using ELO-based skill assessment with greedy approach
 * Players are sorted by ELO rating and paired to maximize variety and balance
 */
export const generatePairs = (
  activePlayers: Player[],
  partnershipHistory: PartnershipHistory
): Pair[] => {
  // Sort players by ELO rating (higher ELO = better player)
  const sortedPlayers = [...activePlayers].sort((a, b) => {
    const eloA = a.eloRating;
    const eloB = b.eloRating;
    if (Math.abs(eloA - eloB) < 10) {
      return Math.random() - 0.5; // Add randomness for similar ELO
    }
    return eloB - eloA;
  });

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
