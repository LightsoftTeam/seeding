import type { Container, Database, PartitionKey } from '@azure/cosmos';
import {
  ConflictingCollectionConfigError,
  MissingPartitionKeyError,
  UnknownCollectionError,
} from '../errors.js';
import type { InspectableSeedPersister } from '../persister.js';

const ALL_DOCUMENTS_QUERY = 'SELECT * FROM c';
const PARTITION_PATH_SEPARATOR = '/';
const DOCUMENT_ID_KEY = 'id';
const MAX_OFFENDING_DOCUMENT_IDS = 5;

interface DocumentPartition {
  id: string;
  partitionKey: PartitionKey;
}

interface ResetTarget {
  containerId: string;
  container: Container;
  partitionKeyPath: string;
}

export interface CosmosCollection {
  container: string;
  partitionKeyPath: string;
}

export interface CosmosSeedPersisterOptions {
  database: Database;
  collections: Record<string, CosmosCollection>;
}

/** Adapt an existing Cosmos database without provisioning or deleting containers. */
export function createCosmosSeedPersister(
  options: CosmosSeedPersisterOptions,
): InspectableSeedPersister {
  return new CosmosSeedPersister(options);
}

class CosmosSeedPersister implements InspectableSeedPersister {
  public constructor(private readonly options: CosmosSeedPersisterOptions) {}

  public async upsert<T extends { id: string }>(
    collection: string,
    documents: readonly T[],
  ): Promise<void> {
    const { container, partitionKeyPath } = this.resolveCollection(collection);

    for (const document of documents) {
      readPartitionKey(document, partitionKeyPath);
    }
    for (const document of documents) {
      await container.items.upsert(document);
    }
  }

  public async findAll<T = unknown>(collection: string): Promise<T[]> {
    const { container } = this.resolveCollection(collection);
    const { resources } = await container.items
      .query<T>(ALL_DOCUMENTS_QUERY)
      .fetchAll();

    return resources;
  }

  public async reset(collections?: string[]): Promise<void> {
    const names = collections ?? Object.keys(this.options.collections);
    const targets = this.resolveResetTargets(names);
    const prepared = [];

    for (const { container, partitionKeyPath } of targets) {
      const documents = await readContainerPartitions(
        container,
        partitionKeyPath,
      );
      prepared.push({ container, documents });
    }
    for (const { container, documents } of prepared) {
      await clearContainer(container, documents);
    }
  }

  private resolveResetTargets(names: string[]): ResetTarget[] {
    const targets = new Map<string, ResetTarget>();

    for (const name of names) {
      const target = this.resolveCollection(name);
      const existing = targets.get(target.containerId);
      if (existing && existing.partitionKeyPath !== target.partitionKeyPath) {
        throw new ConflictingCollectionConfigError(
          `Conflicting partition key paths for container "${target.containerId}"`,
          { details: { containerId: target.containerId } },
        );
      }
      targets.set(target.containerId, target);
    }

    return [...targets.values()];
  }

  private resolveCollection(collection: string) {
    const configured = Object.hasOwn(this.options.collections, collection)
      ? this.options.collections[collection]
      : undefined;
    if (configured === undefined) {
      const available = Object.keys(this.options.collections);
      throw new UnknownCollectionError(
        `Unknown collection "${collection}". Available collections: ${available.join(', ') || '(none)'}`,
        { details: { requested: collection, available } },
      );
    }

    return {
      containerId: configured.container,
      container: this.options.database.container(configured.container),
      partitionKeyPath: configured.partitionKeyPath,
    };
  }
}

async function clearContainer(
  container: Container,
  documents: readonly DocumentPartition[],
): Promise<void> {
  for (const { id, partitionKey } of documents) {
    await container.item(id, partitionKey).delete();
  }
}

async function readContainerPartitions(
  container: Container,
  partitionKeyPath: string,
): Promise<DocumentPartition[]> {
  const { resources } = await container.items
    .query<{ id: string }>(ALL_DOCUMENTS_QUERY)
    .fetchAll();

  const documents: DocumentPartition[] = [];
  const missingIds: string[] = [];

  for (const document of resources) {
    const partitionKey = findPartitionKey(document, partitionKeyPath);
    if (partitionKey === undefined) {
      missingIds.push(document.id);
      continue;
    }
    documents.push({ id: document.id, partitionKey });
  }
  assertPartitionKeysPresent(missingIds, partitionKeyPath);

  return documents;
}

function assertPartitionKeysPresent(documentIds: string[], path: string): void {
  if (documentIds.length === 0) {
    return;
  }

  throw new MissingPartitionKeyError(
    `Documents are missing partition key at "${path}"`,
    {
      details: {
        path,
        documentIds: documentIds.slice(0, MAX_OFFENDING_DOCUMENT_IDS),
      },
    },
  );
}

function findPartitionKey(
  document: unknown,
  path: string,
): PartitionKey | undefined {
  const segments = path.split(PARTITION_PATH_SEPARATOR).slice(1);
  let value: unknown = document;

  for (const segment of segments) {
    value = readProperty(value, segment);
  }

  return value as PartitionKey | undefined;
}

function readPartitionKey(document: unknown, path: string): PartitionKey {
  const partitionKey = findPartitionKey(document, path);
  if (partitionKey !== undefined) {
    return partitionKey;
  }

  throw new MissingPartitionKeyError(
    `Document is missing partition key at "${path}"`,
    { details: { path, documentId: readProperty(document, DOCUMENT_ID_KEY) } },
  );
}

function readProperty(value: unknown, key: string): unknown {
  if (
    typeof value === 'object' &&
    value !== null &&
    Object.hasOwn(value, key)
  ) {
    return (value as Record<string, unknown>)[key];
  }

  return undefined;
}
