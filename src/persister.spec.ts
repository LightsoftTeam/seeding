import { describe, expect, it } from 'vitest';
import { InMemorySeedPersister } from './persister.js';

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
});
