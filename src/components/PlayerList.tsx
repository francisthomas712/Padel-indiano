import React from 'react';
import { Users, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { Player } from '../types';

interface PlayerListProps {
  players: Player[];
  newPlayerName: string;
  newPlayerElo: string;
  onNewPlayerNameChange: (name: string) => void;
  onNewPlayerEloChange: (elo: string) => void;
  onAddPlayer: () => void;
  onRemovePlayer: (playerId: string) => void;
  onToggleActive: (playerId: string) => void;
  tournamentStarted: boolean;
}

export const PlayerList: React.FC<PlayerListProps> = ({
  players,
  newPlayerName,
  newPlayerElo,
  onNewPlayerNameChange,
  onNewPlayerEloChange,
  onAddPlayer,
  onRemovePlayer,
  onToggleActive,
  tournamentStarted
}) => {
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onAddPlayer();
    }
  };

  return (
    <div className="mb-8">
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <Users className="w-5 h-5" />
        Players ({players.filter(p => p.active).length} active)
      </h2>

      <div className="space-y-2 mb-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={newPlayerName}
            onChange={(e) => onNewPlayerNameChange(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Enter player name"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 touch-target"
            aria-label="New player name"
          />
          <input
            type="number"
            value={newPlayerElo}
            onChange={(e) => onNewPlayerEloChange(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="ELO (optional, default 1500)"
            min="100"
            max="3000"
            className="w-48 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 touch-target"
            aria-label="Initial ELO rating (optional)"
          />
          <button
            onClick={onAddPlayer}
            className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center gap-2 transition-colors touch-target"
            aria-label="Add player"
        >
          <Plus className="w-4 h-4" />
          Add
        </button>
        </div>
        <p className="text-xs text-gray-500 px-1">
          Optional: Set custom starting ELO (100-3000). Leave blank for default 1500.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {players.map(player => (
          <div
            key={player.id}
            className={`flex items-center justify-between p-3 rounded-lg border ${
              player.active
                ? 'bg-gray-50 border-gray-200'
                : 'bg-gray-100 border-gray-300 opacity-60'
            }`}
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className={`font-medium ${!player.active ? 'text-gray-500' : ''}`}>
                  {player.name}
                </span>
                {!player.active && (
                  <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded">
                    Away
                  </span>
                )}
              </div>
              {tournamentStarted && player.matchesPlayed > 0 && (
                <div className="text-xs text-gray-500 mt-1">
                  {player.matchesPlayed} games | {player.sitOutCount || 0} sit-outs
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {tournamentStarted ? (
                <button
                  onClick={() => onToggleActive(player.id)}
                  className={`transition-colors touch-target ${
                    player.active
                      ? 'text-orange-500 hover:text-orange-700'
                      : 'text-green-500 hover:text-green-700'
                  }`}
                  title={player.active ? 'Mark as away (temporarily inactive)' : 'Mark as back (active)'}
                  aria-label={player.active ? 'Mark player as away' : 'Mark player as back'}
                >
                  {player.active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                </button>
              ) : (
                <button
                  onClick={() => onRemovePlayer(player.id)}
                  className="text-red-500 hover:text-red-700 transition-colors touch-target"
                  title="Remove player"
                  aria-label={`Remove ${player.name}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {players.filter(p => p.active).length < 4 && (
        <p className="text-amber-600 mt-3 text-sm" role="alert">
          Add at least 4 active players to start the tournament
        </p>
      )}

      {tournamentStarted && (
        <p className="text-blue-600 mt-3 text-sm">
          💡 Players are dynamically paired each round based on skill level. Toggle players away (orange) when they take breaks - they'll be automatically skipped in new rounds.
        </p>
      )}
    </div>
  );
};
