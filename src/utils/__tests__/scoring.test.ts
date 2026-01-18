import { describe, it, expect } from 'vitest';
import { getPointDisplay, formatTime, getMatchDuration } from '../scoring';

describe('scoring utils', () => {
  describe('getPointDisplay', () => {
    it('should return correct point display for 0-0', () => {
      const result = getPointDisplay(0, 0);
      expect(result).toEqual({ p1: '0', p2: '0' });
    });

    it('should return correct point display for 15-0', () => {
      const result = getPointDisplay(1, 0);
      expect(result).toEqual({ p1: '15', p2: '0' });
    });

    it('should return correct point display for 30-30', () => {
      const result = getPointDisplay(2, 2);
      expect(result).toEqual({ p1: '30', p2: '30' });
    });

    it('should return correct point display for 40-40 (deuce)', () => {
      const result = getPointDisplay(3, 3);
      expect(result).toEqual({ p1: '40', p2: '40' });
    });

    it('should return W for winner', () => {
      const result = getPointDisplay(4, 2);
      expect(result).toEqual({ p1: 'W', p2: '40' });
    });

    it('should return W for both when both >= 4', () => {
      const result = getPointDisplay(5, 4);
      expect(result).toEqual({ p1: 'W', p2: 'W' });
    });
  });

  describe('formatTime', () => {
    it('should format 0 milliseconds', () => {
      expect(formatTime(0)).toBe('0:00');
    });

    it('should format seconds', () => {
      expect(formatTime(45000)).toBe('0:45');
    });

    it('should format minutes and seconds', () => {
      expect(formatTime(125000)).toBe('2:05');
    });

    it('should format large times', () => {
      expect(formatTime(3661000)).toBe('61:01');
    });
  });

  describe('getMatchDuration', () => {
    it('should return --:-- when no start time', () => {
      expect(getMatchDuration()).toBe('--:--');
    });

    it('should calculate duration between start and end', () => {
      const start = 1000000;
      const end = 1125000;
      expect(getMatchDuration(start, end)).toBe('2:05');
    });

    it('should use current time if no end time', () => {
      const start = Date.now() - 60000; // 1 minute ago
      const duration = getMatchDuration(start);
      // Should be approximately 1:00, allow some tolerance
      expect(duration).toMatch(/^[0-1]:[0-5][0-9]$/);
    });
  });
});
