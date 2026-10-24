import { AssertionError } from 'node:assert';
import { inspect } from 'node:util';
import type { InspectableSeedPersister } from '../persister.js';
import { matchesPartial } from './matches-partial.js';

const MAX_SAMPLE_IDS = 3;
const UNKNOWN_DOCUMENT_ID = '(unknown)';

/** Assert that at least one document partially matches the expected fields. */
export async function assertDatabaseHas(
  persister: InspectableSeedPersister,
  collection: string,
  expected: Record<string, unknown>,
): Promise<void> {
  const documents = await persister.findAll(collection);
  if (documents.some((document) => matchesPartial(document, expected))) {
    return;
  }

  const sampleIds = documents.slice(0, MAX_SAMPLE_IDS).map(documentId);
  throw new AssertionError({
    message: `Collection "${collection}" has no document matching ${inspect(expected, { depth: null })}. Inspected ${documents.length} documents. First IDs: ${inspect(sampleIds)}.`,
    actual: { inspectedCount: documents.length, sampleIds },
    expected,
    operator: 'assertDatabaseHas',
    stackStartFn: assertDatabaseHas,
  });
}

/** Assert that no document partially matches the expected fields. */
export async function assertDatabaseMissing(
  persister: InspectableSeedPersister,
  collection: string,
  expected: Record<string, unknown>,
): Promise<void> {
  const documents = await persister.findAll(collection);
  const match = documents.find((document) =>
    matchesPartial(document, expected),
  );
  if (match === undefined) {
    return;
  }

  throw new AssertionError({
    message: `Collection "${collection}" contains a matching document with id ${inspect(documentId(match))}.`,
    actual: documentId(match),
    expected: 'no matching document',
    operator: 'assertDatabaseMissing',
    stackStartFn: assertDatabaseMissing,
  });
}

/** Assert the document count, optionally limited to partially matching fields. */
export async function assertDatabaseCount(
  persister: InspectableSeedPersister,
  collection: string,
  count: number,
  where?: Record<string, unknown>,
): Promise<void> {
  const documents = await persister.findAll(collection);
  const actual =
    where === undefined
      ? documents.length
      : documents.filter((document) => matchesPartial(document, where)).length;
  if (actual === count) {
    return;
  }

  throw new AssertionError({
    message: `Expected ${count} documents in collection "${collection}"${where === undefined ? '' : ` matching ${inspect(where, { depth: null })}`}, but found ${actual}.`,
    actual,
    expected: count,
    operator: 'assertDatabaseCount',
    stackStartFn: assertDatabaseCount,
  });
}

function documentId(document: unknown): string {
  if (
    typeof document !== 'object' ||
    document === null ||
    !('id' in document)
  ) {
    return UNKNOWN_DOCUMENT_ID;
  }

  return typeof document.id === 'string' ? document.id : UNKNOWN_DOCUMENT_ID;
}
