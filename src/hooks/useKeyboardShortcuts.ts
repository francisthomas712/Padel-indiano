import { useEffect } from 'react';

interface ShortcutHandlers {
  onUndo?: () => void;
  onRedo?: () => void;
  onSave?: () => void;
  onEscape?: () => void;
}

export const useKeyboardShortcuts = (handlers: ShortcutHandlers) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const { key, ctrlKey, metaKey, shiftKey } = event;
      const modifier = ctrlKey || metaKey;

      // Undo: Ctrl/Cmd + Z
      if (modifier && key === 'z' && !shiftKey && handlers.onUndo) {
        event.preventDefault();
        handlers.onUndo();
      }

      // Redo: Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y
      if (modifier && ((key === 'z' && shiftKey) || key === 'y') && handlers.onRedo) {
        event.preventDefault();
        handlers.onRedo();
      }

      // Save: Ctrl/Cmd + S
      if (modifier && key === 's' && handlers.onSave) {
        event.preventDefault();
        handlers.onSave();
      }

      // Escape
      if (key === 'Escape' && handlers.onEscape) {
        event.preventDefault();
        handlers.onEscape();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers]);
};

interface MatchShortcutHandlers {
  onTeam1Plus?: () => void;
  onTeam1Minus?: () => void;
  onTeam2Plus?: () => void;
  onTeam2Minus?: () => void;
  onComplete?: () => void;
}

export const useMatchKeyboardShortcuts = (
  handlers: MatchShortcutHandlers,
  enabled: boolean = true
) => {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      const { key } = event;

      switch (key) {
        case 'q':
        case 'Q':
          handlers.onTeam1Plus?.();
          break;
        case 'a':
        case 'A':
          handlers.onTeam1Minus?.();
          break;
        case 'p':
        case 'P':
          handlers.onTeam2Plus?.();
          break;
        case 'l':
        case 'L':
          handlers.onTeam2Minus?.();
          break;
        case 'Enter':
          handlers.onComplete?.();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers, enabled]);
};
