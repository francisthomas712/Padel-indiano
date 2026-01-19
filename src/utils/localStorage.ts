import { TournamentState } from '../types';

const STORAGE_KEY = 'padel-indiano-tournament';
const TEMPLATES_KEY = 'padel-indiano-templates';
const HISTORY_KEY = 'padel-indiano-history';
const VERSION_KEY = 'padel-indiano-version';
const CURRENT_VERSION = '3.0.0'; // v3.0.0: Added ELO rating system with weighted points

export const saveTournamentState = (state: TournamentState): void => {
  try {
    const dataWithVersion = {
      version: CURRENT_VERSION,
      state
    };
    const serialized = JSON.stringify(dataWithVersion);
    localStorage.setItem(STORAGE_KEY, serialized);
    localStorage.setItem(VERSION_KEY, CURRENT_VERSION);
  } catch (error) {
    console.error('Failed to save tournament state:', error);
  }
};

export const loadTournamentState = (): TournamentState | null => {
  try {
    // Check version compatibility
    const storedVersion = localStorage.getItem(VERSION_KEY);
    if (storedVersion !== CURRENT_VERSION) {
      console.log(`Version mismatch (stored: ${storedVersion}, current: ${CURRENT_VERSION}). Clearing old data.`);
      clearTournamentState();
      localStorage.setItem(VERSION_KEY, CURRENT_VERSION);
      return null;
    }

    const serialized = localStorage.getItem(STORAGE_KEY);
    if (serialized === null) {
      return null;
    }

    const parsed = JSON.parse(serialized);
    // Handle both old format (direct state) and new format (with version wrapper)
    const state = parsed.version ? parsed.state : parsed;
    return state;
  } catch (error) {
    console.error('Failed to load tournament state:', error);
    return null;
  }
};

export const clearTournamentState = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear tournament state:', error);
  }
};

export interface TournamentTemplate {
  id: string;
  name: string;
  players: { name: string; avatar?: string }[];
  settings: TournamentState['settings'];
  createdAt: number;
}

export const saveTemplate = (template: TournamentTemplate): void => {
  try {
    const templates = loadTemplates();
    const existingIndex = templates.findIndex(t => t.id === template.id);

    if (existingIndex >= 0) {
      templates[existingIndex] = template;
    } else {
      templates.push(template);
    }

    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
  } catch (error) {
    console.error('Failed to save template:', error);
  }
};

export const loadTemplates = (): TournamentTemplate[] => {
  try {
    const serialized = localStorage.getItem(TEMPLATES_KEY);
    if (serialized === null) {
      return [];
    }
    return JSON.parse(serialized);
  } catch (error) {
    console.error('Failed to load templates:', error);
    return [];
  }
};

export const deleteTemplate = (templateId: string): void => {
  try {
    const templates = loadTemplates();
    const filtered = templates.filter(t => t.id !== templateId);
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Failed to delete template:', error);
  }
};

export const saveHistory = (history: any[]): void => {
  try {
    // Keep only last 100 entries
    const trimmed = history.slice(-100);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  } catch (error) {
    console.error('Failed to save history:', error);
  }
};

export const loadHistory = (): any[] => {
  try {
    const serialized = localStorage.getItem(HISTORY_KEY);
    if (serialized === null) {
      return [];
    }
    return JSON.parse(serialized);
  } catch (error) {
    console.error('Failed to load history:', error);
    return [];
  }
};

export const clearHistory = (): void => {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch (error) {
    console.error('Failed to clear history:', error);
  }
};
