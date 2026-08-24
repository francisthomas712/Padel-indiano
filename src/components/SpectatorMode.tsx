import React, { useEffect } from 'react';
import { X, Radio } from 'lucide-react';
import { Leaderboard } from './Leaderboard';
import { PlayerWithStats, LeaderboardMode } from '../types';
import { Group } from '../utils/groups';

/** One live match rendered as a big courtside scoreboard card. */
export interface LiveScoreboard {
  id: string;
  title: string;
  team1Name: string;
  team2Name: string;
  score1: number;
  score2: number;
  pointsToWin: number;
  serverName: string | null;
}

interface SpectatorModeProps {
  isOpen: boolean;
  onClose: () => void;
  /** Deep-link watch target (#/watch/<name>), lowercased group key */
  watchKey: string | null;
  /** Name of the group saved for the session running on this device */
  sessionGroupName: string | null;
  /** All saved groups on this device (for the switcher + roster fallback) */
  groups: Record<string, Group>;
  /** Live, in-progress matches on this device */
  liveBoards: LiveScoreboard[];
  leaderboard: PlayerWithStats[];
  mode: LeaderboardMode;
  onModeChange: (mode: LeaderboardMode) => void;
  restingLabel: string | null;
  onShareWatch: (groupName: string) => void;
}

/**
 * Fullscreen spectator space. Every Group gets a dedicated one-word address:
 * open `…/#/watch/Pawri` to watch live scores; the same page falls back to
 * the group's saved ELO roster when no live session is running.
 *
 * Note: this app is offline-first with no backend, so "live" means live *on
 * this device* — the natural courtside setup is propping the organizer's
 * phone/tablet up where players can see it.
 */
export const SpectatorMode: React.FC<SpectatorModeProps> = ({
  isOpen,
  onClose,
  watchKey,
  sessionGroupName,
  groups,
  liveBoards,
  leaderboard,
  mode,
  onModeChange,
  restingLabel,
  onShareWatch
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const watchGroup = watchKey ? groups[watchKey] : null;
  const headlineGroup = watchGroup?.name ?? sessionGroupName;
  const hasLiveSession = leaderboard.length > 0 || liveBoards.length > 0;

  // Roster fallback: group saved but no live session on this device
  const roster = watchGroup
    ? [...watchGroup.players].sort((a, b) => b.eloRating - a.eloRating)
    : [];

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={`Spectator view${headlineGroup ? ` for ${headlineGroup}` : ''}`}
    >
      <div className="max-w-3xl mx-auto p-4 pt-6 pb-12">
        {/* Header */}
        <div className="flex items-start justify-between mb-4 gap-3">
          <div>
            <h2 className="text-4xl font-black bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
              {headlineGroup ?? 'Standings'}
            </h2>
            <p className="text-slate-400 text-sm flex items-center gap-2 mt-1">
              {liveBoards.length > 0 ? (
                <>
                  <Radio className="w-4 h-4 text-red-400 animate-pulse" />
                  Live now — {liveBoards.length} match{liveBoards.length > 1 ? 'es' : ''} in progress
                </>
              ) : hasLiveSession ? (
                'Tournament in progress'
              ) : watchGroup ? (
                `Saved group · ${roster.length} players`
              ) : watchKey ? (
                'Waiting for a live session…'
              ) : (
                'Live tournament leaderboard'
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 bg-slate-800 text-slate-300 rounded-full hover:bg-slate-700 touch-target"
            aria-label="Close spectator view"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Group switcher */}
        {Object.keys(groups).length > 0 && (
          <div className="flex gap-2 flex-wrap mb-5">
            {Object.values(groups)
              .sort((a, b) => b.updatedAt - a.updatedAt)
              .map(g => (
                <span
                  key={g.key}
                  className={`px-3 py-1 rounded-full border text-sm font-semibold ${
                    headlineGroup && g.key === watchKey
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                      : 'bg-slate-800 border-slate-600 text-slate-300'
                  }`}
                >
                  {g.name}
                </span>
              ))}
            {sessionGroupName && (
              <button
                onClick={() => onShareWatch(sessionGroupName)}
                className="px-3 py-1 rounded-full border border-emerald-500/40 text-emerald-300 text-sm font-semibold hover:bg-emerald-500/10 transition-colors"
              >
                🔗 Copy watch link
              </button>
            )}
          </div>
        )}

        {/* Deep-linked group that isn't saved on this device */}
        {!watchGroup && watchKey && !hasLiveSession && (
          <div className="mb-6 p-4 bg-slate-900 border border-slate-700 rounded-xl text-center text-slate-300">
            No group named “{watchKey}” is saved on this device yet — ask the organizer to
            hit <span className="font-semibold">Save</span> once, then this link works everywhere.
          </div>
        )}

        {/* Resting banner */}
        {restingLabel && hasLiveSession && (
          <div className="mb-4 flex justify-center">
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-600 rounded-full text-slate-300 font-semibold">
              🪑 Resting this round: {restingLabel}
            </span>
          </div>
        )}

        {/* LIVE scoreboards */}
        {liveBoards.length > 0 && (
          <div className="space-y-4 mb-8">
            {liveBoards.map(board => {
              const servingTeam =
                board.serverName === board.team1Name ? 'left' :
                board.serverName === board.team2Name ? 'right' : null;
              return (
                <div key={board.id} className="bg-slate-900 border border-slate-700 rounded-2xl p-5 shadow-xl">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-400">{board.title}</span>
                    <span className="text-xs text-slate-500">first to {board.pointsToWin}</span>
                  </div>
                  <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center">
                    <div className="text-left min-w-0">
                      <div className={`font-bold truncate ${servingTeam === 'left' ? 'text-yellow-300' : 'text-slate-200'}`}>
                        {servingTeam === 'left' ? '🎾 ' : ''}{board.team1Name}
                      </div>
                      <div className="text-6xl sm:text-7xl font-black tabular-nums text-sky-300">{board.score1}</div>
                    </div>
                    <div className="text-2xl font-bold text-slate-600">:</div>
                    <div className="text-right min-w-0">
                      <div className={`font-bold truncate ${servingTeam === 'right' ? 'text-yellow-300' : 'text-slate-200'}`}>
                        {servingTeam === 'right' ? '🎾 ' : ''}{board.team2Name}
                      </div>
                      <div className="text-6xl sm:text-7xl font-black tabular-nums text-orange-300">{board.score2}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Standings or saved roster */}
        {leaderboard.length > 0 ? (
          <div style={{ zoom: 1.25 }}>
            <Leaderboard leaderboard={leaderboard} mode={mode} onModeChange={onModeChange} />
          </div>
        ) : roster.length > 0 ? (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-400 mb-2">
              Saved roster · ranked by ELO
            </h3>
            {roster.map((p, idx) => (
              <div key={p.name} className="flex items-center gap-3 p-3 bg-slate-900 border border-slate-700 rounded-lg">
                <span className="text-lg font-bold text-slate-500 w-8">#{idx + 1}</span>
                <span className="font-semibold text-slate-100 flex-1 truncate">{p.name}</span>
                <span className="text-xl font-bold text-emerald-400 tabular-nums">{p.eloRating}</span>
                <span className="text-xs text-slate-500 w-8">ELO</span>
              </div>
            ))}
            <p className="text-xs text-slate-500 text-center mt-4">
              Start a tournament with this group to see live standings here.
            </p>
          </div>
        ) : !watchKey ? (
          <div className="text-center text-slate-400 py-8">Nothing to spectate yet</div>
        ) : null}
      </div>
    </div>
  );
};
