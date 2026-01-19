import React from 'react';
import { Match } from '../types';
import { getMatchDuration } from '../utils/scoring';
import { calculatePairRating, calculatePointMultiplier } from '../utils/elo';

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

  // Calculate ELO-based point multipliers
  const pair1Elo = calculatePairRating(
    match.pair1.players[0].eloRating,
    match.pair1.players[1].eloRating
  );
  const pair2Elo = calculatePairRating(
    match.pair2.players[0].eloRating,
    match.pair2.players[1].eloRating
  );

  const pair1Multiplier = calculatePointMultiplier(pair1Elo, pair2Elo);
  const pair2Multiplier = calculatePointMultiplier(pair2Elo, pair1Elo);

  // Use stored weighted points if available (from when match was completed)
  // Otherwise calculate from current ELO ratings
  const pair1WeightedPoints = match.weightedPoints1 ?? Math.round(match.score1 * pair1Multiplier * 10) / 10;
  const pair2WeightedPoints = match.weightedPoints2 ?? Math.round(match.score2 * pair2Multiplier * 10) / 10;

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

      {/* ELO Info and Point Multipliers */}
      <div className="mt-3 pt-3 border-t border-gray-200">
        <div className="grid grid-cols-3 gap-2 text-xs">
          {/* Pair 1 Info */}
          <div className="text-left">
            <div className="text-gray-600">ELO: {Math.round(pair1Elo)}</div>
            <div className={`font-semibold ${pair1Multiplier > 1.0 ? 'text-green-600' : pair1Multiplier < 1.0 ? 'text-orange-600' : 'text-gray-600'}`}>
              {pair1Multiplier.toFixed(2)}x points
            </div>
            {match.completed && (
              <div className="text-gray-700 font-medium mt-1">
                {match.score1} → {pair1WeightedPoints} pts
              </div>
            )}
          </div>

          {/* Center - Match Quality Indicator */}
          <div className="text-center text-gray-500">
            {Math.abs(pair1Elo - pair2Elo) < 50 ? (
              <span className="text-green-600 font-semibold">Balanced</span>
            ) : Math.abs(pair1Elo - pair2Elo) < 150 ? (
              <span className="text-yellow-600">Fair</span>
            ) : (
              <span className="text-orange-600">Unbalanced</span>
            )}
          </div>

          {/* Pair 2 Info */}
          <div className="text-right">
            <div className="text-gray-600">ELO: {Math.round(pair2Elo)}</div>
            <div className={`font-semibold ${pair2Multiplier > 1.0 ? 'text-green-600' : pair2Multiplier < 1.0 ? 'text-orange-600' : 'text-gray-600'}`}>
              {pair2Multiplier.toFixed(2)}x points
            </div>
            {match.completed && (
              <div className="text-gray-700 font-medium mt-1">
                {match.score2} → {pair2WeightedPoints} pts
              </div>
            )}
          </div>
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
