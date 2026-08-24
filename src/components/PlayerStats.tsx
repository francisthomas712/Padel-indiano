import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Player, Round } from '../types';

interface PlayerStatsProps {
  players: Player[];
  rounds: Round[];
}

interface MatchLogEntry {
  roundNumber: number;
  partner: string;
  opponents: string;
  scoreFor: number;
  scoreAgainst: number;
  won: boolean;
  weightedPoints: number;
}

/** Build the per-player match log from completed rounds. */
const buildMatchLog = (playerId: string, rounds: Round[]): MatchLogEntry[] => {
  const log: MatchLogEntry[] = [];

  rounds.forEach(round => {
    round.matches.forEach(match => {
      if (!match.completed) return;

      const onTeam1 = match.pair1.players.some(p => p.id === playerId);
      const onTeam2 = match.pair2.players.some(p => p.id === playerId);
      if (!onTeam1 && !onTeam2) return;

      const ownPair = onTeam1 ? match.pair1 : match.pair2;
      const oppPair = onTeam1 ? match.pair2 : match.pair1;
      const scoreFor = onTeam1 ? match.score1 : match.score2;
      const scoreAgainst = onTeam1 ? match.score2 : match.score1;
      const weighted =
        (onTeam1 ? match.weightedPoints1 : match.weightedPoints2) ?? scoreFor;

      log.push({
        roundNumber: round.id + 1,
        partner: ownPair.players.filter(p => p.id !== playerId).map(p => p.name).join(', ') || '—',
        opponents: oppPair.players.map(p => p.name).join(' & '),
        scoreFor,
        scoreAgainst,
        won: scoreFor > scoreAgainst,
        weightedPoints: Math.round(weighted * 10) / 10
      });
    });
  });

  return log;
};

/**
 * Per-player career panel: stats at a glance plus an expandable match-by-match
 * log (partner, opponents, score, result, weighted points) built from the
 * tournament's completed rounds.
 */
export const PlayerStats: React.FC<PlayerStatsProps> = ({ players, rounds }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (players.length === 0) {
    return <p className="text-slate-400 text-center py-6">No players yet</p>;
  }

  const ranked = [...players].sort((a, b) => b.eloRating - a.eloRating);

  return (
    <div className="space-y-2">
      <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
        Career stats & match log
      </h3>
      <p className="text-xs text-slate-400 mb-3">Tap a player to see every game they've played.</p>

      {ranked.map(player => {
        const log = buildMatchLog(player.id, rounds);
        const wins = log.filter(m => m.won).length;
        const losses = log.length - wins;
        const winRate = log.length > 0 ? ((wins / log.length) * 100).toFixed(0) : '—';
        const ppg = log.length > 0 ? (player.points / log.length).toFixed(2) : '—';
        const eloDelta = player.eloRating - player.initialElo;
        const isExpanded = expandedId === player.id;

        return (
          <div key={player.id} className="bg-slate-800/60 border border-slate-700 rounded-xl overflow-hidden">
            <button
              onClick={() => setExpandedId(isExpanded ? null : player.id)}
              className="w-full flex items-center gap-3 p-4 hover:bg-slate-800 transition-colors text-left"
              aria-expanded={isExpanded}
            >
              {isExpanded
                ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}

              <div className="min-w-0 flex-1">
                <div className="font-semibold text-slate-100 truncate">
                  {player.name}
                  {!player.active && (
                    <span className="ml-2 text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded border border-orange-500/30">
                      Away
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {log.length > 0
                    ? `${log.length} games · ${wins}W-${losses}L (${winRate}%) · ${ppg} PPG${player.sitOutCount > 0 ? ` · ${player.sitOutCount} sit-outs` : ''}`
                    : 'No matches yet'}
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="text-xl font-bold text-slate-100 tabular-nums">{player.eloRating}</div>
                <div className={`text-xs font-medium tabular-nums ${
                  eloDelta > 0 ? 'text-emerald-400' : eloDelta < 0 ? 'text-red-400' : 'text-slate-500'
                }`}>
                  {eloDelta > 0 ? '+' : ''}{eloDelta} ELO
                </div>
              </div>
            </button>

            {isExpanded && (
              <div className="border-t border-slate-700 bg-slate-900/50">
                {log.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">
                    No completed matches yet — the log fills in as games finish.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-800">
                    {[...log].reverse().map((m, idx) => (
                      <div key={idx} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                        <span className="text-xs text-slate-500 w-12 shrink-0">R{m.roundNumber}</span>
                        <span className={`font-bold w-10 shrink-0 ${m.won ? 'text-emerald-400' : 'text-red-400'}`}>
                          {m.won ? 'W' : 'L'}
                        </span>
                        <span className="font-semibold text-slate-200 tabular-nums w-12 shrink-0">
                          {m.scoreFor}–{m.scoreAgainst}
                        </span>
                        <span className="text-slate-400 truncate flex-1">
                          w/ {m.partner} vs {m.opponents}
                        </span>
                        <span className="text-xs text-slate-500 shrink-0 tabular-nums">
                          {m.weightedPoints} pts
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
