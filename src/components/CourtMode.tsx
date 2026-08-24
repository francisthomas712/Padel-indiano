import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { checkMatchWinner } from '../utils/scoring';
import { hapticCorrection } from '../utils/haptics';
import { useWakeLock } from '../hooks/useWakeLock';
import { useMatchTimer } from '../hooks/useMatchTimer';

interface CourtModeProps {
  isOpen: boolean;
  title: string;
  team1Name: string;
  team2Name: string;
  score1: number;
  score2: number;
  pointsToWin: number;
  winByTwo?: boolean;
  goldenPoint?: boolean;
  serverName: string | null;
  completed: boolean;
  startTime?: number;
  onPoint: (team: 1 | 2, delta: 1 | -1) => void;
  onConfirmWin: () => void;
  onClose: () => void;
}

/**
 * Fullscreen "Court Mode" scoreboard designed for phones held on court:
 * two giant tap zones (+1 per side), small − buttons for corrections,
 * a huge live serve indicator, and wake-lock so the screen stays on.
 */
export const CourtMode: React.FC<CourtModeProps> = ({
  isOpen,
  title,
  team1Name,
  team2Name,
  score1,
  score2,
  pointsToWin,
  winByTwo = false,
  goldenPoint = false,
  serverName,
  completed,
  startTime,
  onPoint,
  onConfirmWin,
  onClose
}) => {
  const { formattedTime } = useMatchTimer(startTime);
  const [winDismissedAt, setWinDismissedAt] = useState<string | null>(null);

  useWakeLock(isOpen && !completed);

  const winner = !completed
    ? checkMatchWinner(score1, score2, pointsToWin, { winByTwo, goldenPoint })
    : null;

  // Re-show the celebration whenever the winning score line changes
  useEffect(() => {
    setWinDismissedAt(null);
  }, [score1, score2]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const showWinOverlay = winner !== null && winDismissedAt !== `${winner}-${score1}-${score2}`;

  const handleDismissWin = () => setWinDismissedAt(`${winner}-${score1}-${score2}`);

  const handleConfirm = () => {
    onConfirmWin();
    onClose();
  };

  const scoreStyle = { fontSize: 'min(28vw, 22vh)', lineHeight: 1 };

  const renderHalf = (team: 1 | 2, name: string, score: number, isWinner: boolean) => (
    <div className="relative flex-1 flex flex-col">
      {/* Giant tap-to-score zone */}
      <button
        onPointerDown={(e) => { e.preventDefault(); onPoint(team, 1); }}
        disabled={completed}
        className="flex-1 w-full flex flex-col items-center justify-center select-none touch-manipulation active:bg-slate-800/60 transition-colors disabled:cursor-default"
        aria-label={`Add point to ${name}`}
      >
        <span className={`text-lg sm:text-2xl font-bold mb-2 px-4 text-center break-words ${
          isWinner ? 'text-yellow-300' : 'text-slate-300'
        }`}>
          {isWinner ? '🏆 ' : ''}{name}
        </span>
        <span
          className={`font-black tabular-nums transition-all ${
            isWinner ? 'text-emerald-400' : team === 1 ? 'text-sky-300' : 'text-orange-300'
          }`}
          style={scoreStyle}
        >
          {score}
        </span>
        <span className="mt-3 text-xs uppercase tracking-widest text-slate-500">tap for point</span>
      </button>

      {/* Correction button */}
      {!completed && (
        <button
          onPointerDown={(e) => { e.preventDefault(); hapticCorrection(); onPoint(team, -1); }}
          className="absolute bottom-16 right-3 w-11 h-11 rounded-full bg-slate-800 text-slate-400 border border-slate-600 text-xl font-bold active:bg-slate-700"
          aria-label={`Remove point from ${name}`}
          title="Correct point (-1)"
        >
          −
        </button>
      )}
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950 flex flex-col landscape:flex-row"
      role="dialog"
      aria-modal="true"
      aria-label={`${title} scoreboard`}
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-3 py-2 pointer-events-none">
        <span className="px-3 py-1 bg-slate-800/80 text-slate-300 rounded-full text-xs sm:text-sm font-semibold pointer-events-auto">
          {title} · {formattedTime} · first to {pointsToWin}
        </span>
        <button
          onClick={onClose}
          className="p-2.5 bg-slate-800/80 text-slate-300 rounded-full hover:bg-slate-700 pointer-events-auto touch-target"
          aria-label="Exit fullscreen scoreboard"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Tap zones */}
      <div className="flex flex-col landscape:flex-row flex-1 pt-12 pb-20">
        {renderHalf(1, team1Name, score1, winner === 1)}
        <div className="h-px landscape:h-auto landscape:w-px bg-slate-800" />
        {renderHalf(2, team2Name, score2, winner === 2)}
      </div>

      {/* Serve indicator */}
      {serverName && !completed && (
        <div className="absolute bottom-0 left-0 right-0 py-3 flex justify-center pointer-events-none">
          <span className="inline-flex items-center gap-2 px-6 py-2 bg-yellow-500/15 border border-yellow-500/40 rounded-full text-yellow-300 font-bold text-lg sm:text-xl">
            🎾 Serve: {serverName}
          </span>
        </div>
      )}

      {/* Win overlay */}
      {showWinOverlay && (
        <div className="absolute inset-0 z-20 bg-emerald-950/95 backdrop-blur-sm flex flex-col items-center justify-center gap-4 p-6">
          <div className="text-7xl" aria-hidden>🏆</div>
          <div className="text-3xl sm:text-5xl font-black text-emerald-300 text-center">
            {(winner === 1 ? team1Name : team2Name)} wins!
          </div>
          <div className="text-5xl sm:text-7xl font-black tabular-nums text-white">
            {winner === 1 ? `${score1}–${score2}` : `${score2}–${score1}`}
          </div>
          <div className="flex flex-col sm:flex-row gap-3 mt-4 w-full max-w-xs">
            <button
              onClick={handleConfirm}
              className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-bold text-lg shadow-lg shadow-emerald-500/40 touch-target"
            >
              ✓ Confirm & Save
            </button>
            <button
              onClick={handleDismissWin}
              className="flex-1 py-4 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl font-semibold touch-target"
            >
              Keep playing
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
