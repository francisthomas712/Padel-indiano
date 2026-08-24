import React, { useState } from 'react';
import { Users, Plus, Trash2, ToggleLeft, ToggleRight, Pencil, Check, X } from 'lucide-react';
import { Player } from '../types';

interface PlayerListProps {
  players: Player[];
  newPlayerName: string;
  newPlayerElo: string;
  onNewPlayerNameChange: (name: string) => void;
  onNewPlayerEloChange: (elo: string) => void;
  onAddPlayer: () => void;
  onRemovePlayer: (playerId: string) => void;
  onEditPlayer: (playerId: string, name: string, elo: number) => void;
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
  onEditPlayer,
  onToggleActive,
  tournamentStarted
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftElo, setDraftElo] = useState('');

  const startEditing = (player: Player) => {
    setEditingId(player.id);
    setDraftName(player.name);
    setDraftElo(String(player.initialElo));
  };

  const saveEdit = () => {
    if (!editingId) return;
    const elo = parseInt(draftElo, 10);
    if (draftElo.trim() && (isNaN(elo) || elo < 100 || elo > 3000)) return;
    onEditPlayer(editingId, draftName, isNaN(elo) ? 1500 : elo);
    setEditingId(null);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (editingId) saveEdit();
      else onAddPlayer();
    }
  };

  return (
    <div className="mb-8">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-200">
        <Users className="w-5 h-5 text-emerald-400" />
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
            className="flex-1 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-100 placeholder-slate-400 touch-target"
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
            className="w-48 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-100 placeholder-slate-400 touch-target"
            aria-label="Initial ELO rating (optional)"
          />
          <button
            onClick={onAddPlayer}
            className="px-6 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg hover:from-emerald-600 hover:to-teal-700 flex items-center gap-2 transition-all shadow-lg hover:shadow-emerald-500/50 touch-target"
            aria-label="Add player"
        >
          <Plus className="w-4 h-4" />
          Add
        </button>
        </div>
        <p className="text-xs text-slate-400 px-1">
          Optional: Set custom starting ELO (100-3000). Leave blank for default 1500.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {players.map(player => (
          <div
            key={player.id}
            className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
              player.active
                ? 'bg-slate-700/50 border-slate-600 hover:bg-slate-700 hover:shadow-lg'
                : 'bg-slate-800/50 border-slate-700 opacity-50'
            }`}
          >
            {editingId === player.id ? (
              /* Inline edit mode */
              <div className="flex-1 flex flex-col gap-2">
                <input
                  type="text"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onKeyPress={handleKeyPress}
                  autoFocus
                  aria-label="Player name"
                  className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={draftElo}
                    onChange={(e) => setDraftElo(e.target.value)}
                    onKeyPress={handleKeyPress}
                    min="100"
                    max="3000"
                    aria-label="Player ELO"
                    className="w-24 px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <span className="text-xs text-slate-500">ELO (resets baseline)</span>
                  <div className="ml-auto flex gap-1">
                    <button
                      onClick={saveEdit}
                      disabled={!draftName.trim()}
                      className="p-1.5 text-emerald-400 hover:text-emerald-300 disabled:opacity-40 touch-target"
                      aria-label="Save changes"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="p-1.5 text-slate-400 hover:text-slate-200 touch-target"
                      aria-label="Cancel editing"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${!player.active ? 'text-slate-500' : 'text-slate-200'}`}>
                      {player.name}
                    </span>
                    {!player.active && (
                      <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded border border-orange-500/30">
                        Away
                      </span>
                    )}
                  </div>
                  {tournamentStarted && player.matchesPlayed > 0 ? (
                    <div className="text-xs text-slate-400 mt-1">
                      {player.matchesPlayed} games | {player.sitOutCount || 0} sit-outs
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 mt-1">ELO {player.eloRating}</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {tournamentStarted && (
                    <button
                      onClick={() => onToggleActive(player.id)}
                      className={`transition-all touch-target ${
                        player.active
                          ? 'text-orange-400 hover:text-orange-300'
                          : 'text-emerald-400 hover:text-emerald-300'
                      }`}
                      title={player.active ? 'Mark as away (temporarily inactive)' : 'Mark as back (active)'}
                      aria-label={player.active ? 'Mark player as away' : 'Mark player as back'}
                    >
                      {player.active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                    </button>
                  )}
                  <button
                    onClick={() => startEditing(player)}
                    className="text-slate-400 hover:text-emerald-400 transition-all touch-target"
                    title="Edit name / ELO"
                    aria-label={`Edit ${player.name}`}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onRemovePlayer(player.id)}
                    className="text-red-400 hover:text-red-300 transition-all touch-target"
                    title="Remove player"
                    aria-label={`Remove ${player.name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}
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
