import { PlayerWithStats, Round } from './types';

interface HeadToHeadRecord {
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
}

/**
 * Get head-to-head record between two players
 */
export const getHeadToHead = (
  playerId1: string,
  playerId2: string,
  rounds: Round[]
): HeadToHeadRecord => {
  const record: HeadToHeadRecord = {
    wins: 0,
    losses: 0,
    pointsFor: 0,
    pointsAgainst: 0
  };

  rounds.forEach(round => {
    round.matches.forEach(match => {
      if (!match.completed) return;

      const team1Ids = match.pair1.players.map(p => p.id);
      const team2Ids = match.pair2.players.map(p => p.id);

      const p1Team1 = team1Ids.includes(playerId1);
      const p2Team1 = team1Ids.includes(playerId2);
      const p1Team2 = team2Ids.includes(playerId1);
      const p2Team2 = team2Ids.includes(playerId2);

      // They played against each other
      if ((p1Team1 && p2Team2) || (p1Team2 && p2Team1)) {
        const p1Score = p1Team1 ? match.score1 : match.score2;
        const p2Score = p2Team1 ? match.score1 : match.score2;

        record.pointsFor += p1Score;
        record.pointsAgainst += p2Score;

        if (p1Score > p2Score) record.wins++;
        else if (p1Score < p2Score) record.losses++;
      }
    });
  });

  return record;
};

/**
 * Calculate quality of opponents faced (average PPG of opponents)
 */
export const getOpponentQuality = (
  playerId: string,
  rounds: Round[],
  allPlayers: PlayerWithStats[]
): number => {
  const opponentIds = new Set<string>();
  let totalOpponentPPG = 0;

  rounds.forEach(round => {
    round.matches.forEach(match => {
      if (!match.completed) return;

      const team1Ids = match.pair1.players.map(p => p.id);
      const team2Ids = match.pair2.players.map(p => p.id);

      if (team1Ids.includes(playerId)) {
        team2Ids.forEach(id => opponentIds.add(id));
      } else if (team2Ids.includes(playerId)) {
        team1Ids.forEach(id => opponentIds.add(id));
      }
    });
  });

  opponentIds.forEach(oppId => {
    const opponent = allPlayers.find(p => p.id === oppId);
    if (opponent) {
      totalOpponentPPG += parseFloat(opponent.ppg);
    }
  });

  return opponentIds.size > 0 ? totalOpponentPPG / opponentIds.size : 0;
};

/**
 * Calculate overall point differential (points won across all matches minus
 * points conceded). More robust than head-to-head in rotating doubles, where
 * any two individuals meet only rarely.
 */
export const getPointDifferential = (
  playerId: string,
  rounds: Round[]
): number => {
  let differential = 0;

  rounds.forEach(round => {
    round.matches.forEach(match => {
      if (!match.completed) return;

      const team1Ids = match.pair1.players.map(p => p.id);
      const team2Ids = match.pair2.players.map(p => p.id);

      if (team1Ids.includes(playerId)) {
        differential += match.score1 - match.score2;
      } else if (team2Ids.includes(playerId)) {
        differential += match.score2 - match.score1;
      }
    });
  });

  return differential;
};

/**
 * Comprehensive tie-breaking for leaderboard
 * Returns negative if a should rank higher, positive if b should rank higher
 */
export const tieBreaker = (
  a: PlayerWithStats,
  b: PlayerWithStats,
  rounds: Round[],
  allPlayers: PlayerWithStats[]
): number => {
  // 1. Primary: PPG (already sorted)
  const ppgDiff = parseFloat(b.ppg) - parseFloat(a.ppg);
  if (Math.abs(ppgDiff) > 0.001) return ppgDiff;

  // 2. Win rate
  const winRateDiff = parseFloat(b.winRate) - parseFloat(a.winRate);
  if (Math.abs(winRateDiff) > 0.001) return winRateDiff;

  // 3. Overall point differential (bigger sample than head-to-head in doubles)
  const diffA = getPointDifferential(a.id, rounds);
  const diffB = getPointDifferential(b.id, rounds);
  if (diffA !== diffB) return diffB - diffA;

  // 4. Head-to-head record
  const h2h = getHeadToHead(a.id, b.id, rounds);
  if (h2h.wins !== h2h.losses) {
    return h2h.losses - h2h.wins; // More wins = better rank (negative)
  }

  // 5. Head-to-head point differential
  if (h2h.pointsFor !== h2h.pointsAgainst) {
    return h2h.pointsAgainst - h2h.pointsFor; // More points = better rank (negative)
  }

  // 6. Quality of opponents (Strength of Schedule)
  const qualityA = getOpponentQuality(a.id, rounds, allPlayers);
  const qualityB = getOpponentQuality(b.id, rounds, allPlayers);
  if (Math.abs(qualityA - qualityB) > 0.001) {
    return qualityB - qualityA; // Faced stronger opponents = better rank
  }

  // 7. More matches played (consistency), then total points
  if (b.matchesPlayed !== a.matchesPlayed) {
    return b.matchesPlayed - a.matchesPlayed;
  }
  return b.points - a.points;
};

/**
 * Canonical ranking used everywhere qualification matters (finals seeding).
 * Keeps the finals bracket consistent with the leaderboard's tie-break chain
 * instead of maintaining a second, drifting sort implementation.
 */
export const sortForFinalsSeeding = (
  players: PlayerWithStats[],
  rounds: Round[]
): PlayerWithStats[] =>
  [...players].sort((a, b) => tieBreaker(a, b, rounds, players));
