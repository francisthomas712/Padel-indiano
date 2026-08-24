import { describe, it, expect, beforeEach } from 'vitest';
import {
  deleteGroup,
  findGroup,
  isValidGroupName,
  normalizeGroupName,
  saveGroup
} from '../groups';
import { TournamentSettings } from '../../types';

const settings: TournamentSettings = { pointsToWin: 7, finalsFormat: 'traditional' };

const pawriPlayers = [
  { name: 'Alice', eloRating: 1620 },
  { name: 'Bob', eloRating: 1480 },
  { name: 'Cara', eloRating: 1510 }
];

describe('groups', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('isValidGroupName', () => {
    it('accepts single words with letters, digits, hyphen and underscore', () => {
      expect(isValidGroupName('Pawri')).toBe(true);
      expect(isValidGroupName('thursday-crew')).toBe(true);
      expect(isValidGroupName('club_2024')).toBe(true);
    });

    it('rejects multi-word names, empties, and overlong names', () => {
      expect(isValidGroupName('two words')).toBe(false);
      expect(isValidGroupName('')).toBe(false);
      expect(isValidGroupName('   ')).toBe(false);
      expect(isValidGroupName('x'.repeat(25))).toBe(false);
      expect(isValidGroupName('emoji🎉')).toBe(false);
    });
  });

  describe('saveGroup', () => {
    it('saves a group with players and their historical ELOs', () => {
      const result = saveGroup('Pawri', pawriPlayers, settings);
      expect(result.ok).toBe(true);
      const loaded = findGroup('pawri');
      expect(loaded?.name).toBe('Pawri');
      expect(loaded?.players).toEqual(pawriPlayers);
      expect(loaded?.settings).toEqual(settings);
    });

    it('enforces unique one-word names (case-insensitive)', () => {
      saveGroup('Pawri', pawriPlayers, settings);
      const clash = saveGroup('PAWRI', [{ name: 'Zed', eloRating: 1000 }], settings);
      expect(clash.ok).toBe(false);
      if (!clash.ok) expect(clash.error).toBe('name-taken');
    });

    it('allows overwriting your own current session group', () => {
      saveGroup('Pawri', pawriPlayers, settings);
      const updated = saveGroup(
        'Pawri',
        [...pawriPlayers, { name: 'Dora', eloRating: 1550 }],
        settings,
        'Pawri'
      );
      expect(updated.ok).toBe(true);
      expect(findGroup('pawri')?.players).toHaveLength(4);
    });

    it('rejects invalid names', () => {
      const bad = saveGroup('not a word', pawriPlayers, settings);
      expect(bad.ok).toBe(false);
      if (!bad.ok) expect(bad.error).toBe('invalid-name');
    });

    it('preserves the original casing when re-saving an existing group', () => {
      saveGroup('Pawri', pawriPlayers, settings);
      const res = saveGroup('pawri', pawriPlayers, settings, 'Pawri');
      expect(res.ok && res.group.name).toBe('Pawri');
    });
  });

  describe('findGroup / deleteGroup', () => {
    it('finds groups case-insensitively and returns null for unknown names', () => {
      saveGroup('Pawri', pawriPlayers, settings);
      expect(findGroup('PAWRI')).not.toBeNull();
      expect(findGroup('Nope')).toBeNull();
    });

    it('deletes groups', () => {
      saveGroup('Pawri', pawriPlayers, settings);
      deleteGroup('PAWRI');
      expect(findGroup('pawri')).toBeNull();
    });
  });

  describe('normalizeGroupName', () => {
    it('trims and lowercases for canonical keys', () => {
      expect(normalizeGroupName('  Pawri ')).toBe('pawri');
    });
  });
});
