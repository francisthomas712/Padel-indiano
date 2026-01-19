export interface Player {
  id: string;
  name: string;
  points: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  active: boolean;
  sitOutCount: number;
  avatar?: string;
  eloRating: number;      // Current ELO rating for matchmaking and skill tracking
  initialElo: number;     // Starting ELO rating (typically 1500)
}

export interface Pair {
  id: string;
  players: Player[];
  avgSkill?: number;
  name?: string;
}

export interface Match {
  id: string;
  pair1: Pair;
  pair2: Pair;
  score1: number;
  score2: number;
  completed: boolean;
  startTime?: number;
  endTime?: number;
  currentServer?: 'pair1-p1' | 'pair1-p2' | 'pair2-p1' | 'pair2-p2';
}

export interface Round {
  id: number;
  matches: Match[];
  completed: boolean;
  sittingOut: Player | { id: string; name: string; players: Player[] } | null;
}

export interface FinalsMatch {
  id: string;
  pair1: Pair;
  pair2: Pair;
  score1: number;
  score2: number;
  winner: number | null;
  completed: boolean;
  currentServer?: 'pair1-p1' | 'pair1-p2' | 'pair2-p1' | 'pair2-p2';
}

export interface PlayerWithStats extends Player {
  ppg: string;
  winRate: string;
}

export interface PartnershipHistory {
  [playerId: string]: {
    [partnerId: string]: number;
  };
}

export interface OppositionHistory {
  [playerId: string]: {
    [opponentId: string]: number;
  };
}

export interface TournamentSettings {
  pointsToWin: number;
  finalsFormat: 'traditional' | 'semifinal';
}

export interface TournamentState {
  players: Player[];
  rounds: Round[];
  tournamentStarted: boolean;
  partnershipHistory: PartnershipHistory;
  oppositionHistory: OppositionHistory;
  finalsMode: boolean;
  finalsMatch: FinalsMatch | null;
  settings: TournamentSettings;
}

export interface HistoryEntry {
  type: 'score_update' | 'match_complete' | 'match_delete' | 'player_add' | 'player_toggle' | 'round_generate';
  timestamp: number;
  data: any;
  previousState?: Partial<TournamentState>;
}

export type LeaderboardMode = 'ppg' | 'total' | 'elo';

export type ActiveTab = 'tournament' | 'rules' | 'history' | 'settings';
