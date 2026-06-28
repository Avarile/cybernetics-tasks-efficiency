import { getTableColumns } from 'drizzle-orm';
import { task, taskAssignee, label, taskLabel, taskState, taskPriority } from './task.schema';
import { subjectType } from './tracking.schema';

describe('task.schema', () => {
  it('taskPriority enum has the five Plane priority values', () => {
    expect(taskPriority.enumValues).toEqual(['urgent', 'high', 'medium', 'low', 'none']);
  });

  it('task table exposes the core columns', () => {
    const cols = Object.keys(getTableColumns(task));
    for (const c of ['id', 'slug', 'initiativeId', 'parentId', 'title', 'priority',
      'startDate', 'targetDate', 'completedAt', 'sortOrder', 'sequenceId',
      'createdByPersonId', 'status', 'isDeleted']) {
      expect(cols).toContain(c);
    }
  });

  it('join + projection tables expose their keys', () => {
    expect(Object.keys(getTableColumns(taskAssignee))).toEqual(expect.arrayContaining(['taskId', 'personId']));
    expect(Object.keys(getTableColumns(taskLabel))).toEqual(expect.arrayContaining(['taskId', 'labelId']));
    expect(Object.keys(getTableColumns(label))).toEqual(expect.arrayContaining(['name', 'color', 'parentId', 'sortOrder']));
    expect(Object.keys(getTableColumns(taskState))).toEqual(expect.arrayContaining(['taskId', 'status', 'totalTimeLoggedMinutes', 'blockedSince', 'lastEventAt']));
  });

  it('subjectType enum now includes task', () => {
    expect(subjectType.enumValues).toContain('task');
  });
});
