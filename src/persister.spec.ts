import { describe, expect, it } from 'vitest';
import { InMemorySeedPersister } from './persister.js';
import type { InspectableSeedPersister } from './persister.js';

describe('InMemorySeedPersister', () => {
  it('overwrites a document with the same id', async () => {
    const persister = new InMemorySeedPersister();

    await persister.upsert('users', [{ id: 'u1', name: 'old' }]);
    await persister.upsert('users', [{ id: 'u1', name: 'new' }]);

    expect(persister.documentsIn('users')).toEqual([{ id: 'u1', name: 'new' }]);
  });

  it('keeps documents with different ids', async () => {
    const persister = new InMemorySeedPersister();

    await persister.upsert('users', [{ id: 'u1' }, { id: 'u2' }]);

    expect(persister.documentsIn('users')).toHaveLength(2);
  });

  it('lists the collections that received documents', async () => {
    const persister = new InMemorySeedPersister();

    await persister.upsert('users', [{ id: 'u1' }]);
    await persister.upsert('orders', [{ id: 'o1' }]);

    expect(persister.collectionNames()).toEqual(['users', 'orders']);
  });

  it('finds typed documents through the shared inspectable port', async () => {
    const persister: InspectableSeedPersister = new InMemorySeedPersister();
    const document = { id: 'u1', name: 'Ada' };
    await persister.upsert('users', [document]);

    expect(await persister.findAll<typeof document>('users')).toEqual([
      document,
    ]);
  });

  it('finds no documents in an unknown collection', async () => {
    const persister = new InMemorySeedPersister();

    expect(await persister.findAll('missing')).toEqual([]);
  });

  it('returns a separate array when finding documents', async () => {
    const persister = new InMemorySeedPersister();
    await persister.upsert('users', [{ id: 'u1' }]);

    const documents = await persister.findAll('users');
    documents.pop();

    expect(persister.documentsIn('users')).toEqual([{ id: 'u1' }]);
  });

  it('resets every collection when none are selected', async () => {
    const persister = new InMemorySeedPersister();
    await persister.upsert('users', [{ id: 'u1' }]);
    await persister.upsert('orders', [{ id: 'o1' }]);

    await persister.reset();

    expect(persister.collectionNames()).toEqual([]);
  });

  it('resets selected collections and preserves the others', async () => {
    const persister = new InMemorySeedPersister();
    await persister.upsert('users', [{ id: 'u1' }]);
    await persister.upsert('orders', [{ id: 'o1' }]);

    await persister.reset(['users']);

    expect({
      users: await persister.findAll('users'),
      orders: await persister.findAll('orders'),
    }).toEqual({ users: [], orders: [{ id: 'o1' }] });
  });

  it('preserves documents when resetting an empty selection', async () => {
    const persister = new InMemorySeedPersister();
    await persister.upsert('users', [{ id: 'u1' }]);

    await persister.reset([]);

    expect(persister.documentsIn('users')).toEqual([{ id: 'u1' }]);
  });

  it('allows resetting a collection before any documents exist', async () => {
    const persister = new InMemorySeedPersister();

    await expect(persister.reset(['users'])).resolves.toBeUndefined();
  });
});
