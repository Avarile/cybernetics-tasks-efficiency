import { getTableConfig } from 'drizzle-orm/pg-core';
import { knowledge, knowledgeShare, knowledgeLink, knowledgeAttachment, taskKnowledge } from './knowledge.schema';

describe('knowledge schema', () => {
  it('knowledge has core columns', () => {
    const { name, columns } = getTableConfig(knowledge);
    expect(name).toBe('knowledge');
    expect(columns.map((c) => c.name)).toEqual(
      expect.arrayContaining(['title', 'body', 'owner_person_id', 'visibility', 'id', 'slug', 'is_deleted']),
    );
  });

  it('junction tables map to the expected names', () => {
    expect(getTableConfig(knowledgeShare).name).toBe('knowledge_share');
    expect(getTableConfig(knowledgeLink).name).toBe('knowledge_link');
    expect(getTableConfig(knowledgeAttachment).name).toBe('knowledge_attachment');
    expect(getTableConfig(taskKnowledge).name).toBe('task_knowledge');
  });

  it('task_knowledge records who attached', () => {
    const names = getTableConfig(taskKnowledge).columns.map((c) => c.name);
    expect(names).toEqual(expect.arrayContaining(['task_id', 'knowledge_id', 'attached_by_person_id']));
  });
});
