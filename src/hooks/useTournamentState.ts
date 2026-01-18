import { useState, useEffect, useCallback } from 'react';
import { TournamentState, HistoryEntry } from '../types';
import { saveTournamentState, loadTournamentState } from '../utils/localStorage';

const initialSettings = {
  pointsToWin: 32,
  finalsFormat: 'traditional' as const,
  autoGenerateRounds: true
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

export const useTournamentState = () => {
  const [state, setState] = useState<TournamentState>(() => {
    const saved = loadTournamentState();
    return saved || initialState;
  });

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Auto-save to localStorage
  useEffect(() => {
    saveTournamentState(state);
  }, [state]);

  const addToHistory = useCallback((entry: HistoryEntry) => {
    setHistory(prev => {
      // Remove any history after current index (branching)
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(entry);
      // Keep only last 50 entries
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
        addToHistory({
          ...historyEntry,
          previousState: prevState
        });
      }

      return newState;
    });
  }, [addToHistory]);

  const resetState = useCallback(() => {
    setState(initialState);
    setHistory([]);
    setHistoryIndex(-1);
  }, []);

  return {
    state,
    setState,
    updateState,
    resetState,
    undo,
    redo,
    canUndo,
    canRedo,
    history
  };
};
