import { isDeepStrictEqual } from 'node:util';

/** Match object fields recursively, with exact arrays and Object.is primitives. */
export function matchesPartial(document: unknown, expected: unknown): boolean {
  if (Object.is(document, expected)) {
    return true;
  }
  if (Array.isArray(expected)) {
    return isDeepStrictEqual(document, expected);
  }
  if (!isRecord(document) || !isRecord(expected)) {
    return false;
  }

  return Object.keys(expected).every(
    (key) =>
      Object.hasOwn(document, key) &&
      matchesPartial(document[key], expected[key]),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
