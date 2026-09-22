import { describe, it } from 'node:test';
import { strictEqual } from 'node:assert';
import { BMADCrew } from '../src/bmad-crew.js';

describe('BMAD Crew', () => {
  it('should create a crew with the given members', () => {
    const crew = new BMADCrew(['alice', 'bob', 'charlie']);
    strictEqual(crew.members.length, 3);
    strictEqual(crew.members[0], 'alice');
    strictEqual(crew.members[1], 'bob');
    strictEqual(crew.members[2], 'charlie');
  });

  it('should have a default role assignment', () => {
    const crew = new BMADCrew(['alice']);
    strictEqual(crew.roles['alice'], 'developer');
  });

  it('should assign roles correctly', () => {
    const crew = new BMADCrew([
      { name: 'alice', role: 'architect' },
      { name: 'bob', role: 'reviewer' }
    ]);
    strictEqual(crew.roles['alice'], 'architect');
    strictEqual(crew.roles['bob'], 'reviewer');
  });

  it('should return crew summary', () => {
    const crew = new BMADCrew(['alice', 'bob']);
    const summary = crew.summary();
    strictEqual(summary.members, 2);
    strictEqual(summary.active, true);
  });
});
