import { TournamentState } from '../types';

const STORAGE_KEY = 'padel-indiano-tournament';
const TEMPLATES_KEY = 'padel-indiano-templates';
const HISTORY_KEY = 'padel-indiano-history';

export const saveTournamentState = (state: TournamentState): void => {
  try {
    const serialized = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, serialized);
  } catch (error) {
    console.error('Failed to save tournament state:', error);
  }
};

export const loadTournamentState = (): TournamentState | null => {
  try {
    const serialized = localStorage.getItem(STORAGE_KEY);
    if (serialized === null) {
      return null;
    }
    return JSON.parse(serialized);
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
