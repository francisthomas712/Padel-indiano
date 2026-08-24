import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import {
  Trophy,
  Play,
  RotateCcw,
  Download,
  Share2,
  FileText,
  Save,
  Plus,
  Upload,
  Undo,
  Redo,
  PlusCircle,
  Maximize2,
  Tv,
  LogOut
} from 'lucide-react';

// Hooks
import { useTournamentState } from './hooks/useTournamentState';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useWakeLock } from './hooks/useWakeLock';

// Components
import { PlayerList } from './components/PlayerList';
import { Leaderboard } from './components/Leaderboard';
import { MatchCard } from './components/MatchCard';
import { Settings } from './components/Settings';
import { CourtMode } from './components/CourtMode';
import { SpectatorMode, LiveScoreboard } from './components/SpectatorMode';
import { WelcomeScreen } from './components/WelcomeScreen';
import { PlayerStats } from './components/PlayerStats';
import { ParticipantPicker } from './components/ParticipantPicker';

// Types
import {
  Player,
  Pair,
  Match,
  Round,
  FinalsMatch,
  HistoryEntry,
  LeaderboardMode,
  ActiveTab,
  PlayerWithStats,
  PartnershipHistory,
  OppositionHistory
} from './types';

// Utils
import { generatePairs, generateSnakePairs, matchPairs, findPlayersToSitOut } from './utils/pairingAlgorithm';
import {
  getPointDisplay,
  checkMatchWinner,
  getNextServer,
  getPreviousServer,
  getServerInfo,
  ServerPosition
} from './utils/scoring';
import { hapticPoint, hapticCorrection, hapticWin } from './utils/haptics';
import {
  calculatePairRating,
  calculateWeightedPoints,
  updateMatchElo,
  INITIAL_ELO
} from './utils/elo';
import {
  exportToPDF,
  exportToJSON,
  generateTournamentReport,
  downloadTextFile,
  shareResults
} from './utils/export';
import {
  clearSavedRole,
  clearSavedWatchName,
  loadSavedRole,
  loadSavedWatchName,
  saveRole,
  saveWatchName,
  UserRole
} from './utils/localStorage';
import {
  Group,
  deleteGroup as deleteGroupRecord,
  loadGroups,
  normalizeGroupName,
  saveGroup
} from './utils/groups';
import { sortForFinalsSeeding } from './utils/tieBreaking';

interface EditingMatch {
  roundId: number;
  matchId: string;
}

/** Resolve a server position to the player name for the given pairs. */
const resolveServerName = (server: ServerPosition | undefined, pair1: Pair, pair2: Pair): string | null => {
  const info = getServerInfo(server);
  const servingPair = info.pair === 1 ? pair1 : pair2;
  return servingPair.players[info.slot]?.name ?? null;
};

/** Accumulator for reversing one or more completed matches' impact. */
interface RevertAccumulator {
  players: Player[];
  partnershipHistory: PartnershipHistory;
  oppositionHistory: OppositionHistory;
}

/**
 * Reverse everything a completed match did to the state: player stats
 * (points/wins/losses/matchesPlayed), ELO ratings, and partnership/opposition
 * history. ELO reversal uses the per-player deltas stored on the match at
 * completion; matches completed before deltas were stored fall back to a
 * recomputed approximation from current ratings.
 * Mutates the accumulator's arrays/objects — callers pass fresh copies.
 */
const revertMatchImpact = (acc: RevertAccumulator, match: Match): void => {
  const pair1PlayerIds = match.pair1.players.map(p => p.id);
  const pair2PlayerIds = match.pair2.players.map(p => p.id);

  // Stored weighted points, falling back to raw scores for legacy matches
  const points1 = match.weightedPoints1 ?? match.score1;
  const points2 = match.weightedPoints2 ?? match.score2;

  // Approximate ELO reversal for matches without stored deltas:
  // recompute the adjustment from current ratings (exact for stored deltas).
  const fallbackEloDeltas = (() => {
    if (match.eloDeltas) return null;
    const ratingOf = (id: string): number =>
      acc.players.find(p => p.id === id)?.eloRating ?? INITIAL_ELO;
    const playedOf = (id: string): number =>
      acc.players.find(p => p.id === id)?.matchesPlayed ?? 0;
    const newRatings = updateMatchElo(
      { id: pair1PlayerIds[0], rating: ratingOf(pair1PlayerIds[0]), matchesPlayed: playedOf(pair1PlayerIds[0]) },
      { id: pair1PlayerIds[1], rating: ratingOf(pair1PlayerIds[1]), matchesPlayed: playedOf(pair1PlayerIds[1]) },
      { id: pair2PlayerIds[0], rating: ratingOf(pair2PlayerIds[0]), matchesPlayed: playedOf(pair2PlayerIds[0]) },
      { id: pair2PlayerIds[1], rating: ratingOf(pair2PlayerIds[1]), matchesPlayed: playedOf(pair2PlayerIds[1]) },
      match.score1,
      match.score2
    );
    const deltas: Record<string, number> = {};
    Object.entries(newRatings).forEach(([id, newRating]) => {
      deltas[id] = newRating - ratingOf(id);
    });
    return deltas;
  })();
  const eloDeltas = match.eloDeltas ?? fallbackEloDeltas ?? {};

  const revertFor = (playerIds: string[], points: number, ownScore: number, otherScore: number) => {
    playerIds.forEach(playerId => {
      const player = acc.players.find(p => p.id === playerId);
      if (!player) return;
      player.points -= points;
      player.matchesPlayed = Math.max(0, player.matchesPlayed - 1);
      if (ownScore > otherScore) player.wins = Math.max(0, player.wins - 1);
      else if (ownScore < otherScore) player.losses = Math.max(0, player.losses - 1);
      const delta = eloDeltas[playerId];
      if (delta !== undefined) {
        player.eloRating = Math.round(player.eloRating - delta);
      }
    });
  };

  revertFor(pair1PlayerIds, points1, match.score1, match.score2);
  revertFor(pair2PlayerIds, points2, match.score2, match.score1);

  // Reverse partnership history
  [pair1PlayerIds, pair2PlayerIds].forEach(pairIds => {
    const [p1, p2] = pairIds;
    if (acc.partnershipHistory[p1]?.[p2]) {
      acc.partnershipHistory[p1][p2] = Math.max(0, acc.partnershipHistory[p1][p2] - 1);
    }
    if (acc.partnershipHistory[p2]?.[p1]) {
      acc.partnershipHistory[p2][p1] = Math.max(0, acc.partnershipHistory[p2][p1] - 1);
    }
  });

  // Reverse opposition history
  pair1PlayerIds.forEach(p1 => {
    pair2PlayerIds.forEach(p2 => {
      if (acc.oppositionHistory[p1]?.[p2]) {
        acc.oppositionHistory[p1][p2] = Math.max(0, acc.oppositionHistory[p1][p2] - 1);
      }
      if (acc.oppositionHistory[p2]?.[p1]) {
        acc.oppositionHistory[p2][p1] = Math.max(0, acc.oppositionHistory[p2][p1] - 1);
      }
    });
  });
};

const App: React.FC = () => {
  const {
    state,
    updateState,
    undo,
    redo,
    canUndo,
    canRedo,
    history
  } = useTournamentState();

  // Local UI state
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerElo, setNewPlayerElo] = useState('');
  const [activeTab, setActiveTab] = useState<ActiveTab>('tournament');
  const [leaderboardMode, setLeaderboardMode] = useState<LeaderboardMode>('ppg');
  const [editingMatch, setEditingMatch] = useState<EditingMatch | null>(null);
  const [groups, setGroups] = useState<Record<string, Group>>({});
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState('');
  // First-run gate: null until we've checked localStorage for a saved role
  const [role, setRole] = useState<UserRole | null>(null);
  const [onboarded, setOnboarded] = useState(false);
  const [showCustomRound, setShowCustomRound] = useState(false);
  const [customPlayer1, setCustomPlayer1] = useState('');
  const [customPlayer2, setCustomPlayer2] = useState('');
  const [customPlayer3, setCustomPlayer3] = useState('');
  const [customPlayer4, setCustomPlayer4] = useState('');
  const [courtModeTarget, setCourtModeTarget] = useState<EditingMatch | null>(null);
  const [finalsCourtOpen, setFinalsCourtOpen] = useState(false);
  const [spectatorOpen, setSpectatorOpen] = useState(false);
  const [watchKey, setWatchKey] = useState<string | null>(null);
  // Courts picker shown alongside Start Tournament (defaults to 2)
  const [pendingCourts, setPendingCourts] = useState(2);

  // Deep-link spectator space: …/#/watch/<groupName>
  useEffect(() => {
    const applyHash = () => {
      const match = window.location.hash.match(/^#\/watch\/([A-Za-z0-9_-]+)/);
      setWatchKey(match ? match[1].toLowerCase() : null);
      if (match) setSpectatorOpen(true);
    };
    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, []);

  // Shareable link to this group's spectator space
  const handleShareWatch = useCallback((groupName: string) => {
    const url = `${window.location.origin}${window.location.pathname}#/watch/${normalizeGroupName(groupName)}`;
    navigator.clipboard?.writeText(url).then(
      () => toast.success('Watch link copied — anyone on this device can open it'),
      () => toast(url, { icon: '🔗' })
    );
  }, []);

  // Derived settings flags (optional fields for backward compatibility with saved data)
  const winByTwo = state.settings.winByTwo ?? false;
  const goldenPoint = state.settings.goldenPoint ?? false;

  // Keep the screen awake while matches are in progress or court mode is open
  const hasActivePlay =
    state.rounds.some(r => r.matches.some(m => !m.completed)) ||
    (state.finalsMode && state.finalsMatch !== null && !state.finalsMatch.completed) ||
    courtModeTarget !== null ||
    finalsCourtOpen;
  useWakeLock(state.tournamentStarted && hasActivePlay);

  // Load groups on mount + restore saved role (skip welcome gate for returning users)
  useEffect(() => {
    setGroups(loadGroups());
    const savedRole = loadSavedRole();
    if (savedRole) {
      setRole(savedRole);
      setOnboarded(true);
      if (savedRole === 'spectator') {
        const savedWatch = loadSavedWatchName();
        if (savedWatch) {
          setWatchKey(normalizeGroupName(savedWatch));
          setSpectatorOpen(true);
        }
      }
    }
  }, []);

  // First-run gate: link this device to a one-word group name, pick a role
  const handleJoin = useCallback((groupName: string, joinedRole: 'admin' | 'spectator') => {
    setRole(joinedRole);
    saveRole(joinedRole);
    setOnboarded(true);

    if (joinedRole === 'spectator') {
      saveWatchName(groupName);
      setWatchKey(normalizeGroupName(groupName));
      setSpectatorOpen(true);
    } else {
      // Tag the session with the group name (players can still be loaded/added)
      updateState({ groupName });
      toast.success(`Running "${groupName}" — add players or load a group below`);
    }
  }, [updateState]);

  // Initialize partnership and opposition history for a player
  const initializePlayerHistory = useCallback((playerId: string) => {
    const { partnershipHistory, oppositionHistory } = state;

    if (!partnershipHistory[playerId]) {
      updateState({
        partnershipHistory: { ...partnershipHistory, [playerId]: {} }
      });
    }
    if (!oppositionHistory[playerId]) {
      updateState({
        oppositionHistory: { ...oppositionHistory, [playerId]: {} }
      });
    }
  }, [state, updateState]);

  // Add a new player
  const addPlayer = useCallback(() => {
    if (!newPlayerName.trim()) {
      toast.error('Please enter a player name');
      return;
    }

    // Parse optional ELO rating
    let customElo = INITIAL_ELO;
    if (newPlayerElo.trim()) {
      const parsedElo = parseInt(newPlayerElo.trim(), 10);
      if (isNaN(parsedElo) || parsedElo < 100 || parsedElo > 3000) {
        toast.error('ELO rating must be between 100 and 3000');
        return;
      }
      customElo = parsedElo;
    }

    const newPlayer: Player = {
      id: Date.now().toString(),
      name: newPlayerName.trim(),
      points: 0,
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      active: true,
      sitOutCount: 0,
      eloRating: customElo,
      initialElo: customElo
    };

    updateState(
      { players: [...state.players, newPlayer] },
      {
        type: 'player_add',
        timestamp: Date.now(),
        data: { player: newPlayer }
      }
    );

    setNewPlayerName('');
    setNewPlayerElo('');
    initializePlayerHistory(newPlayer.id);
    toast.success(`Added ${newPlayer.name}${customElo !== INITIAL_ELO ? ` (ELO: ${customElo})` : ''}`);
  }, [newPlayerName, newPlayerElo, state.players, updateState, initializePlayerHistory]);

  // Remove a player (only before tournament starts)
  const removePlayer = useCallback((playerId: string) => {
    const player = state.players.find(p => p.id === playerId);
    if (!player) return;
    if (!window.confirm(`Remove ${player.name}?`)) return;

    updateState(
      { players: state.players.filter(p => p.id !== playerId) },
      {
        type: 'player_delete',
        timestamp: Date.now(),
        data: { removed: true, playerId }
      }
    );

    toast.success(`Removed ${player.name}`);
  }, [state.players, updateState]);

  // Edit a player's name and/or starting ELO (only before tournament starts).
  // Changing the ELO resets their rating baseline (initialElo) so the +/- delta stays honest.
  const editPlayer = useCallback((playerId: string, name: string, elo: number) => {
    const player = state.players.find(p => p.id === playerId);
    if (!player) return;

    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Name cannot be empty');
      return;
    }

    const updates: Partial<Player> = { name: trimmed };
    if (elo !== player.initialElo) {
      updates.initialElo = elo;
      updates.eloRating = elo; // rebaseline the rating when starting ELO changes
    }

    updateState(
      { players: state.players.map(p => (p.id === playerId ? { ...p, ...updates } : p)) },
      {
        type: 'player_edit',
        timestamp: Date.now(),
        data: { playerId, name: trimmed, elo }
      }
    );

    toast.success(`Updated ${trimmed}`);
  }, [state.players, updateState]);

  // Reset a player's ELO to the default starting rating (keeps win/loss record)
  const resetPlayerElo = useCallback((playerId: string) => {
    const player = state.players.find(p => p.id === playerId);
    if (!player) return;
    if (!window.confirm(`Reset ${player.name}'s ELO to ${INITIAL_ELO}? Their win/loss record is kept.`)) return;

    updateState(
      {
        players: state.players.map(p =>
          p.id === playerId ? { ...p, eloRating: INITIAL_ELO, initialElo: INITIAL_ELO } : p
        )
      },
      {
        type: 'player_edit',
        timestamp: Date.now(),
        data: { playerId, eloReset: true }
      }
    );
    toast.success(`${player.name}'s ELO reset to ${INITIAL_ELO}`);
  }, [state.players, updateState]);

  // Toggle player active/inactive status
  const togglePlayerActive = useCallback((playerId: string) => {
    const player = state.players.find(p => p.id === playerId);
    if (!player) return;

    const updatedPlayers = state.players.map(p =>
      p.id === playerId ? { ...p, active: !p.active } : p
    );

    updateState(
      { players: updatedPlayers },
      {
        type: 'player_toggle',
        timestamp: Date.now(),
        data: { playerId, active: !player.active }
      }
    );

    // Context-aware wording: pre-start this is participation, mid-tournament it's away/back
    toast.success(
      state.tournamentStarted
        ? `${player.name} is now ${player.active ? 'away' : 'active'}`
        : `${player.name} ${player.active ? 'is playing' : 'is out'}`
    );
  }, [state.players, state.tournamentStarted, updateState]);

  // Generate next round
  const generateNextRound = useCallback(() => {
    const activePlayers = state.players.filter(p => p.active);

    if (activePlayers.length < 4) {
      toast.error('Need at least 4 active players to generate a round');
      return;
    }

    let playersToMatch = [...activePlayers];
    let sittingOut: Player | { id: string; name: string; players: Player[] } | null = null;

    // Handle odd number of players
    const remainder = playersToMatch.length % 4;
    if (remainder === 1 || remainder === 3) {
      const [sitOut] = findPlayersToSitOut(playersToMatch, 1);
      sittingOut = sitOut;
      playersToMatch = playersToMatch.filter(p => p.id !== sitOut.id);
    } else if (remainder === 2) {
      const sitOuts = findPlayersToSitOut(playersToMatch, 2);
      sittingOut = {
        id: 'multi',
        name: sitOuts.map(p => p.name).join(', '),
        players: sitOuts
      };
      playersToMatch = playersToMatch.filter(p => !sitOuts.some(s => s.id === p.id));
    }

    // Every third round (3rd, 6th, ...), use snake pairing so strong players
    // mix with the whole group; otherwise variety-driven greedy pairing
    const useSnake = state.rounds.length % 3 === 2;
    const pairs = useSnake
      ? generateSnakePairs(playersToMatch)
      : generatePairs(playersToMatch, state.partnershipHistory);

    if (pairs.length < 2) {
      toast.error('Not enough players to form matches');
      return;
    }

    // Match pairs against each other, then cap to the available number of courts
    const courtCount = state.settings.courts ?? 2;
    const allMatches = matchPairs(pairs, state.oppositionHistory, state.rounds.length);
    const matches = allMatches.slice(0, courtCount).map((match, index) => ({ ...match, court: index + 1 }));

    // Players left courtless by the court cap also sit out this round
    const playingIds = new Set(
      matches.flatMap(m => [...m.pair1.players.map(p => p.id), ...m.pair2.players.map(p => p.id)])
    );
    const benched = playersToMatch.filter(p => !playingIds.has(p.id));
    if (benched.length > 0) {
      const existingSitters = sittingOut === null ? [] : 'players' in sittingOut ? sittingOut.players : [sittingOut];
      const allSitters = [...existingSitters, ...benched];
      sittingOut = allSitters.length === 1
        ? allSitters[0]
        : { id: 'multi', name: allSitters.map(p => p.name).join(', '), players: allSitters };
    }

    if (matches.length > 0) {
      // Credit sit-outs immediately so the next round's picker sees fresh counts
      // and nobody sits out twice in a row.
      const sitOutPlayers = sittingOut === null
        ? []
        : 'players' in sittingOut ? sittingOut.players : [sittingOut];
      const playersWithSitOuts = state.players.map(p =>
        sitOutPlayers.some(s => s.id === p.id)
          ? { ...p, sitOutCount: p.sitOutCount + 1 }
          : p
      );

      const newRound: Round = {
        id: state.rounds.length,
        matches,
        completed: false,
        sittingOut
      };

      updateState(
        { rounds: [...state.rounds, newRound], players: playersWithSitOuts },
        {
          type: 'round_generate',
          timestamp: Date.now(),
          data: { round: newRound }
        }
      );

      toast.success(`Round ${state.rounds.length + 1} generated with ${matches.length} match${matches.length > 1 ? 'es' : ''}${allMatches.length > matches.length ? ` (${allMatches.length - matches.length} waiting — only ${courtCount} court${courtCount > 1 ? 's' : ''})` : ''}`);
    }
  }, [state.players, state.rounds, state.partnershipHistory, state.oppositionHistory, state.settings.courts, updateState]);

  // Generate custom round with user-selected players
  const generateCustomRound = useCallback(() => {
    // Validate all 4 players are selected and unique
    const selectedIds = [customPlayer1, customPlayer2, customPlayer3, customPlayer4];

    if (selectedIds.some(id => !id)) {
      toast.error('Please select all 4 players');
      return;
    }

    const uniqueIds = new Set(selectedIds);
    if (uniqueIds.size !== 4) {
      toast.error('Please select 4 different players');
      return;
    }

    // Get the actual player objects
    const players = selectedIds.map(id => state.players.find(p => p.id === id)!);

    // Create pairs (player 1+2 vs player 3+4)
    const pair1: Pair = {
      id: 'custom-pair1',
      players: [players[0], players[1]],
      avgSkill: (players[0].eloRating + players[1].eloRating) / 2
    };

    const pair2: Pair = {
      id: 'custom-pair2',
      players: [players[2], players[3]],
      avgSkill: (players[2].eloRating + players[3].eloRating) / 2
    };

    // Create the match
    const match: Match = {
      id: `r${state.rounds.length}-m0`,
      pair1,
      pair2,
      score1: 0,
      score2: 0,
      completed: false,
      startTime: Date.now(),
      court: 1
    };

    // Create the round
    const newRound: Round = {
      id: state.rounds.length,
      matches: [match],
      completed: false,
      sittingOut: null
    };

    updateState(
      { rounds: [...state.rounds, newRound] },
      {
        type: 'round_generate',
        timestamp: Date.now(),
        data: { round: newRound }
      }
    );

    // Reset custom round state
    setShowCustomRound(false);
    setCustomPlayer1('');
    setCustomPlayer2('');
    setCustomPlayer3('');
    setCustomPlayer4('');

    toast.success(`Custom round generated: ${players[0].name} + ${players[1].name} vs ${players[2].name} + ${players[3].name}`);
  }, [customPlayer1, customPlayer2, customPlayer3, customPlayer4, state.players, state.rounds, updateState]);

  // Start tournament
  const startTournament = useCallback(() => {
    const activePlayers = state.players.filter(p => p.active);
    if (activePlayers.length < 4) {
      toast.error('Need at least 4 active players to start tournament');
      return;
    }

    // Initialize history for all players
    state.players.forEach(p => initializePlayerHistory(p.id));

    updateState({ tournamentStarted: true, settings: { ...state.settings, courts: pendingCourts } });
    toast.success(`Tournament started on ${pendingCourts} court${pendingCourts > 1 ? 's' : ''}!`);

    // Auto-generate first round
    setTimeout(() => {
      generateNextRound();
    }, 100);
  }, [state.players, state.settings, pendingCourts, updateState, initializePlayerHistory, generateNextRound]);

  // Sign out of the current group: clears the saved role and returns to the join gate.
  // Tournament data is kept — signing back in as admin resumes where you left off.
  const signOutGroup = useCallback(() => {
    if (state.tournamentStarted && !window.confirm('Sign out? Your tournament is saved on this device and will be here when you sign back in.')) {
      return;
    }
    clearSavedRole();
    clearSavedWatchName();
    setOnboarded(false);
    setSpectatorOpen(false);
    setWatchKey(null);
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [state.tournamentStarted]);

  // Update match score
  const updateScore = useCallback((roundId: number, matchId: string, team: 1 | 2, delta: number) => {
    // Haptic feedback for on-court use
    if (delta === 1) hapticPoint(); else hapticCorrection();

    const updatedRounds = state.rounds.map(round => {
      if (round.id === roundId) {
        return {
          ...round,
          matches: round.matches.map(match => {
            if (match.id === matchId) {
              const newScore1 = team === 1 ? Math.max(0, match.score1 + delta) : match.score1;
              const newScore2 = team === 2 ? Math.max(0, match.score2 + delta) : match.score2;
              return {
                ...match,
                score1: newScore1,
                score2: newScore2,
                // Keep service rotation in sync with score corrections:
                // advance one step per point scored, step back per point removed.
                currentServer: delta === 1 ? getNextServer(match.currentServer) : getPreviousServer(match.currentServer)
              };
            }
            return match;
          })
        };
      }
      return round;
    });

    updateState(
      { rounds: updatedRounds },
      {
        type: 'score_update',
        timestamp: Date.now(),
        data: { roundId, matchId, team, delta }
      }
    );
  }, [state.rounds, updateState]);

  // Complete a match
  const completeMatch = useCallback((roundId: number, matchId: string) => {
    const round = state.rounds.find(r => r.id === roundId);
    const match = round?.matches.find(m => m.id === matchId);

    if (!round || !match || match.completed) return;

    // Update player stats with ELO-weighted points
    const updatedPlayers = [...state.players];
    const pair1PlayerIds = match.pair1.players.map(p => p.id);
    const pair2PlayerIds = match.pair2.players.map(p => p.id);

    // Get players for ELO calculations
    const pair1Players = pair1PlayerIds.map(id => updatedPlayers.find(p => p.id === id)!);
    const pair2Players = pair2PlayerIds.map(id => updatedPlayers.find(p => p.id === id)!);

    // Calculate pair average ELO ratings
    const pair1Elo = calculatePairRating(pair1Players[0].eloRating, pair1Players[1].eloRating);
    const pair2Elo = calculatePairRating(pair2Players[0].eloRating, pair2Players[1].eloRating);

    // Winner by raw score (drives both weighting and margin-aware ELO)
    const pair1Won = match.score1 > match.score2;

    // Calculate weighted points based on opponent strength and result
    // Round to 1 decimal place to match display precision and ensure accurate PPG calculations
    const pair1WeightedPoints = Math.round(calculateWeightedPoints(match.score1, pair1Elo, pair2Elo, pair1Won) * 10) / 10;
    const pair2WeightedPoints = Math.round(calculateWeightedPoints(match.score2, pair2Elo, pair1Elo, !pair1Won) * 10) / 10;

    // Update ELO ratings for all players (margin-aware, provisional K for new players)
    const newEloRatings = updateMatchElo(
      { id: pair1Players[0].id, rating: pair1Players[0].eloRating, matchesPlayed: pair1Players[0].matchesPlayed },
      { id: pair1Players[1].id, rating: pair1Players[1].eloRating, matchesPlayed: pair1Players[1].matchesPlayed },
      { id: pair2Players[0].id, rating: pair2Players[0].eloRating, matchesPlayed: pair2Players[0].matchesPlayed },
      { id: pair2Players[1].id, rating: pair2Players[1].eloRating, matchesPlayed: pair2Players[1].matchesPlayed },
      match.score1,
      match.score2
    );

    // Update pair 1 players with weighted points and new ELO
    pair1PlayerIds.forEach(playerId => {
      const player = updatedPlayers.find(p => p.id === playerId);
      if (player) {
        player.points += pair1WeightedPoints;  // Weighted points instead of raw score
        player.eloRating = newEloRatings[playerId];
        player.matchesPlayed += 1;
        if (match.score1 > match.score2) player.wins += 1;
        else if (match.score1 < match.score2) player.losses += 1;
      }
    });

    // Update pair 2 players with weighted points and new ELO
    pair2PlayerIds.forEach(playerId => {
      const player = updatedPlayers.find(p => p.id === playerId);
      if (player) {
        player.points += pair2WeightedPoints;  // Weighted points instead of raw score
        player.eloRating = newEloRatings[playerId];
        player.matchesPlayed += 1;
        if (match.score2 > match.score1) player.wins += 1;
        else if (match.score2 < match.score1) player.losses += 1;
      }
    });

    // Note: sit-out counts are credited at round generation (generateNextRound),
    // not here, so the sitter picker always sees fresh counts.

    // Update partnership history
    const newPartnershipHistory = { ...state.partnershipHistory };
    [pair1PlayerIds, pair2PlayerIds].forEach(pairIds => {
      const [p1, p2] = pairIds;
      if (!newPartnershipHistory[p1]) newPartnershipHistory[p1] = {};
      if (!newPartnershipHistory[p2]) newPartnershipHistory[p2] = {};
      newPartnershipHistory[p1][p2] = (newPartnershipHistory[p1][p2] || 0) + 1;
      newPartnershipHistory[p2][p1] = (newPartnershipHistory[p2][p1] || 0) + 1;
    });

    // Update opposition history
    const newOppositionHistory = { ...state.oppositionHistory };
    pair1PlayerIds.forEach(p1 => {
      pair2PlayerIds.forEach(p2 => {
        if (!newOppositionHistory[p1]) newOppositionHistory[p1] = {};
        if (!newOppositionHistory[p2]) newOppositionHistory[p2] = {};
        newOppositionHistory[p1][p2] = (newOppositionHistory[p1][p2] || 0) + 1;
        newOppositionHistory[p2][p1] = (newOppositionHistory[p2][p1] || 0) + 1;
      });
    });

    // Mark match as completed and store weighted points + per-player ELO deltas
    // (deltas make deletion/editing exactly reversible later)
    const eloDeltas: Record<string, number> = {};
    [...pair1Players, ...pair2Players].forEach(p => {
      eloDeltas[p.id] = newEloRatings[p.id] - p.eloRating;
    });

    const updatedRounds = state.rounds.map(r => {
      if (r.id === roundId) {
        const updatedMatches = r.matches.map(m =>
          m.id === matchId ? {
            ...m,
            completed: true,
            endTime: Date.now(),
            weightedPoints1: pair1WeightedPoints,
            weightedPoints2: pair2WeightedPoints,
            eloDeltas
          } : m
        );
        const allMatchesComplete = updatedMatches.every(m => m.completed);
        return {
          ...r,
          matches: updatedMatches,
          completed: allMatchesComplete
        };
      }
      return r;
    });

    updateState(
      {
        players: updatedPlayers,
        rounds: updatedRounds,
        partnershipHistory: newPartnershipHistory,
        oppositionHistory: newOppositionHistory
      },
      {
        type: 'match_complete',
        timestamp: Date.now(),
        data: { roundId, matchId }
      }
    );

    const winnerName = match.score1 > match.score2
      ? match.pair1.name
      : match.score2 > match.score1 ? match.pair2.name : null;
    hapticWin();
    toast.success(winnerName ? `Match completed! ${winnerName} wins!` : 'Match completed!');
  }, [state, updateState]);

  // Start editing a match
  const startEditingMatch = useCallback((roundId: number, matchId: string) => {
    const round = state.rounds.find(r => r.id === roundId);
    const match = round?.matches.find(m => m.id === matchId);

    if (!round || !match || !match.completed) return;

    // Reverse the match's full impact (stats, ELO, histories) while editing
    const acc: RevertAccumulator = {
      players: state.players.map(p => ({ ...p })),
      partnershipHistory: { ...state.partnershipHistory },
      oppositionHistory: { ...state.oppositionHistory }
    };
    revertMatchImpact(acc, match);

    // Mark match as not completed
    const updatedRounds = state.rounds.map(r => {
      if (r.id === roundId) {
        return {
          ...r,
          matches: r.matches.map(m =>
            m.id === matchId ? { ...m, completed: false } : m
          ),
          completed: false
        };
      }
      return r;
    });

    updateState({
      players: acc.players,
      rounds: updatedRounds,
      partnershipHistory: acc.partnershipHistory,
      oppositionHistory: acc.oppositionHistory
    });

    setEditingMatch({ roundId, matchId });
    toast('Editing match - adjust scores and save');
  }, [state, updateState]);

  // Save edited match
  const saveEditedMatch = useCallback((roundId: number, matchId: string) => {
    completeMatch(roundId, matchId);
    setEditingMatch(null);
    toast.success('Match updated!');
  }, [completeMatch]);

  // Cancel editing
  const cancelEditingMatch = useCallback((roundId: number, matchId: string) => {
    completeMatch(roundId, matchId);
    setEditingMatch(null);
    toast('Edit cancelled');
  }, [completeMatch]);

  // Delete a match
  const deleteMatch = useCallback((roundId: number, matchId: string) => {
    if (!window.confirm('Are you sure you want to delete this match? This action cannot be undone.')) {
      return;
    }

    const round = state.rounds.find(r => r.id === roundId);
    const match = round?.matches.find(m => m.id === matchId);

    if (!round || !match) return;

    if (match.completed) {
      // Reverse the match's full impact (stats, ELO, histories)
      const acc: RevertAccumulator = {
        players: state.players.map(p => ({ ...p })),
        partnershipHistory: { ...state.partnershipHistory },
        oppositionHistory: { ...state.oppositionHistory }
      };
      revertMatchImpact(acc, match);

      updateState({
        players: acc.players,
        partnershipHistory: acc.partnershipHistory,
        oppositionHistory: acc.oppositionHistory
      });
    }

    // Remove match from round
    const updatedRounds = state.rounds.map(r => {
      if (r.id === roundId) {
        const updatedMatches = r.matches.filter(m => m.id !== matchId);
        return {
          ...r,
          matches: updatedMatches,
          completed: updatedMatches.length > 0 ? updatedMatches.every(m => m.completed) : false
        };
      }
      return r;
    });

    updateState(
      { rounds: updatedRounds },
      {
        type: 'match_delete',
        timestamp: Date.now(),
        data: { roundId, matchId }
      }
    );

    toast.success('Match deleted');
  }, [state, updateState]);

  // Delete entire round
  const deleteRound = useCallback((roundId: number) => {
    if (!window.confirm('Are you sure you want to delete this entire round? All matches in this round will be deleted. This action cannot be undone.')) {
      return;
    }

    const round = state.rounds.find(r => r.id === roundId);
    if (!round) return;

    // If round has completed matches, reverse their full impact (stats, ELO, histories)
    const completedMatches = round.matches.filter(m => m.completed);

    if (completedMatches.length > 0) {
      const acc: RevertAccumulator = {
        players: state.players.map(p => ({ ...p })),
        partnershipHistory: { ...state.partnershipHistory },
        oppositionHistory: { ...state.oppositionHistory }
      };
      completedMatches.forEach(match => revertMatchImpact(acc, match));

      updateState({
        players: acc.players,
        partnershipHistory: acc.partnershipHistory,
        oppositionHistory: acc.oppositionHistory
      });
    }

    // Remove the round
    const updatedRounds = state.rounds.filter(r => r.id !== roundId);

    updateState(
      { rounds: updatedRounds },
      {
        type: 'match_delete',
        timestamp: Date.now(),
        data: { roundId }
      }
    );

    toast.success('Round deleted');
  }, [state, updateState]);

  // Get leaderboard
  const getLeaderboard = useCallback((): PlayerWithStats[] => {
    const playersWithStats = state.players
      .filter(p => p.matchesPlayed > 0)
      .map(p => ({
        ...p,
        ppg: p.matchesPlayed > 0 ? (p.points / p.matchesPlayed).toFixed(2) : '0.00',
        winRate: p.matchesPlayed > 0 ? ((p.wins / p.matchesPlayed) * 100).toFixed(1) : '0.0',
        eloDelta: p.eloRating - p.initialElo
      }));

    if (leaderboardMode === 'elo') {
      // Sort by ELO rating (highest first)
      return playersWithStats.sort((a, b) => {
        if (b.eloRating !== a.eloRating) return b.eloRating - a.eloRating;
        // Tiebreaker: PPG
        const ppgDiff = parseFloat(b.ppg) - parseFloat(a.ppg);
        if (Math.abs(ppgDiff) > 0.001) return ppgDiff;
        return parseFloat(b.winRate) - parseFloat(a.winRate);
      });
    } else if (leaderboardMode === 'ppg') {
      return playersWithStats.sort((a, b) => {
        const ppgDiff = parseFloat(b.ppg) - parseFloat(a.ppg);
        if (Math.abs(ppgDiff) > 0.001) return ppgDiff;
        if (b.matchesPlayed !== a.matchesPlayed) return b.matchesPlayed - a.matchesPlayed;
        return parseFloat(b.winRate) - parseFloat(a.winRate);
      });
    } else {
      return playersWithStats.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        return parseFloat(b.winRate) - parseFloat(a.winRate);
      });
    }
  }, [state.players, leaderboardMode]);

  // Initiate finals
  const initiateFinals = useCallback(() => {
    // Get top 4 players by weighted PPG (not current leaderboard mode)
    // Only include active players who have played matches.
    // Seeding uses the same canonical tie-break chain as the leaderboard.
    const playersWithStats = state.players
      .filter(p => p.matchesPlayed > 0 && p.active)
      .map(p => ({
        ...p,
        ppg: p.matchesPlayed > 0 ? (p.points / p.matchesPlayed).toFixed(2) : '0.00',
        winRate: p.matchesPlayed > 0 ? ((p.wins / p.matchesPlayed) * 100).toFixed(1) : '0.0',
        eloDelta: p.eloRating - p.initialElo
      }));

    if (playersWithStats.length < 4) {
      toast.error('Need at least 4 active players who have played matches to start finals');
      return;
    }

    const top4 = sortForFinalsSeeding(playersWithStats, state.rounds).slice(0, 4);

    const finals: FinalsMatch = {
      id: 'finals',
      pair1: {
        id: 'finals-pair1',
        players: [top4[0], top4[3]],
        name: `${top4[0].name} & ${top4[3].name}`
      },
      pair2: {
        id: 'finals-pair2',
        players: [top4[1], top4[2]],
        name: `${top4[1].name} & ${top4[2].name}`
      },
      score1: 0,
      score2: 0,
      winner: null,
      completed: false,
      currentServer: 'pair1-p1'
    };

    updateState({
      finalsMode: true,
      finalsMatch: finals
    });

    toast.success('Finals initiated!');
  }, [state.players, state.rounds, updateState]);

  // Update finals score
  const updateFinalsScore = useCallback((team: 1 | 2, delta: number) => {
    if (!state.finalsMatch || state.finalsMatch.completed) return;

    // Haptic feedback for on-court use
    if (delta === 1) hapticPoint(); else hapticCorrection();

    const match = { ...state.finalsMatch };

    if (team === 1) {
      match.score1 = Math.max(0, match.score1 + delta);
    } else {
      match.score2 = Math.max(0, match.score2 + delta);
    }

    // Rotate server after point is scored; step back on corrections
    match.currentServer = delta === 1 ? getNextServer(match.currentServer) : getPreviousServer(match.currentServer);

    // Check for winner using new scoring system
    const winner = checkMatchWinner(match.score1, match.score2, state.settings.pointsToWin, { winByTwo, goldenPoint });
    if (winner) {
      match.winner = winner;
      hapticWin();
    }

    updateState({ finalsMatch: match });
  }, [state.finalsMatch, state.settings.pointsToWin, winByTwo, goldenPoint, updateState]);

  // Complete finals
  const completeFinalsMatch = useCallback(() => {
    if (!state.finalsMatch || !state.finalsMatch.winner) {
      toast.error('Please finish the game before completing the match');
      return;
    }

    const match = { ...state.finalsMatch, completed: true };
    updateState({ finalsMatch: match });
    toast.success('Finals completed! Tournament champions crowned!');
  }, [state.finalsMatch, updateState]);

  // Reset tournament
  const resetTournament = useCallback(() => {
    if (state.tournamentStarted && !window.confirm('Are you sure you want to reset the tournament? All progress will be lost.')) {
      return;
    }

    const resetPlayers = state.players.map(p => ({
      ...p,
      points: 0,
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      active: true,
      sitOutCount: 0
    }));

    updateState({
      players: resetPlayers,
      rounds: [],
      tournamentStarted: false,
      partnershipHistory: {},
      oppositionHistory: {},
      finalsMode: false,
      finalsMatch: null
    });

    toast.success('Tournament reset!');
  }, [state, updateState]);

  // Export functions
  const handleExportPDF = useCallback(async () => {
    try {
      await exportToPDF('tournament-container', `padel-tournament-${Date.now()}.pdf`);
      toast.success('PDF exported successfully!');
    } catch (error) {
      toast.error('Failed to export PDF');
      console.error(error);
    }
  }, []);

  const handleExportJSON = useCallback(() => {
    try {
      exportToJSON(state);
      toast.success('Tournament data exported!');
    } catch (error) {
      toast.error('Failed to export data');
      console.error(error);
    }
  }, [state]);

  const handleExportReport = useCallback(() => {
    try {
      const report = generateTournamentReport(getLeaderboard(), state.rounds, state.finalsMatch);
      downloadTextFile(report, `tournament-report-${Date.now()}.txt`);
      toast.success('Report generated!');
    } catch (error) {
      toast.error('Failed to generate report');
      console.error(error);
    }
  }, [getLeaderboard, state.rounds, state.finalsMatch]);

  const handleShare = useCallback(async () => {
    try {
      await shareResults(getLeaderboard());
      toast.success('Results shared!');
    } catch (error) {
      toast.error('Sharing not supported on this device');
    }
  }, [getLeaderboard]);

  // Group functions — named, unique player sets with historical ELOs
  const openGroupModal = useCallback(() => {
    setGroupNameInput(state.groupName ?? '');
    setShowGroupModal(true);
  }, [state.groupName]);

  const handleSaveGroup = useCallback(() => {
    if (state.players.length === 0) {
      toast.error('Add players before saving a group');
      return;
    }

    const result = saveGroup(
      groupNameInput,
      state.players.map(p => ({ name: p.name, eloRating: p.eloRating, avatar: p.avatar })),
      state.settings,
      state.groupName
    );

    if (!result.ok) {
      toast.error(result.error === 'name-taken'
        ? 'That name belongs to another group — names must be unique'
        : 'Use a single word (letters, numbers, - or _) up to 24 characters');
      return;
    }

    setGroups(loadGroups());
    updateState({ groupName: result.group.name });
    setShowGroupModal(false);
    toast.success(`Group "${result.group.name}" saved!`);
  }, [groupNameInput, state.players, state.settings, state.groupName, updateState]);

  const handleLoadGroup = useCallback((group: Group) => {
    if (state.tournamentStarted && !window.confirm(`Loading "${group.name}" will reset the current tournament. Continue?`)) {
      return;
    }

    // Stable IDs (group key + player name) so reloading the same group
    // keeps player identity consistent across sessions.
    const players: Player[] = group.players.map(p => ({
      id: `${group.key}-${normalizeGroupName(p.name)}`,
      name: p.name,
      avatar: p.avatar,
      points: 0,
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      active: true,
      sitOutCount: 0,
      eloRating: p.eloRating,
      initialElo: p.eloRating
    }));

    updateState({
      players,
      settings: group.settings ?? state.settings,
      rounds: [],
      tournamentStarted: false,
      partnershipHistory: {},
      oppositionHistory: {},
      finalsMode: false,
      finalsMatch: null,
      groupName: group.name
    });

    toast.success(`Group "${group.name}" loaded!`);
  }, [state.tournamentStarted, state.settings, updateState]);

  const handleDeleteGroup = useCallback((name: string) => {
    if (!window.confirm(`Delete group "${name}"? Its players and ELO history will be removed.`)) return;
    deleteGroupRecord(name);
    setGroups(loadGroups());
    toast.success('Group deleted');
  }, []);

  // Human-readable one-liner for a history entry
  const describeHistoryEntry = useCallback((entry: HistoryEntry): string => {
    const data = entry.data as Record<string, unknown>;
    const nameOf = (p: unknown): string =>
      typeof p === 'object' && p !== null && 'name' in p ? String((p as Player).name) : 'player';
    switch (entry.type) {
      case 'score_update': {
        const team = data.team === 1 ? 1 : 2;
        return `${(data.delta as number) > 0 ? '+' : ''}${data.delta} point for team ${team}`;
      }
      case 'match_complete': {
        const round = state.rounds.find(r => r.id === data.roundId);
        const match = round?.matches.find(m => m.id === data.matchId);
        if (match) {
          const w = match.score1 > match.score2 ? match.pair1 : match.pair2;
          return `${w.name ?? w.players.map(p => p.name).join(' & ')} won ${Math.max(match.score1, match.score2)}–${Math.min(match.score1, match.score2)}`;
        }
        return 'Match completed';
      }
      case 'match_delete':
        return 'Match deleted';
      case 'player_add':
        return data.player ? `Added ${nameOf(data.player)}` : 'Player added';
      case 'player_edit':
        return `Edited player (${String(data.name ?? '')})`;
      case 'player_delete':
        return 'Player removed';
      case 'player_toggle':
        return 'Player active/away toggled';
      case 'round_generate':
        return `Round generated${state.rounds.length ? ` (#${state.rounds.length})` : ''}`;
      default:
        return 'Tournament action';
    }
  }, [state.rounds]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onUndo: canUndo ? undo : undefined,
    onRedo: canRedo ? redo : undefined,
    onSave: openGroupModal
  });

  // Live scoreboards for the spectator space (in-progress matches + finals)
  const liveBoards = useMemo<LiveScoreboard[]>(() => {
    const boards: LiveScoreboard[] = [];
    state.rounds.forEach(round => {
      round.matches.forEach(match => {
        if (match.completed) return;
        boards.push({
          id: match.id,
          title: `Court ${match.court ?? '?'}`,
          team1Name: match.pair1.name ?? match.pair1.players.map(p => p.name).join(' & '),
          team2Name: match.pair2.name ?? match.pair2.players.map(p => p.name).join(' & '),
          score1: match.score1,
          score2: match.score2,
          pointsToWin: state.settings.pointsToWin,
          serverName: resolveServerName(match.currentServer as ServerPosition | undefined, match.pair1, match.pair2)
        });
      });
    });
    if (state.finalsMode && state.finalsMatch && !state.finalsMatch.completed) {
      boards.push({
        id: 'finals',
        title: '🏆 Finals',
        team1Name: state.finalsMatch.pair1.name ?? state.finalsMatch.pair1.players.map(p => p.name).join(' & '),
        team2Name: state.finalsMatch.pair2.name ?? state.finalsMatch.pair2.players.map(p => p.name).join(' & '),
        score1: state.finalsMatch.score1,
        score2: state.finalsMatch.score2,
        pointsToWin: state.settings.pointsToWin,
        serverName: resolveServerName(
          state.finalsMatch.currentServer as ServerPosition | undefined,
          state.finalsMatch.pair1,
          state.finalsMatch.pair2
        )
      });
    }
    return boards;
  }, [state.rounds, state.finalsMode, state.finalsMatch, state.settings.pointsToWin]);

  // First-run gate: everyone picks a group name and role before seeing the app
  // (placed after all hooks so hook order stays stable across renders)
  if (!onboarded) {
    return (
      <WelcomeScreen
        knownGroupNames={Object.values(groups).sort((a, b) => b.updatedAt - a.updatedAt).map(g => g.name)}
        onJoin={handleJoin}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <Toaster position="top-right" />

      <div className="max-w-7xl mx-auto" id="tournament-container">
        {/* Header */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-2xl p-8 mb-6 border border-slate-700">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg">
                <Trophy className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">Padel Indiano</h1>
                <p className="text-slate-400 text-sm font-medium">Dynamic skill-based tournament system</p>
              </div>
            </div>

            {/* Undo/Redo + Save Group buttons */}
            <div className="flex gap-2">
              {state.players.length > 0 && (
                <button
                  onClick={openGroupModal}
                  className="p-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-all hover:shadow-lg flex items-center gap-1.5 px-3"
                  title="Save group (Ctrl+S) — stores these players and their current ELOs"
                >
                  <Save className="w-5 h-5" />
                  {state.groupName && <span className="text-sm font-semibold">{state.groupName}</span>}
                </button>
              )}
              <button
                onClick={undo}
                disabled={!canUndo}
                className="p-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:shadow-lg"
                title="Undo (Ctrl+Z)"
              >
                <Undo className="w-5 h-5" />
              </button>
              <button
                onClick={redo}
                disabled={!canRedo}
                className="p-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:shadow-lg"
                title="Redo (Ctrl+Shift+Z)"
              >
                <Redo className="w-5 h-5" />
              </button>
              <button
                onClick={signOutGroup}
                className="p-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-red-500/80 hover:text-white transition-all hover:shadow-lg"
                title={`Sign out of ${state.groupName ?? 'group'}`}
                aria-label="Sign out of current group"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2 mb-8 border-b border-slate-700 flex-wrap">
            {(['tournament', 'players', 'rules', 'history', 'settings'] as ActiveTab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 font-semibold transition-all capitalize ${
                  activeTab === tab
                    ? 'text-emerald-400 border-b-2 border-emerald-400 shadow-lg shadow-emerald-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:border-b-2 hover:border-slate-600'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tournament Tab */}
          {activeTab === 'tournament' && (
            <div>
              {/* Participant selection — pick who's playing before starting */}
              {!state.tournamentStarted && state.players.length > 0 && (
                <ParticipantPicker
                  players={state.players}
                  tournamentStarted={false}
                  onToggleActive={togglePlayerActive}
                />
              )}

              {/* Tournament Controls */}
              {!state.tournamentStarted && state.players.filter(p => p.active).length >= 4 && (
                <div className="space-y-3 mb-6">
                  {/* Court count picker — locks in when the tournament starts */}
                  <div className="flex items-center justify-between gap-4 bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-200">Courts available</div>
                      <div className="text-xs text-slate-400">How many matches run in parallel each round</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setPendingCourts(c => Math.max(1, c - 1))}
                        className="w-10 h-10 bg-slate-700 text-slate-200 rounded-lg hover:bg-slate-600 text-xl font-bold flex items-center justify-center touch-target"
                        aria-label="Fewer courts"
                      >
                        −
                      </button>
                      <span
                        className="text-2xl font-bold text-emerald-400 w-10 text-center tabular-nums"
                        aria-live="polite"
                      >
                        {pendingCourts}
                      </span>
                      <button
                        onClick={() => setPendingCourts(c => Math.min(16, c + 1))}
                        className="w-10 h-10 bg-slate-700 text-slate-200 rounded-lg hover:bg-slate-600 text-xl font-bold flex items-center justify-center touch-target"
                        aria-label="More courts"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={startTournament}
                      className="flex-1 py-3 bg-blue-500/100 text-white rounded-lg hover:bg-blue-600 flex items-center justify-center gap-2 font-semibold transition-colors"
                    >
                      <Play className="w-5 h-5" />
                      Start Tournament
                    </button>
                  </div>
                </div>
              )}

              {/* Groups bar — save/load recurring player sets */}
              {!state.tournamentStarted && (
                <div className="mb-6 bg-slate-800/50 rounded-xl border border-slate-700 p-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <div className="text-sm font-semibold text-slate-200">Groups</div>
                      <div className="text-xs text-slate-400">
                        Save your player set + their ELOs under a one-word name (e.g. Pawri), reload it next time.
                      </div>
                    </div>
                    <button
                      onClick={openGroupModal}
                      disabled={state.players.length === 0}
                      className="px-4 py-2 bg-emerald-500/90 text-white rounded-lg hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-semibold transition-colors"
                    >
                      <Save className="w-4 h-4" />
                      Save current as Group
                    </button>
                  </div>

                  {Object.keys(groups).length > 0 && (
                    <div className="flex gap-2 flex-wrap mt-3">
                      {Object.values(groups)
                        .sort((a, b) => b.updatedAt - a.updatedAt)
                        .map(group => (
                          <span
                            key={group.key}
                            className="inline-flex items-center gap-1 pl-3 pr-1 py-1 bg-slate-700 border border-slate-600 rounded-full"
                          >
                            <button
                              onClick={() => handleLoadGroup(group)}
                              className="text-sm font-semibold text-slate-100 hover:text-emerald-400 transition-colors"
                              title={`Load ${group.players.length} players (ELOs preserved)`}
                            >
                              {group.name}
                              <span className="text-slate-400 font-normal"> · {group.players.length}p</span>
                            </button>
                            <button
                              onClick={() => handleDeleteGroup(group.name)}
                              className="w-6 h-6 rounded-full text-slate-400 hover:text-red-400 hover:bg-slate-600 text-xs font-bold transition-colors touch-target"
                              aria-label={`Delete group ${group.name}`}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                    </div>
                  )}
                </div>
              )}

              {state.tournamentStarted && !state.finalsMode && (
                <div className="space-y-3 mb-6">
                  {/* Who's here today — toggles away/back for new rounds */}
                  <ParticipantPicker
                    players={state.players}
                    tournamentStarted
                    onToggleActive={togglePlayerActive}
                  />

                  <div className="flex gap-3 flex-wrap">
                    <button
                      onClick={generateNextRound}
                      className="flex-1 min-w-[200px] py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg hover:from-emerald-600 hover:to-teal-700 flex items-center justify-center gap-2 font-semibold transition-all shadow-lg hover:shadow-emerald-500/50"
                    >
                      <PlusCircle className="w-5 h-5" />
                      Generate Next Round
                    </button>
                    <button
                      onClick={initiateFinals}
                      disabled={getLeaderboard().length < 4}
                      className="flex-1 min-w-[200px] py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg hover:from-yellow-600 hover:to-orange-600 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold transition-all shadow-lg hover:shadow-yellow-500/50 disabled:shadow-none"
                    >
                      <Trophy className="w-5 h-5" />
                      Initiate Finals
                    </button>
                    <button
                      onClick={resetTournament}
                      className="px-6 py-3 bg-slate-600 text-white rounded-lg hover:bg-slate-500 flex items-center justify-center gap-2 font-semibold transition-all shadow-lg"
                    >
                      <RotateCcw className="w-5 h-5" />
                      Reset
                    </button>
                    <button
                      onClick={() => setSpectatorOpen(true)}
                      className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 flex items-center justify-center gap-2 font-semibold transition-all shadow-lg"
                      title="Fullscreen leaderboard for players to check from the sideline"
                    >
                      <Tv className="w-5 h-5" />
                      Spectator
                    </button>
                  </div>

                  {/* Export buttons */}
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={handleExportPDF}
                      className="px-4 py-2 bg-red-500/80 text-white rounded-lg hover:bg-red-500 flex items-center gap-2 text-sm transition-all"
                    >
                      <Download className="w-4 h-4" />
                      Export PDF
                    </button>
                    <button
                      onClick={handleExportJSON}
                      className="px-4 py-2 bg-blue-500/100/80 text-white rounded-lg hover:bg-blue-500/100 flex items-center gap-2 text-sm transition-all"
                    >
                      <Download className="w-4 h-4" />
                      Export JSON
                    </button>
                    <button
                      onClick={handleExportReport}
                      className="px-4 py-2 bg-purple-500/100/80 text-white rounded-lg hover:bg-purple-500/100 flex items-center gap-2 text-sm transition-all"
                    >
                      <FileText className="w-4 h-4" />
                      Text Report
                    </button>
                    <button
                      onClick={handleShare}
                      className="px-4 py-2 bg-emerald-500/80 text-white rounded-lg hover:bg-emerald-500 flex items-center gap-2 text-sm transition-all"
                    >
                      <Share2 className="w-4 h-4" />
                      Share
                    </button>
                  </div>
                </div>
              )}

              {/* Finals Match */}
              {state.finalsMode && state.finalsMatch && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                <div className="bg-slate-800/50 rounded-2xl shadow-2xl border border-slate-700 p-6 mb-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-3xl font-bold text-slate-100 flex items-center gap-2">
                      <Trophy className="w-8 h-8 text-yellow-500" />
                      FINALS - Single Game
                    </h2>
                    {state.finalsMatch.winner && !state.finalsMatch.completed && (
                      <span className="px-4 py-2 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-full font-semibold">
                        Game Complete - Click "Complete Match"
                      </span>
                    )}
                    {state.finalsMatch.completed && (
                      <span className="px-4 py-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full font-semibold">
                        Match Complete
                      </span>
                    )}
                  </div>

                  {/* Serve indicator + Court Mode for the finals */}
                  {!state.finalsMatch.completed && (
                    <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
                      <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 rounded-full font-semibold">
                        🎾 Serve: {resolveServerName(
                          state.finalsMatch.currentServer as ServerPosition | undefined,
                          state.finalsMatch.pair1,
                          state.finalsMatch.pair2
                        )}
                      </span>
                      <button
                        onClick={() => setFinalsCourtOpen(true)}
                        className="inline-flex items-center gap-2 px-4 py-1.5 bg-slate-700 text-slate-200 border border-slate-600 rounded-lg hover:bg-slate-600 font-semibold transition-colors"
                      >
                        <Maximize2 className="w-4 h-4" />
                        Court Mode
                      </button>
                    </div>
                  )}

                  {!state.finalsMatch.completed && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Match Display */}
                      <div className="space-y-4">

                        {/* Score Display */}
                        <div>
                          <h3 className="text-sm font-semibold text-slate-400 mb-3 text-center">SCORE</h3>

                          <div className="flex items-center justify-between p-6 bg-blue-500/10 rounded-lg border-2 border-blue-300 mb-3">
                            <div>
                              <div className="font-bold text-xl text-slate-200">
                                {state.finalsMatch.pair1.players[0].name}
                                <span className="text-sm text-slate-400 ml-2">(ELO {state.finalsMatch.pair1.players[0].eloRating})</span>
                              </div>
                              <div className="font-bold text-xl text-slate-200">
                                {state.finalsMatch.pair1.players[1].name}
                                <span className="text-sm text-slate-400 ml-2">(ELO {state.finalsMatch.pair1.players[1].eloRating})</span>
                              </div>
                            </div>
                            <div className="text-6xl font-bold text-blue-600">
                              {getPointDisplay(state.finalsMatch.score1, state.finalsMatch.score2).p1}
                            </div>
                          </div>

                          <div className="text-center text-2xl font-bold text-gray-400 my-2">VS</div>

                          <div className="flex items-center justify-between p-6 bg-orange-500/10 rounded-lg border-2 border-orange-300">
                            <div>
                              <div className="font-bold text-xl text-slate-200">
                                {state.finalsMatch.pair2.players[0].name}
                                <span className="text-sm text-slate-400 ml-2">(ELO {state.finalsMatch.pair2.players[0].eloRating})</span>
                              </div>
                              <div className="font-bold text-xl text-slate-200">
                                {state.finalsMatch.pair2.players[1].name}
                                <span className="text-sm text-slate-400 ml-2">(ELO {state.finalsMatch.pair2.players[1].eloRating})</span>
                              </div>
                            </div>
                            <div className="text-6xl font-bold text-orange-600">
                              {getPointDisplay(state.finalsMatch.score1, state.finalsMatch.score2).p2}
                            </div>
                          </div>
                        </div>

                        {state.finalsMatch.winner && (
                          <div className="bg-gradient-to-r from-green-100 to-emerald-100 p-6 rounded-lg border-2 border-green-400">
                            <div className="text-center">
                              <div className="text-2xl font-bold text-green-800 mb-2">GAME WON!</div>
                              <div className="text-xl font-semibold text-green-700">
                                {state.finalsMatch.winner === 1 ? state.finalsMatch.pair1.name : state.finalsMatch.pair2.name}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Scoring Controls */}
                      <div className="space-y-4">
                        <div className="bg-blue-500/10 p-6 rounded-lg border border-blue-200">
                          <h4 className="font-semibold text-slate-200 mb-4 text-center text-lg">Pair 1 Score</h4>
                          <div className="flex gap-3 justify-center">
                            <button
                              onClick={() => updateFinalsScore(1, 1)}
                              disabled={!!state.finalsMatch.winner}
                              className="px-8 py-4 bg-blue-500/100 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-bold text-lg transition-colors"
                            >
                              + Point
                            </button>
                            <button
                              onClick={() => updateFinalsScore(1, -1)}
                              disabled={!!state.finalsMatch.winner}
                              className="px-8 py-4 bg-gray-400 text-white rounded-lg hover:bg-slate-700/300 disabled:bg-gray-300 disabled:cursor-not-allowed font-bold text-lg transition-colors"
                            >
                              - Point
                            </button>
                          </div>
                        </div>

                        <div className="bg-orange-500/10 p-6 rounded-lg border border-orange-200">
                          <h4 className="font-semibold text-slate-200 mb-4 text-center text-lg">Pair 2 Score</h4>
                          <div className="flex gap-3 justify-center">
                            <button
                              onClick={() => updateFinalsScore(2, 1)}
                              disabled={!!state.finalsMatch.winner}
                              className="px-8 py-4 bg-orange-500/100 text-white rounded-lg hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-bold text-lg transition-colors"
                            >
                              + Point
                            </button>
                            <button
                              onClick={() => updateFinalsScore(2, -1)}
                              disabled={!!state.finalsMatch.winner}
                              className="px-8 py-4 bg-gray-400 text-white rounded-lg hover:bg-slate-700/300 disabled:bg-gray-300 disabled:cursor-not-allowed font-bold text-lg transition-colors"
                            >
                              - Point
                            </button>
                          </div>
                        </div>

                        {state.finalsMatch.winner && (
                          <button
                            onClick={completeFinalsMatch}
                            className="w-full py-4 bg-emerald-500/100 text-white rounded-lg hover:bg-green-600 font-bold text-lg transition-colors flex items-center justify-center gap-2"
                          >
                            <Trophy className="w-5 h-5" />
                            Complete Match & Crown Champions
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Tournament Winners Display */}
                  {state.finalsMatch.completed && (
                    <div className="bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50 p-8 rounded-2xl border-4 border-yellow-400">
                      <div className="text-center mb-6">
                        <div className="text-5xl mb-4">🏆</div>
                        <h2 className="text-4xl font-bold text-slate-200 mb-2">TOURNAMENT CHAMPIONS</h2>
                        <div className="h-1 w-32 bg-yellow-400 mx-auto rounded"></div>
                      </div>

                      <div className="bg-white p-8 rounded-xl shadow-lg mb-6">
                        <div className="text-center">
                          <div className="text-3xl font-bold text-yellow-600 mb-4">
                            {state.finalsMatch.winner === 1 ? state.finalsMatch.pair1.name : state.finalsMatch.pair2.name}
                          </div>
                        </div>
                      </div>

                      <div className="text-center mt-6">
                        <button
                          onClick={resetTournament}
                          className="px-8 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-semibold transition-colors"
                        >
                          Start New Tournament
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                  </div>

                  {/* Leaderboard - Always visible during finals */}
                  <div className="lg:col-span-1">
                    <Leaderboard
                      leaderboard={getLeaderboard()}
                      mode={leaderboardMode}
                      onModeChange={setLeaderboardMode}
                    />
                  </div>
                </div>
              )}

              {/* Rounds and Matches */}
              {state.tournamentStarted && state.rounds.length > 0 && !state.finalsMode && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 space-y-6">
                    {state.rounds.map((round, idx) => (
                      <div key={round.id} className="bg-slate-800/50 rounded-2xl shadow-2xl border border-slate-700 p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h3 className="text-2xl font-bold text-slate-100">Round {idx + 1}</h3>
                            {round.sittingOut && (
                              <p className="text-sm text-orange-400 mt-1">
                                🪑 Sitting out: {round.sittingOut.name}
                                {'players' in round.sittingOut && (
                                  <span className="text-slate-500">
                                    {' '}({round.sittingOut.players.map(p => `${p.sitOutCount}×`).join(', ')})
                                  </span>
                                )}
                                {!('players' in round.sittingOut) && (() => {
                                  const sitter = state.players.find(p => p.id === round.sittingOut!.id);
                                  return sitter ? <span className="text-slate-500"> ({sitter.sitOutCount}× total)</span> : null;
                                })()}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            {round.completed && (
                              <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-sm font-medium">
                                Completed
                              </span>
                            )}
                            <button
                              onClick={() => deleteRound(round.id)}
                              className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 shadow-lg transition-colors text-sm font-medium"
                              title="Delete this round"
                            >
                              Delete Round
                            </button>
                          </div>
                        </div>

                        <div className="space-y-4">
                          {round.matches.map(match => (
                            <MatchCard
                              key={match.id}
                              match={match}
                              roundId={round.id}
                              pointsToWin={state.settings.pointsToWin}
                              winByTwo={winByTwo}
                              goldenPoint={goldenPoint}
                              onScoreUpdate={updateScore}
                              onComplete={completeMatch}
                              onEdit={startEditingMatch}
                              onDelete={deleteMatch}
                              onSaveEdit={saveEditedMatch}
                              onCancelEdit={cancelEditingMatch}
                              onExpand={(rId, mId) => setCourtModeTarget({ roundId: rId, matchId: mId })}
                              isEditing={editingMatch?.roundId === round.id && editingMatch?.matchId === match.id}
                            />
                          ))}
                        </div>
                      </div>
                    ))}

                    {/* Generate Round Buttons */}
                    <div className="bg-slate-800/50 rounded-2xl shadow-2xl border border-slate-700 p-6 space-y-4">
                      <button
                        onClick={generateNextRound}
                        className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg hover:from-emerald-600 hover:to-teal-700 font-bold shadow-lg hover:shadow-emerald-500/50 text-lg transition-colors flex items-center justify-center gap-2"
                      >
                        <Plus className="w-5 h-5" />
                        Generate Next Round
                      </button>

                      <button
                        onClick={() => setShowCustomRound(!showCustomRound)}
                        className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg hover:from-purple-600 hover:to-pink-700 shadow-lg hover:shadow-purple-500/50 font-semibold transition-colors flex items-center justify-center gap-2"
                      >
                        <PlusCircle className="w-5 h-5" />
                        {showCustomRound ? 'Cancel Custom Round' : 'Generate Custom Round'}
                      </button>

                      {/* Custom Round Player Selection */}
                      {showCustomRound && (
                        <div className="border-t pt-4 space-y-4">
                          <h4 className="font-bold text-slate-200">Select Players for Custom Round</h4>
                          <p className="text-sm text-slate-400">Team 1: Player 1 + Player 2 vs Team 2: Player 3 + Player 4</p>

                          <div className="grid grid-cols-2 gap-3">
                            {/* Team 1 */}
                            <div className="space-y-2">
                              <label className="text-sm font-semibold text-slate-300">Team 1 - Player 1</label>
                              <select
                                value={customPlayer1}
                                onChange={(e) => setCustomPlayer1(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                              >
                                <option value="">Select player...</option>
                                {state.players.filter(p => p.active).map(player => (
                                  <option key={player.id} value={player.id}>
                                    {player.name} (ELO: {player.eloRating})
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="space-y-2">
                              <label className="text-sm font-semibold text-slate-300">Team 1 - Player 2</label>
                              <select
                                value={customPlayer2}
                                onChange={(e) => setCustomPlayer2(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                              >
                                <option value="">Select player...</option>
                                {state.players.filter(p => p.active).map(player => (
                                  <option key={player.id} value={player.id}>
                                    {player.name} (ELO: {player.eloRating})
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Team 2 */}
                            <div className="space-y-2">
                              <label className="text-sm font-semibold text-slate-300">Team 2 - Player 3</label>
                              <select
                                value={customPlayer3}
                                onChange={(e) => setCustomPlayer3(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                              >
                                <option value="">Select player...</option>
                                {state.players.filter(p => p.active).map(player => (
                                  <option key={player.id} value={player.id}>
                                    {player.name} (ELO: {player.eloRating})
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="space-y-2">
                              <label className="text-sm font-semibold text-slate-300">Team 2 - Player 4</label>
                              <select
                                value={customPlayer4}
                                onChange={(e) => setCustomPlayer4(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                              >
                                <option value="">Select player...</option>
                                {state.players.filter(p => p.active).map(player => (
                                  <option key={player.id} value={player.id}>
                                    {player.name} (ELO: {player.eloRating})
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <button
                            onClick={generateCustomRound}
                            className="w-full py-3 bg-emerald-500/100 text-white rounded-lg hover:bg-green-600 font-bold transition-colors"
                          >
                            Create Custom Match
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Leaderboard */}
                  <div className="lg:col-span-1">
                    <Leaderboard
                      leaderboard={getLeaderboard()}
                      mode={leaderboardMode}
                      onModeChange={setLeaderboardMode}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Players Tab — management + career stats */}
          {activeTab === 'players' && (
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-bold text-slate-100 mb-4">Manage Players</h2>
                <PlayerList
                  players={state.players}
                  newPlayerName={newPlayerName}
                  newPlayerElo={newPlayerElo}
                  onNewPlayerNameChange={setNewPlayerName}
                  onNewPlayerEloChange={setNewPlayerElo}
                  onAddPlayer={addPlayer}
                  onRemovePlayer={removePlayer}
                  onEditPlayer={editPlayer}
                  onResetElo={resetPlayerElo}
                  onToggleActive={togglePlayerActive}
                  tournamentStarted={state.tournamentStarted}
                />
              </div>

              <PlayerStats players={state.players} rounds={state.rounds} />
            </div>
          )}

          {/* Rules Tab */}
          {activeTab === 'rules' && (
            <div className="prose max-w-none">
              <h2 className="text-2xl font-bold text-slate-100 mb-4">What is Padel Indiano?</h2>

              <p className="text-slate-300 mb-4">
                Padel Indiano is a dynamic tournament format where players are continuously re-paired based on their performance. Unlike traditional formats where you play with the same partner throughout, Indiano ensures everyone plays with different partners, creating a fair and social experience.
              </p>

              <h3 className="text-xl font-semibold text-slate-100 mb-3 mt-6">How It Works</h3>

              <div className="space-y-4 text-slate-300">
                <div className="bg-blue-500/10 p-4 rounded-lg">
                  <h4 className="font-semibold text-slate-200 mb-2">1. Dynamic Pairing</h4>
                  <p>Players are automatically paired each round based on their current skill level (Points Per Game). Similar-skilled players team up together, and pairs of similar combined strength play against each other.</p>
                </div>

                <div className="bg-emerald-500/10 p-4 rounded-lg">
                  <h4 className="font-semibold text-slate-200 mb-2">2. Skill-Based Matching</h4>
                  <p>The algorithm ensures competitive matches by pairing players of similar abilities while maximizing variety - you'll play with as many different partners as possible.</p>
                </div>

                <div className="bg-purple-500/10 p-4 rounded-lg">
                  <h4 className="font-semibold text-slate-200 mb-2">3. Manual Round Generation</h4>
                  <p>Click "Generate Next Round" to create new pairings based on updated standings. You can also delete entire rounds if you want to redo the matchups.</p>
                </div>

                <div className="bg-orange-500/10 p-4 rounded-lg">
                  <h4 className="font-semibold text-slate-200 mb-2">4. Fair Play Time</h4>
                  <p>With odd numbers of players, the system rotates who sits out to ensure everyone gets approximately equal court time.</p>
                </div>
              </div>

              <h3 className="text-xl font-semibold text-slate-100 mb-3 mt-6">Scoring</h3>

              <div className="bg-slate-700/30 p-4 rounded-lg mb-4">
                <h4 className="font-semibold text-slate-200 mb-2">Regular Rounds</h4>
                <ul className="list-disc list-inside space-y-2 text-slate-300">
                  <li><strong>First to X points wins</strong> - Default is 7 points (configurable in settings, range 3-21)</li>
                  <li>Example: 7-6 is a valid final score (first team to 7 wins)</li>
                  <li>Service rotates every point between teams and players</li>
                  <li>Both players in a pair earn the same points for their team's score</li>
                  <li>Rankings are based on Points Per Game (PPG) to ensure fairness regardless of how many games played</li>
                </ul>
              </div>

              <div className="bg-yellow-50 p-4 rounded-lg mb-4">
                <h4 className="font-semibold text-slate-200 mb-2">Finals</h4>
                <ul className="list-disc list-inside space-y-2 text-slate-300">
                  <li>Top 4 players form two pairs: 1st & 4th vs 2nd & 3rd</li>
                  <li>Same scoring as regular matches - first team to reach points target wins</li>
                  <li>Service rotates between teams and players each point</li>
                  <li>Winners are crowned as tournament champions</li>
                </ul>
              </div>

              <div className="bg-green-100 border-l-4 border-green-500 p-4 mt-6">
                <p className="font-semibold text-slate-200 mb-2">Pro Tip</p>
                <p className="text-slate-300">Indiano format is perfect for social play! Everyone gets to partner with different players, skill levels balance naturally, and the competition stays exciting throughout.</p>
              </div>
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-slate-100 mb-4">Tournament History</h2>

              {history.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  No history yet. Actions will appear here as you manage the tournament.
                </div>
              ) : (
                <div className="space-y-2">
                  {[...history].reverse().map((entry, idx) => (
                    <div key={idx} className="bg-slate-800/60 border border-slate-700 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-slate-200">
                            {describeHistoryEntry(entry)}
                          </span>
                          <span className="text-sm text-slate-400 ml-2">
                            {new Date(entry.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              <Settings
                settings={state.settings}
                onSettingsChange={(settings) => updateState({ settings })}
                disabled={state.tournamentStarted}
              />

              {/* Group Management */}
              <div className="bg-slate-800 rounded-lg p-6">
                <h3 className="text-xl font-bold text-slate-200 mb-4">Groups</h3>
                <p className="text-sm text-slate-400 mb-4">
                  A Group is a named set of players and their historical ELOs — save once
                  (Ctrl+S), reload it every time you play.
                </p>

                <button
                  onClick={openGroupModal}
                  disabled={state.players.length === 0}
                  className="w-full py-3 bg-emerald-500/100 text-white rounded-lg hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold mb-4"
                >
                  <Save className="w-5 h-5" />
                  Save Current Setup as Group
                </button>

                {Object.keys(groups).length === 0 ? (
                  <p className="text-slate-400 text-center py-4">No groups saved yet</p>
                ) : (
                  <div className="space-y-2">
                    {Object.values(groups)
                      .sort((a, b) => b.updatedAt - a.updatedAt)
                      .map(group => (
                        <div key={group.key} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                          <div>
                            <div className="font-semibold text-slate-200">{group.name}</div>
                            <div className="text-sm text-slate-400">
                              {group.players.length} players • updated {new Date(group.updatedAt).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleLoadGroup(group)}
                              className="px-4 py-2 bg-blue-500/100 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2 text-sm"
                            >
                              <Upload className="w-4 h-4" />
                              Load
                            </button>
                            <button
                              onClick={() => handleDeleteGroup(group.name)}
                              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Group Save Modal */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-md w-full border border-slate-700 shadow-2xl">
            <h3 className="text-2xl font-bold text-slate-100 mb-1">Save Group</h3>
            <p className="text-sm text-slate-400 mb-4">
              Stores all {state.players.length} players with their current ELOs under a one-word name.
              {state.groupName && normalizeGroupName(groupNameInput) === normalizeGroupName(state.groupName) && (
                <> Updating <span className="text-emerald-400 font-semibold">{state.groupName}</span>.</>
              )}
            </p>
            <input
              type="text"
              value={groupNameInput}
              onChange={(e) => setGroupNameInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveGroup(); }}
              placeholder="e.g. Pawri"
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-100 placeholder-slate-400 mb-2"
              autoFocus
            />
            <p className="text-xs text-slate-500 mb-4">
              One word only — letters, numbers, - or _ (max 24). Names are unique: you can't save over a different group.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleSaveGroup}
                className="flex-1 py-2 bg-emerald-500/100 text-white rounded-lg hover:bg-green-600 font-semibold"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setShowGroupModal(false);
                  setGroupNameInput('');
                }}
                className="flex-1 py-2 bg-slate-700/300 text-white rounded-lg hover:bg-gray-600 font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Court Mode for a regular match */}
      {(() => {
        if (!courtModeTarget) return null;
        const round = state.rounds.find(r => r.id === courtModeTarget.roundId);
        const match = round?.matches.find(m => m.id === courtModeTarget.matchId);
        if (!match || match.completed) return null;
        const pair1Name = match.pair1.name ?? match.pair1.players.map(p => p.name).join(' & ');
        const pair2Name = match.pair2.name ?? match.pair2.players.map(p => p.name).join(' & ');
        return (
          <CourtMode
            isOpen
            title={`Court ${match.court ?? 1}`}
            team1Name={pair1Name}
            team2Name={pair2Name}
            score1={match.score1}
            score2={match.score2}
            pointsToWin={state.settings.pointsToWin}
            winByTwo={winByTwo}
            goldenPoint={goldenPoint}
            serverName={resolveServerName(match.currentServer as ServerPosition | undefined, match.pair1, match.pair2)}
            completed={false}
            startTime={match.startTime}
            onPoint={(team, delta) => updateScore(courtModeTarget.roundId, courtModeTarget.matchId, team, delta)}
            onConfirmWin={() => completeMatch(courtModeTarget.roundId, courtModeTarget.matchId)}
            onClose={() => setCourtModeTarget(null)}
          />
        );
      })()}

      {/* Fullscreen Court Mode for the finals */}
      {state.finalsMode && state.finalsMatch && !state.finalsMatch.completed && (
        <CourtMode
          isOpen={finalsCourtOpen}
          title="🏆 Finals"
          team1Name={state.finalsMatch.pair1.name ?? state.finalsMatch.pair1.players.map(p => p.name).join(' & ')}
          team2Name={state.finalsMatch.pair2.name ?? state.finalsMatch.pair2.players.map(p => p.name).join(' & ')}
          score1={state.finalsMatch.score1}
          score2={state.finalsMatch.score2}
          pointsToWin={state.settings.pointsToWin}
          winByTwo={winByTwo}
          goldenPoint={goldenPoint}
          serverName={resolveServerName(
            state.finalsMatch.currentServer as ServerPosition | undefined,
            state.finalsMatch.pair1,
            state.finalsMatch.pair2
          )}
          completed={state.finalsMatch.completed}
          onPoint={(team, delta) => updateFinalsScore(team, delta)}
          onConfirmWin={() => completeFinalsMatch()}
          onClose={() => setFinalsCourtOpen(false)}
        />
      )}

      {/* Fullscreen spectator space for this device's session / watch links */}
      <SpectatorMode
        isOpen={spectatorOpen}
        watchKey={watchKey}
        sessionGroupName={state.groupName ?? null}
        groups={groups}
        liveBoards={liveBoards}
        leaderboard={getLeaderboard()}
        mode={leaderboardMode}
        onModeChange={setLeaderboardMode}
        restingLabel={
          (() => {
            const lastRound = state.rounds[state.rounds.length - 1];
            if (!state.tournamentStarted || !lastRound) return null;
            return lastRound.sittingOut ? `🪑 ${lastRound.sittingOut.name}` : null;
          })()
        }
        onShareWatch={handleShareWatch}
        onClose={() => {
          setSpectatorOpen(false);
          setWatchKey(null);
          if (window.location.hash) {
            window.history.replaceState(null, '', window.location.pathname);
          }
          // Spectator devices go back to the join gate instead of the admin app
          if (role === 'spectator') {
            setOnboarded(false);
          }
        }}
      />
    </div>
  );
};

export default App;
