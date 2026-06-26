import { getTableColumns } from 'drizzle-orm';
import {
  objective,
  keyResult,
  initiative,
  initiativeKeyResult,
  alignmentLink,
  intervention,
  interventionKeyResult,
} from './okr.schema';

describe('OKR schema column assertions', () => {
  it('objective has required columns including defaultFields', () => {
    const cols = Object.keys(getTableColumns(objective));
    expect(cols).toEqual(
      expect.arrayContaining([
        'id',
        'slug',
        'createdAt',
        'updatedAt',
        'deletedAt',
        'isDeleted',
        'isActive',
        'title',
        'description',
        'ownerPersonId',
        'scope',
        'scopeRefId',
        'period',
        'status',
      ]),
    );
  });

  it('keyResult has metric and decimal value columns', () => {
    const cols = Object.keys(getTableColumns(keyResult));
    expect(cols).toEqual(
      expect.arrayContaining([
        'id',
        'slug',
        'objectiveId',
        'title',
        'metricType',
        'unit',
        'startValue',
        'targetValue',
        'currentValue',
        'direction',
        'isDeleted',
      ]),
    );
  });

  it('initiative has ownerPersonId, priority, dueDate, and status columns', () => {
    const cols = Object.keys(getTableColumns(initiative));
    expect(cols).toEqual(
      expect.arrayContaining([
        'id',
        'slug',
        'title',
        'ownerPersonId',
        'priority',
        'dueDate',
        'status',
        'isDeleted',
      ]),
    );
  });

  it('initiativeKeyResult has initiativeId and keyResultId', () => {
    const cols = Object.keys(getTableColumns(initiativeKeyResult));
    expect(cols).toEqual(
      expect.arrayContaining(['id', 'slug', 'initiativeId', 'keyResultId']),
    );
  });

  it('alignmentLink has fromType, fromId, toType, toId, weight', () => {
    const cols = Object.keys(getTableColumns(alignmentLink));
    expect(cols).toEqual(
      expect.arrayContaining([
        'id',
        'slug',
        'fromType',
        'fromId',
        'toType',
        'toId',
        'weight',
        'isDeleted',
      ]),
    );
  });

  it('intervention has decidedByPersonId, startedAt, hypothesis, measurementWindowDays, status', () => {
    const cols = Object.keys(getTableColumns(intervention));
    expect(cols).toEqual(
      expect.arrayContaining([
        'id',
        'slug',
        'title',
        'decidedByPersonId',
        'startedAt',
        'scope',
        'hypothesis',
        'measurementWindowDays',
        'status',
        'isDeleted',
      ]),
    );
  });

  it('interventionKeyResult has interventionId and keyResultId', () => {
    const cols = Object.keys(getTableColumns(interventionKeyResult));
    expect(cols).toEqual(
      expect.arrayContaining(['id', 'slug', 'interventionId', 'keyResultId']),
    );
  });
});
