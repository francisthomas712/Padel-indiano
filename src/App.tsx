import React, { useState, useCallback, useEffect } from 'react';
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
  PlusCircle
} from 'lucide-react';

// Hooks
import { useTournamentState } from './hooks/useTournamentState';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

// Components
import { PlayerList } from './components/PlayerList';
import { Leaderboard } from './components/Leaderboard';
import { MatchCard } from './components/MatchCard';
import { Settings } from './components/Settings';

// Types
import {
  Player,
  Round,
  FinalsMatch,
  LeaderboardMode,
  ActiveTab,
  PlayerWithStats
} from './types';

// Utils
import { generatePairs, matchPairs, findPlayersToSitOut } from './utils/pairingAlgorithm';
import { getPointDisplay, checkMatchWinner, getNextServer } from './utils/scoring';
import {
  exportToPDF,
  exportToJSON,
  generateTournamentReport,
  downloadTextFile,
  shareResults
} from './utils/export';
import {
  TournamentTemplate,
  saveTemplate,
  loadTemplates,
  deleteTemplate
} from './utils/localStorage';

interface EditingMatch {
  roundId: number;
  matchId: string;
}

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
  const [activeTab, setActiveTab] = useState<ActiveTab>('tournament');
  const [leaderboardMode, setLeaderboardMode] = useState<LeaderboardMode>('ppg');
  const [editingMatch, setEditingMatch] = useState<EditingMatch | null>(null);
  const [templates, setTemplates] = useState<TournamentTemplate[]>([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');

  // Load templates on mount
  useEffect(() => {
    setTemplates(loadTemplates());
  }, []);

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

    const newPlayer: Player = {
      id: Date.now().toString(),
      name: newPlayerName.trim(),
      points: 0,
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      active: true,
      sitOutCount: 0
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
    initializePlayerHistory(newPlayer.id);
    toast.success(`Added ${newPlayer.name}`);
  }, [newPlayerName, state.players, updateState, initializePlayerHistory]);

  // Remove a player (only before tournament starts)
  const removePlayer = useCallback((playerId: string) => {
    const player = state.players.find(p => p.id === playerId);
    if (!player) return;

    updateState(
      { players: state.players.filter(p => p.id !== playerId) },
      {
        type: 'player_add',
        timestamp: Date.now(),
        data: { removed: true, playerId }
      }
    );

    toast.success(`Removed ${player.name}`);
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

    toast.success(`${player.name} is now ${player.active ? 'away' : 'active'}`);
  }, [state.players, updateState]);

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

    // Generate pairs
    const pairs = generatePairs(playersToMatch, state.partnershipHistory);

    if (pairs.length < 2) {
      toast.error('Not enough players to form matches');
      return;
    }

    // Match pairs against each other
    const matches = matchPairs(pairs, state.oppositionHistory, state.rounds.length);

    if (matches.length > 0) {
      const newRound: Round = {
        id: state.rounds.length,
        matches,
        completed: false,
        sittingOut
      };

      updateState(
        { rounds: [...state.rounds, newRound] },
        {
          type: 'round_generate',
          timestamp: Date.now(),
          data: { round: newRound }
        }
      );

      toast.success(`Round ${state.rounds.length + 1} generated with ${matches.length} match${matches.length > 1 ? 'es' : ''}`);
    }
  }, [state.players, state.rounds, state.partnershipHistory, state.oppositionHistory, updateState]);

  // Start tournament
  const startTournament = useCallback(() => {
    const activePlayers = state.players.filter(p => p.active);
    if (activePlayers.length < 4) {
      toast.error('Need at least 4 active players to start tournament');
      return;
    }

    // Initialize history for all players
    state.players.forEach(p => initializePlayerHistory(p.id));

    updateState({ tournamentStarted: true });
    toast.success('Tournament started!');

    // Auto-generate first round
    setTimeout(() => {
      generateNextRound();
    }, 100);
  }, [state.players, updateState, initializePlayerHistory, generateNextRound]);

  // Update match score
  const updateScore = useCallback((roundId: number, matchId: string, team: 1 | 2, delta: number) => {
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
                score2: newScore2
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

    // Update player stats
    const updatedPlayers = [...state.players];
    const pair1PlayerIds = match.pair1.players.map(p => p.id);
    const pair2PlayerIds = match.pair2.players.map(p => p.id);

    pair1PlayerIds.forEach(playerId => {
      const player = updatedPlayers.find(p => p.id === playerId);
      if (player) {
        player.points += match.score1;
        player.matchesPlayed += 1;
        if (match.score1 > match.score2) player.wins += 1;
        else if (match.score1 < match.score2) player.losses += 1;
      }
    });

    pair2PlayerIds.forEach(playerId => {
      const player = updatedPlayers.find(p => p.id === playerId);
      if (player) {
        player.points += match.score2;
        player.matchesPlayed += 1;
        if (match.score2 > match.score1) player.wins += 1;
        else if (match.score2 < match.score1) player.losses += 1;
      }
    });

    // Update sit-out count
    if (round.sittingOut) {
      if ('players' in round.sittingOut) {
        round.sittingOut.players.forEach(p => {
          const player = updatedPlayers.find(pl => pl.id === p.id);
          if (player) player.sitOutCount = (player.sitOutCount || 0) + 1;
        });
      } else {
        const player = updatedPlayers.find(p => p.id === round.sittingOut!.id);
        if (player) player.sitOutCount = (player.sitOutCount || 0) + 1;
      }
    }

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

    // Mark match as completed
    const updatedRounds = state.rounds.map(r => {
      if (r.id === roundId) {
        const updatedMatches = r.matches.map(m =>
          m.id === matchId ? { ...m, completed: true, endTime: Date.now() } : m
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

    toast.success('Match completed!');
  }, [state, updateState]);

  // Start editing a match
  const startEditingMatch = useCallback((roundId: number, matchId: string) => {
    const round = state.rounds.find(r => r.id === roundId);
    const match = round?.matches.find(m => m.id === matchId);

    if (!round || !match || !match.completed) return;

    // Remove the match's contribution from player stats
    const updatedPlayers = [...state.players];
    const pair1PlayerIds = match.pair1.players.map(p => p.id);
    const pair2PlayerIds = match.pair2.players.map(p => p.id);

    pair1PlayerIds.forEach(playerId => {
      const player = updatedPlayers.find(p => p.id === playerId);
      if (player) {
        player.points -= match.score1;
        player.matchesPlayed -= 1;
        if (match.score1 > match.score2) player.wins -= 1;
        else if (match.score1 < match.score2) player.losses -= 1;
      }
    });

    pair2PlayerIds.forEach(playerId => {
      const player = updatedPlayers.find(p => p.id === playerId);
      if (player) {
        player.points -= match.score2;
        player.matchesPlayed -= 1;
        if (match.score2 > match.score1) player.wins -= 1;
        else if (match.score2 < match.score1) player.losses -= 1;
      }
    });

    // Remove partnership history
    const newPartnershipHistory = { ...state.partnershipHistory };
    [pair1PlayerIds, pair2PlayerIds].forEach(pairIds => {
      const [p1, p2] = pairIds;
      if (newPartnershipHistory[p1]?.[p2]) {
        newPartnershipHistory[p1][p2] = Math.max(0, newPartnershipHistory[p1][p2] - 1);
      }
      if (newPartnershipHistory[p2]?.[p1]) {
        newPartnershipHistory[p2][p1] = Math.max(0, newPartnershipHistory[p2][p1] - 1);
      }
    });

    // Remove opposition history
    const newOppositionHistory = { ...state.oppositionHistory };
    pair1PlayerIds.forEach(p1 => {
      pair2PlayerIds.forEach(p2 => {
        if (newOppositionHistory[p1]?.[p2]) {
          newOppositionHistory[p1][p2] = Math.max(0, newOppositionHistory[p1][p2] - 1);
        }
        if (newOppositionHistory[p2]?.[p1]) {
          newOppositionHistory[p2][p1] = Math.max(0, newOppositionHistory[p2][p1] - 1);
        }
      });
    });

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
      players: updatedPlayers,
      rounds: updatedRounds,
      partnershipHistory: newPartnershipHistory,
      oppositionHistory: newOppositionHistory
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
      // Remove the match's contribution from player stats (same as start editing)
      const updatedPlayers = [...state.players];
      const pair1PlayerIds = match.pair1.players.map(p => p.id);
      const pair2PlayerIds = match.pair2.players.map(p => p.id);

      pair1PlayerIds.forEach(playerId => {
        const player = updatedPlayers.find(p => p.id === playerId);
        if (player) {
          player.points -= match.score1;
          player.matchesPlayed -= 1;
          if (match.score1 > match.score2) player.wins -= 1;
          else if (match.score1 < match.score2) player.losses -= 1;
        }
      });

      pair2PlayerIds.forEach(playerId => {
        const player = updatedPlayers.find(p => p.id === playerId);
        if (player) {
          player.points -= match.score2;
          player.matchesPlayed -= 1;
          if (match.score2 > match.score1) player.wins -= 1;
          else if (match.score2 < match.score1) player.losses -= 1;
        }
      });

      // Remove partnership and opposition history
      const newPartnershipHistory = { ...state.partnershipHistory };
      [pair1PlayerIds, pair2PlayerIds].forEach(pairIds => {
        const [p1, p2] = pairIds;
        if (newPartnershipHistory[p1]?.[p2]) {
          newPartnershipHistory[p1][p2] = Math.max(0, newPartnershipHistory[p1][p2] - 1);
        }
        if (newPartnershipHistory[p2]?.[p1]) {
          newPartnershipHistory[p2][p1] = Math.max(0, newPartnershipHistory[p2][p1] - 1);
        }
      });

      const newOppositionHistory = { ...state.oppositionHistory };
      pair1PlayerIds.forEach(p1 => {
        pair2PlayerIds.forEach(p2 => {
          if (newOppositionHistory[p1]?.[p2]) {
            newOppositionHistory[p1][p2] = Math.max(0, newOppositionHistory[p1][p2] - 1);
          }
          if (newOppositionHistory[p2]?.[p1]) {
            newOppositionHistory[p2][p1] = Math.max(0, newOppositionHistory[p2][p1] - 1);
          }
        });
      });

      updateState({
        players: updatedPlayers,
        partnershipHistory: newPartnershipHistory,
        oppositionHistory: newOppositionHistory
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

    // If round has completed matches, need to reverse stats
    const completedMatches = round.matches.filter(m => m.completed);

    if (completedMatches.length > 0) {
      const updatedPlayers = [...state.players];
      const newPartnershipHistory = { ...state.partnershipHistory };
      const newOppositionHistory = { ...state.oppositionHistory };

      // Reverse stats for each completed match
      completedMatches.forEach(match => {
        const pair1PlayerIds = match.pair1.players.map(p => p.id);
        const pair2PlayerIds = match.pair2.players.map(p => p.id);

        // Reverse player stats
        pair1PlayerIds.forEach(playerId => {
          const player = updatedPlayers.find(p => p.id === playerId);
          if (player) {
            player.points -= match.score1;
            player.matchesPlayed -= 1;
            if (match.score1 > match.score2) player.wins -= 1;
            else if (match.score1 < match.score2) player.losses -= 1;
          }
        });

        pair2PlayerIds.forEach(playerId => {
          const player = updatedPlayers.find(p => p.id === playerId);
          if (player) {
            player.points -= match.score2;
            player.matchesPlayed -= 1;
            if (match.score2 > match.score1) player.wins -= 1;
            else if (match.score2 < match.score1) player.losses -= 1;
          }
        });

        // Reverse partnership history
        [pair1PlayerIds, pair2PlayerIds].forEach(pairIds => {
          const [p1, p2] = pairIds;
          if (newPartnershipHistory[p1]?.[p2]) {
            newPartnershipHistory[p1][p2] -= 1;
            if (newPartnershipHistory[p1][p2] === 0) delete newPartnershipHistory[p1][p2];
          }
          if (newPartnershipHistory[p2]?.[p1]) {
            newPartnershipHistory[p2][p1] -= 1;
            if (newPartnershipHistory[p2][p1] === 0) delete newPartnershipHistory[p2][p1];
          }
        });

        // Reverse opposition history
        pair1PlayerIds.forEach(p1 => {
          pair2PlayerIds.forEach(p2 => {
            if (newOppositionHistory[p1]?.[p2]) {
              newOppositionHistory[p1][p2] -= 1;
              if (newOppositionHistory[p1][p2] === 0) delete newOppositionHistory[p1][p2];
            }
            if (newOppositionHistory[p2]?.[p1]) {
              newOppositionHistory[p2][p1] -= 1;
              if (newOppositionHistory[p2][p1] === 0) delete newOppositionHistory[p2][p1];
            }
          });
        });
      });

      updateState({
        players: updatedPlayers,
        partnershipHistory: newPartnershipHistory,
        oppositionHistory: newOppositionHistory
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
        winRate: p.matchesPlayed > 0 ? ((p.wins / p.matchesPlayed) * 100).toFixed(1) : '0.0'
      }));

    if (leaderboardMode === 'ppg') {
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
    const leaderboard = getLeaderboard();

    if (leaderboard.length < 4) {
      toast.error('Need at least 4 players who have played matches to start finals');
      return;
    }

    const top4 = leaderboard.slice(0, 4);

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
  }, [getLeaderboard, updateState]);

  // Update finals score
  const updateFinalsScore = useCallback((team: 1 | 2, delta: number) => {
    if (!state.finalsMatch || state.finalsMatch.completed) return;

    const match = { ...state.finalsMatch };

    if (team === 1) {
      match.score1 = Math.max(0, match.score1 + delta);
    } else {
      match.score2 = Math.max(0, match.score2 + delta);
    }

    // Rotate server after point is scored (only on +1, not on -1)
    if (delta === 1) {
      match.currentServer = getNextServer(match.currentServer);
    }

    // Check for winner using new scoring system
    const winner = checkMatchWinner(match.score1, match.score2, state.settings.pointsToWin);
    if (winner) {
      match.winner = winner;
    }

    updateState({ finalsMatch: match });
  }, [state.finalsMatch, state.settings.pointsToWin, updateState]);

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

  // Template functions
  const handleSaveTemplate = useCallback(() => {
    if (!newTemplateName.trim()) {
      toast.error('Please enter a template name');
      return;
    }

    const template: TournamentTemplate = {
      id: Date.now().toString(),
      name: newTemplateName.trim(),
      players: state.players.map(p => ({ name: p.name, avatar: p.avatar })),
      settings: state.settings,
      createdAt: Date.now()
    };

    saveTemplate(template);
    setTemplates(loadTemplates());
    setNewTemplateName('');
    setShowTemplateModal(false);
    toast.success('Template saved!');
  }, [newTemplateName, state.players, state.settings]);

  const handleLoadTemplate = useCallback((template: TournamentTemplate) => {
    if (state.tournamentStarted && !window.confirm('Loading a template will reset the current tournament. Continue?')) {
      return;
    }

    const players: Player[] = template.players.map(p => ({
      id: Date.now().toString() + Math.random(),
      name: p.name,
      avatar: p.avatar,
      points: 0,
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      active: true,
      sitOutCount: 0
    }));

    updateState({
      players,
      settings: template.settings,
      rounds: [],
      tournamentStarted: false,
      partnershipHistory: {},
      oppositionHistory: {},
      finalsMode: false,
      finalsMatch: null
    });

    toast.success(`Template "${template.name}" loaded!`);
  }, [state.tournamentStarted, updateState]);

  const handleDeleteTemplate = useCallback((templateId: string) => {
    if (!window.confirm('Delete this template?')) return;
    deleteTemplate(templateId);
    setTemplates(loadTemplates());
    toast.success('Template deleted');
  }, []);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onUndo: canUndo ? undo : undefined,
    onRedo: canRedo ? redo : undefined,
    onSave: () => setShowTemplateModal(true)
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-4">
      <Toaster position="top-right" />

      <div className="max-w-7xl mx-auto" id="tournament-container">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-500 rounded-xl">
                <Trophy className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">Padel Indiano</h1>
                <p className="text-gray-600">Dynamic skill-based pairing</p>
              </div>
            </div>

            {/* Undo/Redo buttons */}
            <div className="flex gap-2">
              <button
                onClick={undo}
                disabled={!canUndo}
                className="p-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Undo (Ctrl+Z)"
              >
                <Undo className="w-5 h-5" />
              </button>
              <button
                onClick={redo}
                disabled={!canRedo}
                className="p-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Redo (Ctrl+Shift+Z)"
              >
                <Redo className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2 mb-6 border-b border-gray-200 flex-wrap">
            {(['tournament', 'rules', 'history', 'settings'] as ActiveTab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 font-semibold transition-colors capitalize ${
                  activeTab === tab
                    ? 'text-green-600 border-b-2 border-green-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tournament Tab */}
          {activeTab === 'tournament' && (
            <div>
              {/* Player Management */}
              <PlayerList
                players={state.players}
                newPlayerName={newPlayerName}
                onNewPlayerNameChange={setNewPlayerName}
                onAddPlayer={addPlayer}
                onRemovePlayer={removePlayer}
                onToggleActive={togglePlayerActive}
                tournamentStarted={state.tournamentStarted}
              />

              {/* Tournament Controls */}
              {!state.tournamentStarted && state.players.filter(p => p.active).length >= 4 && (
                <div className="flex gap-3 mb-6">
                  <button
                    onClick={startTournament}
                    className="flex-1 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center justify-center gap-2 font-semibold transition-colors"
                  >
                    <Play className="w-5 h-5" />
                    Start Tournament
                  </button>
                  <button
                    onClick={() => setShowTemplateModal(true)}
                    className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 flex items-center gap-2 font-semibold transition-colors"
                    title="Save as template (Ctrl+S)"
                  >
                    <Save className="w-5 h-5" />
                  </button>
                </div>
              )}

              {state.tournamentStarted && !state.finalsMode && (
                <div className="space-y-3 mb-6">
                  <div className="flex gap-3 flex-wrap">
                    <button
                      onClick={generateNextRound}
                      className="flex-1 min-w-[200px] py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center justify-center gap-2 font-semibold transition-colors"
                    >
                      <PlusCircle className="w-5 h-5" />
                      Generate Next Round
                    </button>
                    <button
                      onClick={initiateFinals}
                      disabled={getLeaderboard().length < 4}
                      className="flex-1 min-w-[200px] py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold transition-colors"
                    >
                      <Trophy className="w-5 h-5" />
                      Initiate Finals
                    </button>
                    <button
                      onClick={resetTournament}
                      className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 flex items-center justify-center gap-2 font-semibold transition-colors"
                    >
                      <RotateCcw className="w-5 h-5" />
                      Reset
                    </button>
                  </div>

                  {/* Export buttons */}
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={handleExportPDF}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center gap-2 text-sm transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Export PDF
                    </button>
                    <button
                      onClick={handleExportJSON}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2 text-sm transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Export JSON
                    </button>
                    <button
                      onClick={handleExportReport}
                      className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 flex items-center gap-2 text-sm transition-colors"
                    >
                      <FileText className="w-4 h-4" />
                      Text Report
                    </button>
                    <button
                      onClick={handleShare}
                      className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center gap-2 text-sm transition-colors"
                    >
                      <Share2 className="w-4 h-4" />
                      Share
                    </button>
                  </div>
                </div>
              )}

              {/* Finals Match */}
              {state.finalsMode && state.finalsMatch && (
                <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
                      <Trophy className="w-8 h-8 text-yellow-500" />
                      FINALS - Single Game
                    </h2>
                    {state.finalsMatch.winner && !state.finalsMatch.completed && (
                      <span className="px-4 py-2 bg-yellow-100 text-yellow-700 rounded-full font-semibold">
                        Game Complete - Click "Complete Match"
                      </span>
                    )}
                    {state.finalsMatch.completed && (
                      <span className="px-4 py-2 bg-green-100 text-green-700 rounded-full font-semibold">
                        Match Complete
                      </span>
                    )}
                  </div>

                  {!state.finalsMatch.completed && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Match Display */}
                      <div className="space-y-4">

                        {/* Score Display */}
                        <div>
                          <h3 className="text-sm font-semibold text-gray-600 mb-3 text-center">SCORE</h3>

                          <div className="flex items-center justify-between p-6 bg-blue-50 rounded-lg border-2 border-blue-300 mb-3">
                            <div>
                              <div className="font-bold text-xl text-gray-800">{state.finalsMatch.pair1.players[0].name}</div>
                              <div className="font-bold text-xl text-gray-800">{state.finalsMatch.pair1.players[1].name}</div>
                            </div>
                            <div className="text-6xl font-bold text-blue-600">
                              {getPointDisplay(state.finalsMatch.score1, state.finalsMatch.score2).p1}
                            </div>
                          </div>

                          <div className="text-center text-2xl font-bold text-gray-400 my-2">VS</div>

                          <div className="flex items-center justify-between p-6 bg-orange-50 rounded-lg border-2 border-orange-300">
                            <div>
                              <div className="font-bold text-xl text-gray-800">{state.finalsMatch.pair2.players[0].name}</div>
                              <div className="font-bold text-xl text-gray-800">{state.finalsMatch.pair2.players[1].name}</div>
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
                        <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
                          <h4 className="font-semibold text-gray-800 mb-4 text-center text-lg">Pair 1 Score</h4>
                          <div className="flex gap-3 justify-center">
                            <button
                              onClick={() => updateFinalsScore(1, 1)}
                              disabled={!!state.finalsMatch.winner}
                              className="px-8 py-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-bold text-lg transition-colors"
                            >
                              + Point
                            </button>
                            <button
                              onClick={() => updateFinalsScore(1, -1)}
                              disabled={!!state.finalsMatch.winner}
                              className="px-8 py-4 bg-gray-400 text-white rounded-lg hover:bg-gray-500 disabled:bg-gray-300 disabled:cursor-not-allowed font-bold text-lg transition-colors"
                            >
                              - Point
                            </button>
                          </div>
                        </div>

                        <div className="bg-orange-50 p-6 rounded-lg border border-orange-200">
                          <h4 className="font-semibold text-gray-800 mb-4 text-center text-lg">Pair 2 Score</h4>
                          <div className="flex gap-3 justify-center">
                            <button
                              onClick={() => updateFinalsScore(2, 1)}
                              disabled={!!state.finalsMatch.winner}
                              className="px-8 py-4 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-bold text-lg transition-colors"
                            >
                              + Point
                            </button>
                            <button
                              onClick={() => updateFinalsScore(2, -1)}
                              disabled={!!state.finalsMatch.winner}
                              className="px-8 py-4 bg-gray-400 text-white rounded-lg hover:bg-gray-500 disabled:bg-gray-300 disabled:cursor-not-allowed font-bold text-lg transition-colors"
                            >
                              - Point
                            </button>
                          </div>
                        </div>

                        {state.finalsMatch.winner && (
                          <button
                            onClick={completeFinalsMatch}
                            className="w-full py-4 bg-green-500 text-white rounded-lg hover:bg-green-600 font-bold text-lg transition-colors flex items-center justify-center gap-2"
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
                        <h2 className="text-4xl font-bold text-gray-800 mb-2">TOURNAMENT CHAMPIONS</h2>
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
              )}

              {/* Rounds and Matches */}
              {state.tournamentStarted && state.rounds.length > 0 && !state.finalsMode && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 space-y-6">
                    {state.rounds.map((round, idx) => (
                      <div key={round.id} className="bg-white rounded-2xl shadow-xl p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h3 className="text-2xl font-bold text-gray-800">Round {idx + 1}</h3>
                            {round.sittingOut && (
                              <p className="text-sm text-orange-600 mt-1">
                                Sitting out: {round.sittingOut.name}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            {round.completed && (
                              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                                Completed
                              </span>
                            )}
                            <button
                              onClick={() => deleteRound(round.id)}
                              className="px-3 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium"
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
                              onScoreUpdate={updateScore}
                              onComplete={completeMatch}
                              onEdit={startEditingMatch}
                              onDelete={deleteMatch}
                              onSaveEdit={saveEditedMatch}
                              onCancelEdit={cancelEditingMatch}
                              isEditing={editingMatch?.roundId === round.id && editingMatch?.matchId === match.id}
                            />
                          ))}
                        </div>
                      </div>
                    ))}

                    {/* Generate Next Round Button */}
                    <div className="bg-white rounded-2xl shadow-xl p-6">
                      <button
                        onClick={generateNextRound}
                        className="w-full py-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-bold text-lg transition-colors flex items-center justify-center gap-2"
                      >
                        <Plus className="w-5 h-5" />
                        Generate Next Round
                      </button>
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

          {/* Rules Tab */}
          {activeTab === 'rules' && (
            <div className="prose max-w-none">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">What is Padel Indiano?</h2>

              <p className="text-gray-700 mb-4">
                Padel Indiano is a dynamic tournament format where players are continuously re-paired based on their performance. Unlike traditional formats where you play with the same partner throughout, Indiano ensures everyone plays with different partners, creating a fair and social experience.
              </p>

              <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">How It Works</h3>

              <div className="space-y-4 text-gray-700">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-gray-800 mb-2">1. Dynamic Pairing</h4>
                  <p>Players are automatically paired each round based on their current skill level (Points Per Game). Similar-skilled players team up together, and pairs of similar combined strength play against each other.</p>
                </div>

                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-gray-800 mb-2">2. Skill-Based Matching</h4>
                  <p>The algorithm ensures competitive matches by pairing players of similar abilities while maximizing variety - you'll play with as many different partners as possible.</p>
                </div>

                <div className="bg-purple-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-gray-800 mb-2">3. Manual Round Generation</h4>
                  <p>Click "Generate Next Round" to create new pairings based on updated standings. You can also delete entire rounds if you want to redo the matchups.</p>
                </div>

                <div className="bg-orange-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-gray-800 mb-2">4. Fair Play Time</h4>
                  <p>With odd numbers of players, the system rotates who sits out to ensure everyone gets approximately equal court time.</p>
                </div>
              </div>

              <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">Scoring</h3>

              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <h4 className="font-semibold text-gray-800 mb-2">Regular Rounds</h4>
                <ul className="list-disc list-inside space-y-2 text-gray-700">
                  <li><strong>First to X points wins</strong> - Default is 7 points (configurable in settings, range 3-21)</li>
                  <li>Example: 7-6 is a valid final score (first team to 7 wins)</li>
                  <li>Service rotates every point between teams and players</li>
                  <li>Both players in a pair earn the same points for their team's score</li>
                  <li>Rankings are based on Points Per Game (PPG) to ensure fairness regardless of how many games played</li>
                </ul>
              </div>

              <div className="bg-yellow-50 p-4 rounded-lg mb-4">
                <h4 className="font-semibold text-gray-800 mb-2">Finals</h4>
                <ul className="list-disc list-inside space-y-2 text-gray-700">
                  <li>Top 4 players form two pairs: 1st & 4th vs 2nd & 3rd</li>
                  <li>Same scoring as regular matches - first team to reach points target wins</li>
                  <li>Service rotates between teams and players each point</li>
                  <li>Winners are crowned as tournament champions</li>
                </ul>
              </div>

              <div className="bg-green-100 border-l-4 border-green-500 p-4 mt-6">
                <p className="font-semibold text-gray-800 mb-2">Pro Tip</p>
                <p className="text-gray-700">Indiano format is perfect for social play! Everyone gets to partner with different players, skill levels balance naturally, and the competition stays exciting throughout.</p>
              </div>
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Tournament History</h2>

              {history.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  No history yet. Actions will appear here as you manage the tournament.
                </div>
              ) : (
                <div className="space-y-2">
                  {[...history].reverse().map((entry, idx) => (
                    <div key={idx} className="bg-white p-4 rounded-lg border border-gray-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-gray-800 capitalize">
                            {entry.type.replace('_', ' ')}
                          </span>
                          <span className="text-sm text-gray-500 ml-2">
                            {new Date(entry.timestamp).toLocaleString()}
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

              {/* Template Management */}
              <div className="bg-white rounded-lg p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Templates</h3>

                <button
                  onClick={() => setShowTemplateModal(true)}
                  className="w-full py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center justify-center gap-2 font-semibold mb-4"
                >
                  <Save className="w-5 h-5" />
                  Save Current Setup as Template
                </button>

                {templates.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No templates saved yet</p>
                ) : (
                  <div className="space-y-2">
                    {templates.map(template => (
                      <div key={template.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <div className="font-semibold text-gray-800">{template.name}</div>
                          <div className="text-sm text-gray-500">
                            {template.players.length} players • {new Date(template.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleLoadTemplate(template)}
                            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2 text-sm"
                          >
                            <Upload className="w-4 h-4" />
                            Load
                          </button>
                          <button
                            onClick={() => handleDeleteTemplate(template.id)}
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

      {/* Template Save Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-2xl font-bold text-gray-800 mb-4">Save Template</h3>
            <input
              type="text"
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
              placeholder="Template name"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 mb-4"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={handleSaveTemplate}
                className="flex-1 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-semibold"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setShowTemplateModal(false);
                  setNewTemplateName('');
                }}
                className="flex-1 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
