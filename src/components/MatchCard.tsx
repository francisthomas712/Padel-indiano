import React from 'react';
import { Match } from '../types';
import { getMatchDuration } from '../utils/scoring';

interface MatchCardProps {
  match: Match;
  roundId: number;
  onScoreUpdate: (roundId: number, matchId: string, team: 1 | 2, delta: number) => void;
  onComplete: (roundId: number, matchId: string) => void;
  onEdit: (roundId: number, matchId: string) => void;
  onDelete: (roundId: number, matchId: string) => void;
  onSaveEdit: (roundId: number, matchId: string) => void;
  onCancelEdit: (roundId: number, matchId: string) => void;
  isEditing: boolean;
}

export const MatchCard: React.FC<MatchCardProps> = ({
  match,
  roundId,
  onScoreUpdate,
  onComplete,
  onEdit,
  onDelete,
  onSaveEdit,
  onCancelEdit,
  isEditing
}) => {
  const isDisabled = match.completed && !isEditing;

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
      <div className="grid grid-cols-3 gap-4 items-center">
        {/* Pair 1 */}
        <div className="space-y-1">
          {match.pair1.players.map(player => (
            <div
              key={player.id}
              className={`font-medium ${!player.active ? 'text-gray-400 line-through' : 'text-gray-700'}`}
            >
              {player.name}
            </div>
          ))}
        </div>

        {/* Score */}
        <div className="flex items-center justify-center gap-4">
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={() => onScoreUpdate(roundId, match.id, 1, 1)}
              disabled={isDisabled}
              className="w-12 h-12 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-bold transition-colors touch-target"
              aria-label="Add point to team 1"
            >
              +
            </button>
            <div className="text-3xl font-bold text-gray-800" aria-label={`Team 1 score: ${match.score1}`}>
              {match.score1}
            </div>
            <button
              onClick={() => onScoreUpdate(roundId, match.id, 1, -1)}
              disabled={isDisabled}
              className="w-12 h-12 bg-gray-400 text-white rounded-lg hover:bg-gray-500 disabled:bg-gray-300 disabled:cursor-not-allowed font-bold transition-colors touch-target"
              aria-label="Remove point from team 1"
            >
              -
            </button>
          </div>

          <div className="text-2xl font-bold text-gray-400">:</div>

          <div className="flex flex-col items-center gap-1">
            <button
              onClick={() => onScoreUpdate(roundId, match.id, 2, 1)}
              disabled={isDisabled}
              className="w-12 h-12 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-bold transition-colors touch-target"
              aria-label="Add point to team 2"
            >
              +
            </button>
            <div className="text-3xl font-bold text-gray-800" aria-label={`Team 2 score: ${match.score2}`}>
              {match.score2}
            </div>
            <button
              onClick={() => onScoreUpdate(roundId, match.id, 2, -1)}
              disabled={isDisabled}
              className="w-12 h-12 bg-gray-400 text-white rounded-lg hover:bg-gray-500 disabled:bg-gray-300 disabled:cursor-not-allowed font-bold transition-colors touch-target"
              aria-label="Remove point from team 2"
            >
              -
            </button>
          </div>
        </div>

        {/* Pair 2 */}
        <div className="space-y-1 text-right">
          {match.pair2.players.map(player => (
            <div
              key={player.id}
              className={`font-medium ${!player.active ? 'text-gray-400 line-through' : 'text-gray-700'}`}
            >
              {player.name}
            </div>
          ))}
        </div>
      </div>

      {/* Match Duration */}
      {match.startTime && (
        <div className="text-xs text-gray-500 text-center mt-2">
          Duration: {getMatchDuration(match.startTime, match.endTime)}
        </div>
      )}

      {/* Match Actions */}
      {!match.completed && (
        <button
          onClick={() => onComplete(roundId, match.id)}
          className="w-full mt-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium transition-colors touch-target"
        >
          Complete Match
        </button>
      )}

      {match.completed && !isEditing && (
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => onEdit(roundId, match.id)}
            className="flex-1 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium transition-colors touch-target"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(roundId, match.id)}
            className="flex-1 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium transition-colors touch-target"
          >
            Delete
          </button>
        </div>
      )}

      {match.completed && isEditing && (
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => onSaveEdit(roundId, match.id)}
            className="flex-1 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium transition-colors touch-target"
          >
            Save
          </button>
          <button
            onClick={() => onCancelEdit(roundId, match.id)}
            className="flex-1 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-medium transition-colors touch-target"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};
