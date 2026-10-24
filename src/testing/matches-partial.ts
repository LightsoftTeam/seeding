import { isDeepStrictEqual } from 'node:util';

/** Match plain object fields recursively, with exact non-plain values. */
export function matchesPartial(document: unknown, expected: unknown): boolean {
  if (Object.is(document, expected)) {
    return true;
  }
  if (document instanceof Date && expected instanceof Date) {
    return Object.is(document.getTime(), expected.getTime());
  }
  if (!isPlainObject(document) || !isPlainObject(expected)) {
    return isDeepStrictEqual(document, expected);
  }

  return Object.keys(expected).every(
    (key) =>
      Object.hasOwn(document, key) &&
      matchesPartial(document[key], expected[key]),
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
