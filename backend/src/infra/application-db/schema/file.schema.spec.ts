import { getTableConfig } from 'drizzle-orm/pg-core';
import { attachment } from './file.schema';

describe('attachment schema', () => {
  it('maps to the attachment table with required columns', () => {
    const { name, columns } = getTableConfig(attachment);
    const names = columns.map((c) => c.name);
    expect(name).toBe('attachment');
    expect(names).toEqual(
      expect.arrayContaining([
        'token', 'bucket', 'path', 'hash', 'size', 'mimetype',
        'purpose', 'created_by_person_id', 'id', 'slug', 'is_deleted',
      ]),
    );
  });

  it('token is not nullable', () => {
    const { columns } = getTableConfig(attachment);
    const token = columns.find((c) => c.name === 'token')!;
    expect(token.notNull).toBe(true);
  });
});
