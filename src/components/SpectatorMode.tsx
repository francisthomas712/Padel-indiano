import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { Leaderboard } from './Leaderboard';
import { PlayerWithStats, LeaderboardMode } from '../types';

interface SpectatorModeProps {
  isOpen: boolean;
  leaderboard: PlayerWithStats[];
  mode: LeaderboardMode;
  onModeChange: (mode: LeaderboardMode) => void;
  restingLabel: string | null;
  onClose: () => void;
}

/**
 * Fullscreen read-only leaderboard for propping up a phone/tablet courtside
 * so players can check standings without touching the organizer's device.
 */
export const SpectatorMode: React.FC<SpectatorModeProps> = ({
  isOpen,
  leaderboard,
  mode,
  onModeChange,
  restingLabel,
  onClose
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

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Spectator leaderboard"
    >
      <div className="max-w-3xl mx-auto p-4 pt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-3xl font-black bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
              Standings
            </h2>
            <p className="text-slate-400 text-sm">Live tournament leaderboard</p>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 bg-slate-800 text-slate-300 rounded-full hover:bg-slate-700 touch-target"
            aria-label="Close spectator view"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {restingLabel && (
          <div className="mb-4 flex justify-center">
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-600 rounded-full text-slate-300 font-semibold">
              🪑 Resting this round: {restingLabel}
            </span>
          </div>
        )}

        {/* Scaled up slightly for at-a-distance readability */}
        <div style={{ zoom: 1.25 }}>
          <Leaderboard
            leaderboard={leaderboard}
            mode={mode}
            onModeChange={onModeChange}
          />
        </div>
      </div>
    </div>
  );
};
