import { person, department } from './identity.schema';
import { getTableColumns } from 'drizzle-orm';

it('person has email + role + soft-delete columns', () => {
  const cols = Object.keys(getTableColumns(person));
  expect(cols).toEqual(expect.arrayContaining(['id', 'slug', 'email', 'role', 'isDeleted']));
  expect(Object.keys(getTableColumns(department))).toEqual(expect.arrayContaining(['parentId', 'leadPersonId']));
});
