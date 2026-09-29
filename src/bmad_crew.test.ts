import { BMADCrewManager, CrewRole } from './bmad_crew';

describe('BMADCrewManager', () => {
  let manager: BMADCrewManager;

  beforeEach(() => {
    manager = new BMADCrewManager(5);
  });

  describe('addMember', () => {
    it('should add a member with a valid role', () => {
      const result = manager.addMember('1', 'Amelia', 'builder');
      expect(result).toBe(true);
      const stats = manager.getStats();
      expect(stats.total).toBe(1);
      expect(stats.active).toBe(1);
    });

    it('should reject adding when at capacity', () => {
      manager.addMember('1', 'A', 'builder');
      manager.addMember('2', 'B', 'moderator');
      manager.addMember('3', 'C', 'analyst');
      manager.addMember('4', 'D', 'director');
      manager.addMember('5', 'E', 'builder');

      const result = manager.addMember('6', 'F', 'moderator');
      expect(result).toBe(false);
    });

    it('should reject duplicate member IDs', () => {
      manager.addMember('1', 'Amelia', 'builder');
      const result = manager.addMember('1', 'Buddy', 'analyst');
      expect(result).toBe(false);
    });

    it.each([['builder'], ['moderator'], ['analyst'], ['director']])(
      'should accept role "%s"',
      (role: CrewRole) => {
        const result = manager.addMember('1', 'Test', role);
        expect(result).toBe(true);
      }
    );
  });

  describe('removeMember', () => {
    it('should remove an existing member', () => {
      manager.addMember('1', 'Amelia', 'builder');
      const result = manager.removeMember('1');
      expect(result).toBe(true);
      expect(manager.getStats().total).toBe(0);
    });

    it('should return false for non-existent member', () => {
      const result = manager.removeMember('999');
      expect(result).toBe(false);
    });
  });

  describe('getMembersByRole', () => {
    beforeEach(() => {
      manager.addMember('1', 'Amelia', 'builder');
      manager.addMember('2', 'Buddy', 'moderator');
      manager.addMember('3', 'Charlie', 'analyst');
      manager.deactivateMember('2');
    });

    it('should return only active members of the given role', () => {
      const builders = manager.getMembersByRole('builder');
      expect(builders).toHaveLength(1);
      expect(builders[0].name).toBe('Amelia');
    });

    it('should exclude inactive members', () => {
      const moderators = manager.getMembersByRole('moderator');
      expect(moderators).toHaveLength(0);
    });

    it('should return empty array for role with no members', () => {
      const directors = manager.getMembersByRole('director');
      expect(directors).toHaveLength(0);
    });
  });

  describe('assignSession', () => {
    beforeEach(() => {
      manager.addMember('1', 'Amelia', 'builder');
    });

    it('should assign a session to an active member', () => {
      const result = manager.assignSession('1', 'session-1');
      expect(result).toBe(true);
    });

    it('should reject assigning to inactive member', () => {
      manager.deactivateMember('1');
      const result = manager.assignSession('1', 'session-1');
      expect(result).toBe(false);
    });

    it('should reject duplicate session assignment', () => {
      manager.assignSession('1', 'session-1');
      const result = manager.assignSession('1', 'session-1');
      expect(result).toBe(false);
    });

    it('should allow assigning multiple sessions', () => {
      manager.assignSession('1', 'session-1');
      const result = manager.assignSession('1', 'session-2');
      expect(result).toBe(true);
    });

    it('should return false for non-existent member', () => {
      const result = manager.assignSession('999', 'session-1');
      expect(result).toBe(false);
    });
  });

  describe('deactivateMember / reactivateMember', () => {
    beforeEach(() => {
      manager.addMember('1', 'Amelia', 'builder');
    });

    it('should deactivate a member', () => {
      const result = manager.deactivateMember('1');
      expect(result).toBe(true);
      expect(manager.getStats().active).toBe(0);
    });

    it('should reactivate a deactivated member', () => {
      manager.deactivateMember('1');
      const result = manager.reactivateMember('1');
      expect(result).toBe(true);
      expect(manager.getStats().active).toBe(1);
    });

    it('should return false for non-existent member', () => {
      expect(manager.deactivateMember('999')).toBe(false);
      expect(manager.reactivateMember('999')).toBe(false);
    });
  });

  describe('getStats', () => {
    beforeEach(() => {
      manager.addMember('1', 'Amelia', 'builder');
      manager.addMember('2', 'Buddy', 'moderator');
      manager.addMember('3', 'Charlie', 'analyst');
      manager.deactivateMember('2');
    });

    it('should return correct total and active counts', () => {
      const stats = manager.getStats();
      expect(stats.total).toBe(3);
      expect(stats.active).toBe(2);
    });

    it('should return correct role breakdown', () => {
      const stats = manager.getStats();
      expect(stats.byRole.builder).toBe(1);
      expect(stats.byRole.moderator).toBe(0);
      expect(stats.byRole.analyst).toBe(1);
      expect(stats.byRole.director).toBe(0);
    });
  });

  describe('getCrewState', () => {
    it('should return a deep copy of the crew state', () => {
      manager.addMember('1', 'Amelia', 'builder');
      const state = manager.getCrewState();
      expect(state.members).toHaveLength(1);

      // Mutating returned state should not affect internal state
      state.members.push({
        id: '999',
        name: 'Fake',
        role: 'director',
        isActive: true,
      });
      expect(manager.getStats().total).toBe(1);
    });
  });
});
