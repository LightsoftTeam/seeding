export interface SeedPersister {
  upsert<T extends { id: string }>(
    collection: string,
    documents: readonly T[],
  ): Promise<void>;
}

export class InMemorySeedPersister implements SeedPersister {
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

  public collectionNames(): string[] {
    return [...this.collections.keys()];
  }
}
