import { AssertionError } from 'node:assert';
import { describe, expect, it } from 'vitest';
import { InMemorySeedPersister } from '../persister.js';
import {
  assertDatabaseCount,
  assertDatabaseHas,
  assertDatabaseMissing,
} from './index.js';

async function seededPersister(): Promise<InMemorySeedPersister> {
  const persister = new InMemorySeedPersister();
  await persister.upsert(
    'users',
    ['u1', 'u2', 'u3', 'u4'].map((id, index) => ({
      id,
      active: index < 2,
      profile: { city: 'Lima', secret: 'private-document-body' },
      roles: ['reader', 'writer'],
    })),
  );
  return persister;
}

async function assertionFailure(
  action: Promise<void>,
): Promise<AssertionError> {
  try {
    await action;
  } catch (error) {
    if (error instanceof AssertionError) {
      return error;
    }
    throw error;
  }
  throw new Error('Expected an AssertionError');
}

describe('assertDatabaseHas', () => {
  it('passes when a document matches nested partial fields and exact arrays', async () => {
    const persister = await seededPersister();

    await expect(
      assertDatabaseHas(persister, 'users', {
        profile: { city: 'Lima' },
        roles: ['reader', 'writer'],
      }),
    ).resolves.toBeUndefined();
  });

  it('fails with collection, expected fields, inspected count and at most three IDs', async () => {
    const error = await assertionFailure(
      assertDatabaseHas(await seededPersister(), 'users', {
        active: 'missing',
      }),
    );

    expect(error).toMatchObject({
      code: 'ERR_ASSERTION',
      operator: 'assertDatabaseHas',
      expected: { active: 'missing' },
      actual: { inspectedCount: 4, sampleIds: ['u1', 'u2', 'u3'] },
    });
    expect(error.message).toContain('users');
    expect(error.message).toContain("active: 'missing'");
    expect(error.message).toContain('Inspected 4 documents');
    expect(error.message).toContain("[ 'u1', 'u2', 'u3' ]");
    expect(error.message).not.toContain('u4');
    expect(error.message).not.toContain('private-document-body');
  });

  it('fails on an empty collection with an empty ID sample', async () => {
    const error = await assertionFailure(
      assertDatabaseHas(new InMemorySeedPersister(), 'missing', { id: 'u1' }),
    );

    expect(error).toMatchObject({
      actual: { inspectedCount: 0, sampleIds: [] },
      message: expect.stringContaining('Inspected 0 documents'),
    });
  });

  it('does not accept a partial array', async () => {
    await expect(
      assertDatabaseHas(await seededPersister(), 'users', {
        roles: ['reader'],
      }),
    ).rejects.toBeInstanceOf(AssertionError);
  });
});

describe('assertDatabaseMissing', () => {
  it('passes when no document matches', async () => {
    await expect(
      assertDatabaseMissing(await seededPersister(), 'users', { id: 'absent' }),
    ).resolves.toBeUndefined();
  });

  it('passes for an empty collection', async () => {
    await expect(
      assertDatabaseMissing(new InMemorySeedPersister(), 'missing', {}),
    ).resolves.toBeUndefined();
  });

  it('fails with the matching ID without exposing document contents', async () => {
    const error = await assertionFailure(
      assertDatabaseMissing(await seededPersister(), 'users', {
        id: 'u2',
        profile: { city: 'Lima' },
      }),
    );

    expect(error).toMatchObject({
      code: 'ERR_ASSERTION',
      operator: 'assertDatabaseMissing',
      actual: 'u2',
    });
    expect(error.message).toContain('users');
    expect(error.message).toContain('u2');
    expect(error.message).not.toContain('private-document-body');
  });
});

describe('assertDatabaseCount', () => {
  it('passes when the entire collection has the expected count', async () => {
    await expect(
      assertDatabaseCount(await seededPersister(), 'users', 4),
    ).resolves.toBeUndefined();
  });

  it('counts only documents matching the where filter', async () => {
    await expect(
      assertDatabaseCount(await seededPersister(), 'users', 2, {
        active: true,
        profile: { city: 'Lima' },
      }),
    ).resolves.toBeUndefined();
  });

  it('uses exact arrays in the where filter', async () => {
    await expect(
      assertDatabaseCount(await seededPersister(), 'users', 0, {
        roles: ['reader'],
      }),
    ).resolves.toBeUndefined();
  });

  it('passes with zero for a missing collection', async () => {
    await expect(
      assertDatabaseCount(new InMemorySeedPersister(), 'missing', 0),
    ).resolves.toBeUndefined();
  });

  it('fails with the expected and actual counts', async () => {
    const error = await assertionFailure(
      assertDatabaseCount(await seededPersister(), 'users', 3),
    );

    expect(error).toMatchObject({
      code: 'ERR_ASSERTION',
      operator: 'assertDatabaseCount',
      actual: 4,
      expected: 3,
      message: 'Expected 3 documents in collection "users", but found 4.',
    });
  });

  it('reports the filter and filtered count on failure', async () => {
    const error = await assertionFailure(
      assertDatabaseCount(await seededPersister(), 'users', 1, {
        active: true,
      }),
    );

    expect(error).toMatchObject({
      actual: 2,
      expected: 1,
      message: expect.stringContaining('matching { active: true }'),
    });
  });
});
