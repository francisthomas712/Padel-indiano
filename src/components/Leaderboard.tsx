import React from 'react';
import { Trophy } from 'lucide-react';
import { PlayerWithStats, LeaderboardMode } from '../types';

interface LeaderboardProps {
  leaderboard: PlayerWithStats[];
  mode: LeaderboardMode;
  onModeChange: (mode: LeaderboardMode) => void;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({
  leaderboard,
  mode,
  onModeChange
}) => {
  return (
    <div className="bg-white rounded-2xl shadow-xl p-6 sticky top-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Trophy className="w-6 h-6 text-yellow-500" />
          Leaderboard
        </h3>
      </div>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => onModeChange('elo')}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors touch-target ${
            mode === 'elo'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
          aria-pressed={mode === 'elo'}
        >
          ELO
        </button>
        <button
          onClick={() => onModeChange('ppg')}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors touch-target ${
            mode === 'ppg'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
          aria-pressed={mode === 'ppg'}
        >
          PPG
        </button>
        <button
          onClick={() => onModeChange('total')}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors touch-target ${
            mode === 'total'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
          aria-pressed={mode === 'total'}
        >
          Points
        </button>
      </div>

      <div className="space-y-2" role="list" aria-label="Player rankings">
        {leaderboard.map((player, idx) => (
          <div
            key={player.id}
            role="listitem"
            className={`p-3 rounded-lg ${
              !player.active
                ? 'bg-gray-100 border border-gray-300 opacity-75'
                : idx === 0
                ? 'bg-gradient-to-r from-yellow-100 to-yellow-50 border-2 border-yellow-400'
                : idx === 1
                ? 'bg-gradient-to-r from-gray-100 to-gray-50 border-2 border-gray-400'
                : idx === 2
                ? 'bg-gradient-to-r from-orange-100 to-orange-50 border-2 border-orange-400'
                : 'bg-gray-50 border border-gray-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`text-xl font-bold ${
                    !player.active ? 'text-gray-400' :
                    idx === 0 ? 'text-yellow-600' :
                    idx === 1 ? 'text-gray-600' :
                    idx === 2 ? 'text-orange-600' :
                    'text-gray-500'
                  }`}
                  aria-label={`Rank ${idx + 1}`}
                >
                  #{idx + 1}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold ${!player.active ? 'text-gray-500' : ''}`}>
                      {player.name}
                    </span>
                    {!player.active && (
                      <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded">
                        Away
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-600">
                    {player.matchesPlayed} games | {player.wins}W-{player.losses}L ({player.winRate}%)
                    {player.sitOutCount > 0 && ` | ${player.sitOutCount} sit-out${player.sitOutCount > 1 ? 's' : ''}`}
                  </div>
                  {mode === 'elo' ? (
                    <div className="text-xs text-gray-500">
                      {player.ppg} PPG | {player.points.toFixed(1)} pts
                    </div>
                  ) : mode === 'ppg' ? (
                    <div className="text-xs text-gray-500">
                      ELO {player.eloRating} | {player.points.toFixed(1)} pts
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500">
                      ELO {player.eloRating} | {player.ppg} PPG
                    </div>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className={`text-2xl font-bold ${!player.active ? 'text-gray-400' : 'text-gray-800'}`}>
                  {mode === 'elo' ? player.eloRating : mode === 'ppg' ? player.ppg : player.points.toFixed(1)}
                </div>
                <div className="text-xs text-gray-500 font-medium">
                  {mode === 'elo' ? 'ELO' : mode === 'ppg' ? 'PPG' : 'PTS'}
                </div>
              </div>
            </div>
          </div>
        ))}
        {leaderboard.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            No matches completed yet
          </div>
        )}
      </div>
    </div>
  );
};
