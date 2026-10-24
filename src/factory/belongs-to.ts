import type { FactoryBuilder } from './factory-builder.js';
import type { RelationMarker } from './types.js';

const DEFAULT_OWNER_KEY = 'id';

/**
 * Lazy relation for use inside a definition: the attribute receives the
 * parent's `ownerKey`, resolving the parent like `.for()` does (recycle aware).
 */
export function belongsTo<TParent extends { id: string }>(
  builder: FactoryBuilder<TParent, string>,
  ownerKey: keyof TParent & string = DEFAULT_OWNER_KEY as keyof TParent &
    string,
): RelationMarker {
  return { kind: 'belongsTo', blueprint: builder.blueprint, ownerKey };
}
