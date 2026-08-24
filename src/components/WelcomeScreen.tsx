import React, { useState } from 'react';
import { Trophy, Eye, PencilLine } from 'lucide-react';

interface WelcomeScreenProps {
  /** Group names already saved on this device, for the quick-pick list */
  knownGroupNames: string[];
  onJoin: (groupName: string, role: 'admin' | 'spectator') => void;
}

/**
 * First-run gate: pick (or create) the one-word Group name everything hangs
 * off of, then enter as admin (run the tournament) or spectator (watch it).
 * No passwords — this is a friends-at-the-court app, not a bank.
 */
export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ knownGroupNames, onJoin }) => {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const valid = /^[A-Za-z0-9_-]{1,24}$/.test(name.trim());

  const join = (role: 'admin' | 'spectator') => {
    const trimmed = name.trim();
    if (!valid) {
      setError('One word only: letters, numbers, - or _ (max 24)');
      return;
    }
    setError(null);
    onJoin(trimmed, role);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-slate-800/70 backdrop-blur rounded-2xl border border-slate-700 shadow-2xl p-8">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="p-4 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl shadow-lg mb-4">
            <Trophy className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
            Padel Indiano
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Enter your group's name to continue — everything (players, ELOs, live scores) is linked to it.
          </p>
        </div>

        <input
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setError(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter' && valid) join('admin'); }}
          placeholder="Group name (e.g. Pawri)"
          autoFocus
          aria-label="Group name"
          className={`w-full px-4 py-3 bg-slate-700 border rounded-lg focus:outline-none focus:ring-2 text-slate-100 placeholder-slate-400 text-center text-lg font-semibold mb-1 ${
            error ? 'border-red-500 focus:ring-red-500' : 'border-slate-600 focus:ring-emerald-500'
          }`}
        />
        {error ? (
          <p className="text-xs text-red-400 text-center mb-3" role="alert">{error}</p>
        ) : (
          <p className="text-xs text-slate-500 text-center mb-3">One word, max 24 characters</p>
        )}

        <div className="flex gap-3 mt-4">
          <button
            onClick={() => join('admin')}
            className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg hover:shadow-emerald-500/40 transition-all touch-target"
          >
            <PencilLine className="w-5 h-5" />
            Run it (Admin)
          </button>
          <button
            onClick={() => join('spectator')}
            className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg hover:bg-indigo-500 transition-all touch-target"
          >
            <Eye className="w-5 h-5" />
            Watch (Spectator)
          </button>
        </div>

        {knownGroupNames.length > 0 && (
          <div className="mt-6 pt-5 border-t border-slate-700">
            <p className="text-xs uppercase tracking-widest text-slate-500 mb-2 text-center">Saved on this device</p>
            <div className="flex gap-2 flex-wrap justify-center">
              {knownGroupNames.map(g => (
                <button
                  key={g}
                  onClick={() => onJoin(g, 'spectator')}
                  className="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-full text-sm font-semibold text-slate-200 hover:text-emerald-400 hover:border-emerald-500/40 transition-colors"
                  title="Open as spectator"
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
