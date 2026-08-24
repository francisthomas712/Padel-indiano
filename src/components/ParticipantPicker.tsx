import React from 'react';
import { UserCheck, UserX } from 'lucide-react';
import { Player } from '../types';

interface ParticipantPickerProps {
  players: Player[];
  tournamentStarted: boolean;
  onToggleActive: (playerId: string) => void;
}

/**
 * Compact participation strip for the Tournament tab.
 * Before start: tap chips to select who's playing today.
 * During: same chips toggle who's here vs away (away players are skipped
 * when new rounds are generated).
 */
export const ParticipantPicker: React.FC<ParticipantPickerProps> = ({
  players,
  tournamentStarted,
  onToggleActive
}) => {
  const activeCount = players.filter(p => p.active).length;

  return (
    <div className="mb-6 bg-slate-800/50 rounded-xl border border-slate-700 p-4">
      <div className="flex items-baseline justify-between gap-3 mb-3 flex-wrap">
        <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          {tournamentStarted ? (
            <>Who's here? <span className="text-slate-400 font-normal">({activeCount} playing)</span></>
          ) : (
            <>Playing today? <span className="text-slate-400 font-normal">({activeCount} selected)</span></>
          )}
        </h3>
        <span className="text-xs text-slate-500">
          {tournamentStarted
            ? 'Tap to mark away/back — away players sit out new rounds'
            : 'Tap names to include/exclude · full roster in Players tab'}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {players.map(player => (
          <button
            key={player.id}
            onClick={() => onToggleActive(player.id)}
            aria-pressed={player.active}
            aria-label={
              tournamentStarted
                ? `${player.active ? 'Mark ' : 'Mark back '}${player.name}`
                : `${player.active ? 'Exclude ' : 'Include '}${player.name}`
            }
            className={`inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full border text-sm font-semibold transition-all touch-target ${
              player.active
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                : tournamentStarted
                ? 'bg-orange-500/10 border-orange-500/30 text-orange-400'
                : 'bg-slate-900 border-slate-700 text-slate-500'
            }`}
          >
            {player.active
              ? <UserCheck className="w-3.5 h-3.5" />
              : <UserX className="w-3.5 h-3.5" />}
            {player.name}
            <span className="text-xs font-normal opacity-70">{player.eloRating}</span>
          </button>
        ))}
      </div>

      {!tournamentStarted && activeCount < 4 && (
        <p className="text-amber-500 text-xs mt-3" role="alert">
          Select at least 4 players to start the tournament
        </p>
      )}
    </div>
  );
};
