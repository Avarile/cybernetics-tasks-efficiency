import { getTableColumns } from 'drizzle-orm';
import { activityEvent, initiativeState, keyResultMeasurement, rawInput, reasonTaxonomy } from './tracking.schema';

describe('Tracking schema column assertions', () => {
  it('activityEvent is append-only: has payload, occurredAt, subjectId, type — and NO isDeleted', () => {
    const cols = Object.keys(getTableColumns(activityEvent));
    expect(cols).toEqual(
      expect.arrayContaining([
        'id',
        'slug',
        'occurredAt',
        'recordedAt',
        'actorPersonId',
        'subjectType',
        'subjectId',
        'type',
        'payload',
        'source',
        'confidence',
        'rawInputId',
        'correlationId',
      ]),
    );
    // Prove append-only: no mutation/soft-delete columns
    expect(cols).not.toContain('isDeleted');
    expect(cols).not.toContain('deletedAt');
    expect(cols).not.toContain('updatedAt');
    expect(cols).not.toContain('isActive');
  });

  it('initiativeState has status, totalTimeLoggedMinutes, blockedSince and defaultFields', () => {
    const cols = Object.keys(getTableColumns(initiativeState));
    expect(cols).toEqual(
      expect.arrayContaining([
        'id',
        'slug',
        'initiativeId',
        'status',
        'totalTimeLoggedMinutes',
        'blockedSince',
        'lastEventAt',
        'isDeleted',
        'isActive',
        'createdAt',
        'updatedAt',
      ]),
    );
  });

  it('keyResultMeasurement has keyResultId, value, measuredAt, sourceEventId', () => {
    const cols = Object.keys(getTableColumns(keyResultMeasurement));
    expect(cols).toEqual(
      expect.arrayContaining([
        'id',
        'slug',
        'keyResultId',
        'value',
        'measuredAt',
        'sourceEventId',
        'isDeleted',
      ]),
    );
  });

  it('rawInput has personId, channel, text, receivedAt, metadata and defaultFields', () => {
    const cols = Object.keys(getTableColumns(rawInput));
    expect(cols).toEqual(
      expect.arrayContaining([
        'id',
        'slug',
        'personId',
        'channel',
        'text',
        'receivedAt',
        'metadata',
        'isDeleted',
      ]),
    );
  });

  it('reasonTaxonomy has label and category plus defaultFields', () => {
    const cols = Object.keys(getTableColumns(reasonTaxonomy));
    expect(cols).toEqual(
      expect.arrayContaining(['id', 'slug', 'label', 'category', 'isDeleted']),
    );
  });
});
