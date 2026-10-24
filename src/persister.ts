export interface SeedPersister {
  upsert<T extends { id: string }>(
    collection: string,
    documents: readonly T[],
  ): Promise<void>;
}

/** A persister that can inspect and clear documents for database tests. */
export interface InspectableSeedPersister extends SeedPersister {
  findAll<T = unknown>(collection: string): Promise<T[]>;
  reset(collections?: string[]): Promise<void>;
}

export class InMemorySeedPersister implements InspectableSeedPersister {
  private readonly collections = new Map<string, Map<string, unknown>>();

  public async upsert<T extends { id: string }>(
    collection: string,
    documents: readonly T[],
  ): Promise<void> {
    const stored = this.collections.get(collection) ?? new Map();

    for (const document of documents) {
      stored.set(document.id, document);
    }
    this.collections.set(collection, stored);
  }

  public documentsIn<T = unknown>(collection: string): T[] {
    return [...(this.collections.get(collection)?.values() ?? [])] as T[];
  }

  public async findAll<T = unknown>(collection: string): Promise<T[]> {
    return this.documentsIn<T>(collection);
  }

  public async reset(collections?: string[]): Promise<void> {
    if (collections === undefined) {
      this.collections.clear();
      return;
    }

    for (const collection of collections) {
      this.collections.delete(collection);
    }
  }

  public collectionNames(): string[] {
    return [...this.collections.keys()];
  }
}
