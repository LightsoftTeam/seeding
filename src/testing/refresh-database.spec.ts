import { describe, expect, it, vi } from 'vitest';
import { FreshConfirmationError, FreshForbiddenError } from '../errors.js';
import { InMemorySeedPersister } from '../persister.js';
import { refreshDatabase } from './index.js';
import type { RefreshDatabaseOptions } from './index.js';

const VALID_GUARD: NonNullable<RefreshDatabaseOptions['guard']> = {
  environment: 'test',
  allowedEnvironments: ['test'],
  target: { host: 'localhost', database: 'seed-tests' },
  confirm: 'localhost/seed-tests',
};

async function seededPersister(): Promise<InMemorySeedPersister> {
  const persister = new InMemorySeedPersister();
  await persister.upsert('users', [{ id: 'u1' }]);
  await persister.upsert('orders', [{ id: 'o1' }]);
  return persister;
}

describe('refreshDatabase', () => {
  it('deletes all collections without a guard', async () => {
    const persister = await seededPersister();

    await refreshDatabase(persister);

    expect(persister.collectionNames()).toEqual([]);
  });

  it('deletes selected collections and preserves the rest', async () => {
    const persister = await seededPersister();

    await refreshDatabase(persister, { collections: ['users'] });

    expect({
      users: await persister.findAll('users'),
      orders: await persister.findAll('orders'),
    }).toEqual({ users: [], orders: [{ id: 'o1' }] });
  });

  it('preserves every collection for an empty selection', async () => {
    const persister = await seededPersister();

    await refreshDatabase(persister, { collections: [] });

    expect(persister.collectionNames()).toEqual(['users', 'orders']);
  });

  it('deletes selected collections after a valid guard', async () => {
    const persister = await seededPersister();
    const reset = vi.spyOn(persister, 'reset');

    await refreshDatabase(persister, {
      collections: ['users'],
      guard: VALID_GUARD,
    });

    expect(reset).toHaveBeenCalledExactlyOnceWith(['users']);
    expect(persister.collectionNames()).toEqual(['orders']);
  });

  it('does not call reset when the environment guard fails', async () => {
    const persister = await seededPersister();
    const reset = vi.spyOn(persister, 'reset');

    await expect(
      refreshDatabase(persister, {
        guard: { ...VALID_GUARD, environment: 'production' },
      }),
    ).rejects.toBeInstanceOf(FreshForbiddenError);

    expect(reset).not.toHaveBeenCalled();
    expect(persister.collectionNames()).toEqual(['users', 'orders']);
  });

  it('does not call reset when target confirmation fails', async () => {
    const persister = await seededPersister();
    const reset = vi.spyOn(persister, 'reset');

    await expect(
      refreshDatabase(persister, {
        guard: { ...VALID_GUARD, confirm: 'wrong/database' },
      }),
    ).rejects.toBeInstanceOf(FreshConfirmationError);

    expect(reset).not.toHaveBeenCalled();
  });

  it('propagates reset errors', async () => {
    const persister = new InMemorySeedPersister();
    const failure = new Error('Cannot reset storage');
    vi.spyOn(persister, 'reset').mockRejectedValue(failure);

    await expect(refreshDatabase(persister)).rejects.toBe(failure);
  });
});
