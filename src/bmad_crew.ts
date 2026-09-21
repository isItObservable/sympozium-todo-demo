/**
 * BMAD Crew - Core module for managing crew members and their assignments.
 * 
 * BMAD stands for:
 * - B: Builder (creates content)
 * - M: Moderator (guides discussions)
 * - A: Analyst (reviews and analyzes)
 * - D: Director (oversees sessions)
 */

export type CrewRole = 'builder' | 'moderator' | 'analyst' | 'director';

export interface CrewMember {
  id: string;
  name: string;
  role: CrewRole;
  assignedSessions?: string[];
  isActive: boolean;
}

export interface BMADCrew {
  members: CrewMember[];
  maxCapacity: number;
  createdAt: Date;
}

export class BMADCrewManager {
  private crew: BMADCrew;

  constructor(maxCapacity: number = 10) {
    this.crew = {
      members: [],
      maxCapacity,
      createdAt: new Date(),
    };
  }

  /**
   * Add a member to the crew with a specific role.
   */
  addMember(id: string, name: string, role: CrewRole): boolean {
    if (this.crew.members.length >= this.crew.maxCapacity) {
      return false;
    }

    const existing = this.crew.members.find((m) => m.id === id);
    if (existing) {
      return false;
    }

    this.crew.members.push({
      id,
      name,
      role,
      isActive: true,
    });

    return true;
  }

  /**
   * Remove a member from the crew.
   */
  removeMember(id: string): boolean {
    const index = this.crew.members.findIndex((m) => m.id === id);
    if (index === -1) {
      return false;
    }

    this.crew.members.splice(index, 1);
    return true;
  }

  /**
   * Get all members of a specific role.
   */
  getMembersByRole(role: CrewRole): CrewMember[] {
    return this.crew.members.filter((m) => m.role === role && m.isActive);
  }

  /**
   * Assign a session to a crew member.
   */
  assignSession(memberId: string, sessionId: string): boolean {
    const member = this.crew.members.find((m) => m.id === memberId);
    if (!member || !member.isActive) {
      return false;
    }

    if (!member.assignedSessions) {
      member.assignedSessions = [];
    }

    if (member.assignedSessions.includes(sessionId)) {
      return false;
    }

    member.assignedSessions.push(sessionId);
    return true;
  }

  /**
   * Deactivate a crew member.
   */
  deactivateMember(id: string): boolean {
    const member = this.crew.members.find((m) => m.id === id);
    if (!member) {
      return false;
    }

    member.isActive = false;
    return true;
  }

  /**
   * Reactivate a crew member.
   */
  reactivateMember(id: string): boolean {
    const member = this.crew.members.find((m) => m.id === id);
    if (!member) {
      return false;
    }

    member.isActive = true;
    return true;
  }

  /**
   * Get crew statistics.
   */
  getStats(): {
    total: number;
    active: number;
    byRole: Record<CrewRole, number>;
  } {
    const activeMembers = this.crew.members.filter((m) => m.isActive);

    return {
      total: this.crew.members.length,
      active: activeMembers.length,
      byRole: {
        builder: activeMembers.filter((m) => m.role === 'builder').length,
        moderator: activeMembers.filter((m) => m.role === 'moderator').length,
        analyst: activeMembers.filter((m) => m.role === 'analyst').length,
        director: activeMembers.filter((m) => m.role === 'director').length,
      },
    };
  }

  /**
   * Get the current crew state (for serialization).
   */
  getCrewState(): BMADCrew {
    return { ...this.crew, members: [...this.crew.members] };
  }
}
