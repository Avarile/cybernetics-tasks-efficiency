import { subject } from '@casl/ability';
import { defineAbilityFor } from './ability.factory';
import { IUserSession } from 'src/modules/module-auth/current-user-module/session.interface';

const user = (over: Partial<IUserSession>): IUserSession => ({
  id: 1, slug: 's', email: 'e@x.com', role: 'member', departmentId: null, teamId: null, ...over,
});

describe('defineAbilityFor', () => {
  it('admin can manage everything', () => {
    const a = defineAbilityFor(user({ role: 'admin' }));
    expect(a.can('create', 'Objective')).toBe(true);
    expect(a.can('delete', 'Person')).toBe(true);
  });

  it('executive can read but not write', () => {
    const a = defineAbilityFor(user({ role: 'executive' }));
    expect(a.can('read', 'Objective')).toBe(true);
    expect(a.can('create', 'Objective')).toBe(false);
  });

  it('member cannot create objectives', () => {
    const a = defineAbilityFor(user({ role: 'member' }));
    expect(a.can('create', 'Objective')).toBe(false);
    expect(a.can('read', 'Objective')).toBe(true);
  });

  it('member can manage only their own initiatives', () => {
    const a = defineAbilityFor(user({ id: 7, role: 'member' }));
    expect(a.can('update', subject('Initiative', { ownerPersonId: 7 }))).toBe(true);
    expect(a.can('update', subject('Initiative', { ownerPersonId: 8 }))).toBe(false);
    expect(a.can('read', subject('Initiative', { ownerPersonId: 8 }))).toBe(false);
  });

  it('member can read only their own activity events (raw inputs access-controlled)', () => {
    const a = defineAbilityFor(user({ id: 7, role: 'member' }));
    expect(a.can('read', subject('ActivityEvent', { actorPersonId: 7 }))).toBe(true);
    expect(a.can('read', subject('ActivityEvent', { actorPersonId: 8 }))).toBe(false);
  });

  it('manager can manage their own objectives and their team objectives', () => {
    const a = defineAbilityFor(user({ id: 5, role: 'manager', teamId: 42 }));
    expect(a.can('update', subject('Objective', { ownerPersonId: 5 }))).toBe(true);
    expect(a.can('update', subject('Objective', { scope: 'team', scopeRefId: 42 }))).toBe(true);
    expect(a.can('update', subject('Objective', { ownerPersonId: 9, scope: 'org' }))).toBe(false);
    expect(a.can('read', 'ActivityEvent')).toBe(true);
  });
});
