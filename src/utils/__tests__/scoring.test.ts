import { describe, it, expect } from 'vitest';
import { getPointDisplay, formatTime, getMatchDuration, checkMatchWinner, getNextServer } from '../scoring';

describe('scoring utils', () => {
  describe('getPointDisplay', () => {
    it('should return numeric scores', () => {
      expect(getPointDisplay(0, 0)).toEqual({ p1: '0', p2: '0' });
      expect(getPointDisplay(3, 2)).toEqual({ p1: '3', p2: '2' });
      expect(getPointDisplay(7, 6)).toEqual({ p1: '7', p2: '6' });
      expect(getPointDisplay(10, 8)).toEqual({ p1: '10', p2: '8' });
    });
  });

  describe('checkMatchWinner', () => {
    it('should return null when no winner yet', () => {
      expect(checkMatchWinner(3, 2, 7)).toBeNull();
      expect(checkMatchWinner(6, 6, 7)).toBeNull();
    });

    it('should return winner when first to pointsToWin', () => {
      expect(checkMatchWinner(7, 5, 7)).toBe(1);
      expect(checkMatchWinner(5, 7, 7)).toBe(2);
      expect(checkMatchWinner(7, 6, 7)).toBe(1);
    });

    it('should work with different pointsToWin values', () => {
      expect(checkMatchWinner(11, 9, 11)).toBe(1);
      expect(checkMatchWinner(9, 11, 11)).toBe(2);
    });
  });

  describe('getNextServer', () => {
    it('should start with pair1-p1', () => {
      expect(getNextServer(undefined)).toBe('pair1-p1');
    });

    it('should rotate correctly', () => {
      expect(getNextServer('pair1-p1')).toBe('pair2-p1');
      expect(getNextServer('pair2-p1')).toBe('pair1-p2');
      expect(getNextServer('pair1-p2')).toBe('pair2-p2');
      expect(getNextServer('pair2-p2')).toBe('pair1-p1');
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
