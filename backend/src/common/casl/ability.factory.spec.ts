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

  it('manager without a team cannot manage team-scoped objectives', () => {
    const a = defineAbilityFor(user({ id: 5, role: 'manager', teamId: null }));
    expect(a.can('update', subject('Objective', { scope: 'team', scopeRefId: 42 }))).toBe(false);
    expect(a.can('update', subject('Objective', { ownerPersonId: 5 }))).toBe(true);
  });

  it('manager can create ActivityEvent for their own actorPersonId', () => {
    const a = defineAbilityFor(user({ id: 5, role: 'manager' }));
    expect(a.can('create', subject('ActivityEvent', { actorPersonId: 5 }))).toBe(true);
    expect(a.can('create', subject('ActivityEvent', { actorPersonId: 9 }))).toBe(false);
  });

  it('executive cannot create ActivityEvent (read-only)', () => {
    const a = defineAbilityFor(user({ role: 'executive' }));
    expect(a.can('create', 'ActivityEvent')).toBe(false);
    expect(a.can('read', 'ActivityEvent')).toBe(true);
  });

  it('manager cannot create or manage Department', () => {
    const a = defineAbilityFor(user({ id: 5, role: 'manager' }));
    expect(a.can('create', 'Department')).toBe(false);
    expect(a.can('manage', 'Department')).toBe(false);
  });

  it('manager cannot create or manage Team', () => {
    const a = defineAbilityFor(user({ id: 5, role: 'manager' }));
    expect(a.can('create', 'Team')).toBe(false);
    expect(a.can('manage', 'Team')).toBe(false);
  });

  it('admin can manage Task and Label', () => {
    const a = defineAbilityFor(user({ role: 'admin' }));
    expect(a.can('create', 'Task')).toBe(true);
    expect(a.can('delete', 'Label')).toBe(true);
  });

  it('executive can read Task/Label but not write (read-only)', () => {
    const a = defineAbilityFor(user({ role: 'executive' }));
    expect(a.can('read', 'Task')).toBe(true);
    expect(a.can('create', 'Task')).toBe(false);
    expect(a.can('update', 'Label')).toBe(false);
  });

  it('manager can manage Task and Label', () => {
    const a = defineAbilityFor(user({ id: 5, role: 'manager' }));
    expect(a.can('create', 'Task')).toBe(true);
    expect(a.can('delete', subject('Task', { createdByPersonId: 9 }))).toBe(true);
    expect(a.can('manage', 'Label')).toBe(true);
  });

  it('member can manage only own Task and read all Task/Label', () => {
    const a = defineAbilityFor(user({ id: 7, role: 'member' }));
    expect(a.can('update', subject('Task', { createdByPersonId: 7 }))).toBe(true);
    expect(a.can('update', subject('Task', { createdByPersonId: 8 }))).toBe(false);
    expect(a.can('read', subject('Task', { createdByPersonId: 8 }))).toBe(true);
    expect(a.can('read', 'Label')).toBe(true);
    expect(a.can('create', 'Label')).toBe(false);
  });
});
