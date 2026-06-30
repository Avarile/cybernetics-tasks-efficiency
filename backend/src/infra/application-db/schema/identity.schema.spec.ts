import { person, department } from './identity.schema';
import { getTableColumns } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';

it('person has email + role + soft-delete columns', () => {
  const cols = Object.keys(getTableColumns(person));
  expect(cols).toEqual(expect.arrayContaining(['id', 'slug', 'email', 'role', 'isDeleted']));
  expect(Object.keys(getTableColumns(department))).toEqual(expect.arrayContaining(['parentId', 'leadPersonId']));
});

it('person has the expanded profile columns', () => {
  const names = getTableConfig(person).columns.map((c) => c.name);
  expect(names).toEqual(
    expect.arrayContaining([
      'first_name', 'last_name', 'position', 'avatar_attachment_id',
      'description', 'note', 'phone', 'timezone',
    ]),
  );
});
