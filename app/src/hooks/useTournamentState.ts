import { useState, useEffect, useCallback } from 'react';
import { TournamentState, HistoryEntry } from '../core/types';
import { saveTournamentState, loadTournamentState } from '../core/localStorage';

const initialSettings = {
  pointsToWin: 7,
  finalsFormat: 'traditional' as const,
  courts: 2
};

const initialState: TournamentState = {
  players: [],
  rounds: [],
  tournamentStarted: false,
  partnershipHistory: {},
  oppositionHistory: {},
  finalsMode: false,
  finalsMatch: null,
  settings: initialSettings
};

/**
 * Centralized tournament state with undo/redo and auto-persistence.
 * Same contract as the web app's hook (localStorage is shimmed by services/storage).
 */
export const useTournamentState = () => {
  const [state, setState] = useState<TournamentState>(() => {
    const saved = loadTournamentState();
    return saved || initialState;
  });

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  useEffect(() => {
    saveTournamentState(state);
  }, [state]);

  const addToHistory = useCallback((entry: HistoryEntry) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(entry);
      return newHistory.slice(-50);
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  }, [historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex >= 0) {
      const entry = history[historyIndex];
      if (entry.previousState) {
        setState(prev => ({ ...prev, ...entry.previousState }));
        setHistoryIndex(prev => prev - 1);
      }
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const entry = history[historyIndex + 1];
      setState(prev => ({ ...prev, ...entry.data }));
      setHistoryIndex(prev => prev + 1);
    }
  }, [history, historyIndex]);

  const canUndo = historyIndex >= 0;
  const canRedo = historyIndex < history.length - 1;

  const updateState = useCallback((
    updates: Partial<TournamentState>,
    historyEntry?: Omit<HistoryEntry, 'previousState'>
  ) => {
    setState(prevState => {
      const newState = { ...prevState, ...updates };
      if (historyEntry) {
        addToHistory({ ...historyEntry, previousState: prevState });
      }
      return newState;
    });
  }, [addToHistory]);

  return { state, updateState, undo, redo, canUndo, canRedo, history };
};
