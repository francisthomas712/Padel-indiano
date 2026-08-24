/**
 * Haptic feedback helpers for on-court phone use.
 * All calls are safe no-ops on devices/browsers without vibration support
 * (e.g., iOS Safari, which does not expose navigator.vibrate).
 */

export const vibrate = (pattern: number | number[]): void => {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(pattern);
  }
};

/** Short tick when a point is scored. */
export const hapticPoint = (): void => vibrate(10);

/** Distinct double-tick when a point is corrected (-1). */
export const hapticCorrection = (): void => vibrate([10, 40, 10]);

/** Celebratory pattern when a match win is confirmed. */
export const hapticWin = (): void => vibrate([30, 60, 30, 60, 80]);
