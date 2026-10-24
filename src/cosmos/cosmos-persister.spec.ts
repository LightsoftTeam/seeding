import type { Database } from '@azure/cosmos';
import { describe, expect, it } from 'vitest';
import {
  MissingPartitionKeyError,
  SeedingError,
  UnknownCollectionError,
} from '../errors.js';
import { createCosmosSeedPersister } from './index.js';

interface Document {
  id: string;
  tenant?: { key?: unknown } | null;
  name?: string;
}

class FakeContainer {
  public readonly documents = new Map<string, Document>();
  public readonly upserts: Document[] = [];
  public readonly queries: string[] = [];
  public readonly deletions: Array<{ id: string; partitionKey: unknown }> = [];
  public containerDeleted = false;

  public readonly items = {
    upsert: async (document: Document) => {
      this.upserts.push(document);
      this.documents.set(this.documentKey(document), document);
    },
    query: <T>(query: string) => {
      this.queries.push(query);
      return {
        fetchAll: async () => ({
          resources: [...this.documents.values()] as T[],
        }),
      };
    },
  };

  public item(id: string, partitionKey: unknown) {
    return {
      delete: async () => {
        this.deletions.push({ id, partitionKey });
        this.documents.delete(JSON.stringify([id, partitionKey]));
      },
    };
  }

  public async delete(): Promise<void> {
    this.containerDeleted = true;
  }

  private documentKey(document: Document): string {
    return JSON.stringify([document.id, document.tenant?.key]);
  }
}

class FakeDatabase {
  public readonly containers = new Map<string, FakeContainer>();

  public container(name: string): FakeContainer {
    const container = this.containers.get(name) ?? new FakeContainer();
    this.containers.set(name, container);
    return container;
  }
}

function setup() {
  const database = new FakeDatabase();
  const persister = createCosmosSeedPersister({
    database: database as unknown as Database,
    collections: {
      users: { container: 'people-store', partitionKeyPath: '/tenant/key' },
      orders: { container: 'purchases-store', partitionKeyPath: '/tenant/key' },
    },
  });

  return { database, persister };
}

describe('createCosmosSeedPersister', () => {
  it('upserts documents into their configured container', async () => {
    const { database, persister } = setup();
    const document = { id: 'u1', tenant: { key: 'team-a' }, name: 'Ada' };

    await persister.upsert('users', [document]);

    expect(database.container('people-store').upserts).toEqual([document]);
  });

  it('keeps upserts idempotent for the same id and partition', async () => {
    const { persister } = setup();
    const document = { id: 'u1', tenant: { key: 'team-a' } };
    await persister.upsert('users', [{ ...document, name: 'old' }]);
    await persister.upsert('users', [{ ...document, name: 'new' }]);

    expect(await persister.findAll<Document>('users')).toEqual([
      { ...document, name: 'new' },
    ]);
  });

  it('finds all documents using a cross-partition query', async () => {
    const { database, persister } = setup();
    const documents = [
      { id: 'u1', tenant: { key: 'team-a' } },
      { id: 'u2', tenant: { key: 'team-b' } },
    ];
    await persister.upsert('users', documents);

    expect({
      documents: await persister.findAll<Document>('users'),
      queries: database.container('people-store').queries,
    }).toEqual({ documents, queries: ['SELECT * FROM c'] });
  });

  it('finds no documents in an empty mapped collection', async () => {
    const { persister } = setup();

    expect(await persister.findAll('users')).toEqual([]);
  });

  it.each([
    { id: 'u1' },
    { id: 'u1', tenant: null },
    { id: 'u1', tenant: {} },
    { id: 'u1', tenant: { key: undefined } },
  ])('rejects a missing nested partition key in %j', async (document) => {
    const { persister } = setup();

    await expect(persister.upsert('users', [document])).rejects.toBeInstanceOf(
      MissingPartitionKeyError,
    );
  });

  it('does not write a document whose partition key is absent', async () => {
    const { database, persister } = setup();

    await persister.upsert('users', [{ id: 'u1' }]).catch(() => undefined);

    expect(database.container('people-store').upserts).toEqual([]);
  });

  it('validates the entire batch before upserting any documents', async () => {
    const { database, persister } = setup();

    await expect(
      persister.upsert('users', [
        { id: 'valid', tenant: { key: 'team-a' } },
        { id: 'missing' },
      ]),
    ).rejects.toBeInstanceOf(MissingPartitionKeyError);

    expect(database.container('people-store').upserts).toEqual([]);
  });

  it('reports the configured partition path in a core error', async () => {
    const { persister } = setup();

    await expect(
      persister.upsert('users', [{ id: 'u1' }]),
    ).rejects.toMatchObject({
      name: 'MissingPartitionKeyError',
      code: 'MISSING_PARTITION_KEY',
      details: { path: '/tenant/key' },
    });
  });

  it.each([null, false, 0, ''])(
    'accepts a present partition value %j',
    async (key) => {
      const { persister } = setup();

      await expect(
        persister.upsert('users', [{ id: 'u1', tenant: { key } }]),
      ).resolves.toBeUndefined();
    },
  );

  it('supports a root-level partition key path', async () => {
    const database = new FakeDatabase();
    const persister = createCosmosSeedPersister({
      database: database as unknown as Database,
      collections: { users: { container: 'people', partitionKeyPath: '/id' } },
    });

    await expect(
      persister.upsert('users', [{ id: 'u1' }]),
    ).resolves.toBeUndefined();
  });

  it('rejects inherited partition properties', async () => {
    const { persister } = setup();
    const tenant = Object.create({ key: 'inherited' }) as { key: string };

    await expect(
      persister.upsert('users', [{ id: 'u1', tenant }]),
    ).rejects.toBeInstanceOf(MissingPartitionKeyError);
  });

  it.each(['upsert', 'findAll', 'reset'] as const)(
    'rejects an unknown collection for %s',
    async (operation) => {
      const { persister } = setup();
      const result =
        operation === 'reset'
          ? persister.reset(['missing'])
          : operation === 'upsert'
            ? persister.upsert('missing', [])
            : persister.findAll('missing');

      await expect(result).rejects.toThrowError(
        'Unknown collection "missing". Available collections: users, orders',
      );
    },
  );

  it('does not treat prototype properties as configured collections', async () => {
    const { persister } = setup();

    await expect(persister.findAll('constructor')).rejects.toBeInstanceOf(
      UnknownCollectionError,
    );
  });

  it('uses SeedingError subclasses for unknown collections', async () => {
    const { persister } = setup();

    await expect(persister.findAll('missing')).rejects.toBeInstanceOf(
      SeedingError,
    );
  });

  it('lists no configured collections when the mapping is empty', async () => {
    const persister = createCosmosSeedPersister({
      database: new FakeDatabase() as unknown as Database,
      collections: {},
    });

    await expect(persister.findAll('missing')).rejects.toThrowError(
      'Available collections: (none)',
    );
  });
});

describe('Cosmos persister reset', () => {
  it('deletes items from every mapped container while retaining containers', async () => {
    const { database, persister } = setup();
    await persister.upsert('users', [{ id: 'u1', tenant: { key: 'team-a' } }]);
    await persister.upsert('orders', [{ id: 'o1', tenant: { key: 'team-b' } }]);
    const unrelated = database.container('unmapped-store');
    await unrelated.items.upsert({ id: 'keep', tenant: { key: 'team-c' } });

    await persister.reset();

    expect(
      [...database.containers.values()].map((container) => ({
        count: container.documents.size,
        deleted: container.containerDeleted,
      })),
    ).toEqual([
      { count: 0, deleted: false },
      { count: 0, deleted: false },
      { count: 1, deleted: false },
    ]);
  });

  it('uses each document nested partition key when deleting matching ids', async () => {
    const { database, persister } = setup();
    await persister.upsert('users', [
      { id: 'shared-id', tenant: { key: 'team-a' } },
      { id: 'shared-id', tenant: { key: 'team-b' } },
    ]);

    await persister.reset(['users']);

    expect(database.container('people-store').deletions).toEqual([
      { id: 'shared-id', partitionKey: 'team-a' },
      { id: 'shared-id', partitionKey: 'team-b' },
    ]);
  });

  it('deletes items only from selected collections', async () => {
    const { persister } = setup();
    await persister.upsert('users', [{ id: 'u1', tenant: { key: 'team-a' } }]);
    const order = { id: 'o1', tenant: { key: 'team-b' } };
    await persister.upsert('orders', [order]);

    await persister.reset(['users']);

    expect({
      users: await persister.findAll('users'),
      orders: await persister.findAll('orders'),
    }).toEqual({ users: [], orders: [order] });
  });

  it('does nothing for an empty selection', async () => {
    const { database, persister } = setup();

    await persister.reset([]);

    expect(database.containers.size).toBe(0);
  });

  it('validates all selected collections before deleting any items', async () => {
    const { database, persister } = setup();
    await persister.upsert('users', [{ id: 'u1', tenant: { key: 'team-a' } }]);

    await expect(persister.reset(['users', 'missing'])).rejects.toBeInstanceOf(
      UnknownCollectionError,
    );

    expect(database.container('people-store').deletions).toEqual([]);
  });

  it('rejects missing partition keys when clearing existing documents', async () => {
    const { database, persister } = setup();
    await database.container('people-store').items.upsert({ id: 'legacy' });

    await expect(persister.reset(['users'])).rejects.toBeInstanceOf(
      MissingPartitionKeyError,
    );
  });

  it('validates every document before deleting any documents', async () => {
    const { database, persister } = setup();
    const container = database.container('people-store');
    const documents = [
      { id: 'valid', tenant: { key: 'team-a' } },
      { id: 'missing' },
    ];
    for (const document of documents) {
      await container.items.upsert(document);
    }

    await expect(persister.reset(['users'])).rejects.toBeInstanceOf(
      MissingPartitionKeyError,
    );

    expect(container.deletions).toEqual([]);
    expect([...container.documents.values()]).toEqual(documents);
  });

  it('reports at most five offending ids without exposing document data', async () => {
    const { database, persister } = setup();
    const container = database.container('people-store');
    for (let index = 0; index < 7; index += 1) {
      await container.items.upsert({ id: `missing-${index}`, name: 'private' });
    }

    await expect(persister.reset(['users'])).rejects.toMatchObject({
      code: 'MISSING_PARTITION_KEY',
      details: {
        path: '/tenant/key',
        documentIds: [
          'missing-0',
          'missing-1',
          'missing-2',
          'missing-3',
          'missing-4',
        ],
      },
    });
    expect(container.deletions).toEqual([]);
  });

  it('validates documents in all selected containers before deleting anything', async () => {
    const { database, persister } = setup();
    await persister.upsert('users', [
      { id: 'valid', tenant: { key: 'team-a' } },
    ]);
    await database.container('purchases-store').items.upsert({ id: 'missing' });

    await expect(persister.reset()).rejects.toBeInstanceOf(
      MissingPartitionKeyError,
    );

    expect(database.container('people-store').deletions).toEqual([]);
    expect(database.container('purchases-store').deletions).toEqual([]);
  });
});
