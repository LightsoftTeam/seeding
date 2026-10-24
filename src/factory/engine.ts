import { FactoryCycleError, MissingPersisterError } from '../errors.js';
import type {
  Attrs,
  Blueprint,
  ChildLink,
  DefinitionInput,
  ErasedSequenceValue,
  ErasedStateSource,
  FactoryContext,
  ParentLink,
  ParentSource,
  RelationMarker,
} from './types.js';

export type ProductionMode = 'make' | 'create';

const CYCLE_PATH_SEPARATOR = ' -> ';

export interface RunState {
  readonly context: FactoryContext;
  readonly mode: ProductionMode;
  readonly recycled: ReadonlyMap<string, readonly Attrs[]>;
  readonly related: Map<string, Attrs[]>;
  readonly parentChain: readonly string[];
}

export function startRun(
  context: FactoryContext,
  mode: ProductionMode,
): RunState {
  if (mode === 'create' && context.persist === undefined) {
    throw new MissingPersisterError(
      'Creating entities requires a persister in the factory context',
    );
  }

  return {
    context,
    mode,
    recycled: new Map(),
    related: new Map(),
    parentChain: [],
  };
}

export async function produceBatch(
  blueprint: Blueprint,
  run: RunState,
  count: number,
  overrides: Attrs = {},
  forced: Attrs = {},
): Promise<Attrs[]> {
  if (count === 0) {
    return [];
  }

  const scoped = scopeRecycling(
    { ...run, parentChain: [...run.parentChain, blueprint.name] },
    blueprint,
  );
  const pinnedKeys = new Set([
    ...Object.keys(overrides),
    ...Object.keys(forced),
  ]);
  const foreignKeys = await resolveSharedForeignKeys(
    blueprint,
    scoped,
    pinnedKeys,
  );
  const entities: Attrs[] = [];

  for (let index = 0; index < count; index += 1) {
    const merged = {
      ...baseAttributes(blueprint, scoped, index),
      ...foreignKeys,
      ...forced,
      ...overrides,
    };
    entities.push(await finalizeEntity(merged, blueprint, scoped));
  }
  await persistBatch(entities, blueprint, scoped);
  await produceChildren(entities, blueprint, scoped);

  return entities;
}

function scopeRecycling(run: RunState, blueprint: Blueprint): RunState {
  if (blueprint.recycled.size === 0) {
    return run;
  }

  return {
    ...run,
    recycled: new Map([...run.recycled, ...blueprint.recycled]),
  };
}

function baseAttributes(
  blueprint: Blueprint,
  run: RunState,
  sequence: number,
): Attrs {
  const input: DefinitionInput = { faker: run.context.faker, sequence };
  const layers = [
    blueprint.definition(input),
    ...blueprint.stateSteps.map((step) => evaluateState(step, input)),
    ...blueprint.sequenceSteps.map((step) => evaluateSequence(step, sequence)),
  ];

  return Object.assign({}, ...layers) as Attrs;
}

function evaluateState(
  source: ErasedStateSource,
  input: DefinitionInput,
): Attrs {
  return typeof source === 'function' ? source(input) : source;
}

function evaluateSequence(value: ErasedSequenceValue, index: number): Attrs {
  return typeof value === 'function' ? value(index) : value;
}

async function resolveSharedForeignKeys(
  blueprint: Blueprint,
  run: RunState,
  pinnedKeys: ReadonlySet<string>,
): Promise<Attrs> {
  const foreignKeys: Attrs = {};

  for (const link of blueprint.parentLinks) {
    if (pinnedKeys.has(link.foreignKey)) {
      continue;
    }
    foreignKeys[link.foreignKey] = await ownerValue(link, run);
  }

  return foreignKeys;
}

async function ownerValue(
  link: Pick<ParentLink, 'source' | 'ownerKey'>,
  run: RunState,
): Promise<unknown> {
  const parent = await resolveParent(link.source, run);

  return parent[link.ownerKey];
}

async function resolveParent(
  source: ParentSource,
  run: RunState,
): Promise<Attrs> {
  if (source.kind === 'entity') {
    return source.entity;
  }

  const recycled = run.recycled.get(source.blueprint.name);
  if (recycled !== undefined && recycled.length > 0) {
    return run.context.faker.helpers.arrayElement(recycled);
  }

  assertNoParentCycle(source.blueprint.name, run.parentChain);

  const [parent] = await produceBatch(source.blueprint, run, 1);
  recordRelated(run, source.blueprint.collection, parent as Attrs);

  return parent as Attrs;
}

function assertNoParentCycle(name: string, ancestry: readonly string[]): void {
  if (!ancestry.includes(name)) {
    return;
  }

  const path = [...ancestry, name];
  throw new FactoryCycleError(
    `Factory cycle detected: ${path.join(CYCLE_PATH_SEPARATOR)}`,
    { details: { path } },
  );
}

async function finalizeEntity(
  merged: Attrs,
  blueprint: Blueprint,
  run: RunState,
): Promise<Attrs> {
  const entity = await resolveMarkers(merged, run);
  await blueprint.afterMaking?.(entity, run.context);

  return entity;
}

async function resolveMarkers(
  attributes: Attrs,
  run: RunState,
): Promise<Attrs> {
  const resolved: Attrs = { ...attributes };

  for (const [key, value] of Object.entries(attributes)) {
    if (isRelationMarker(value)) {
      const source: ParentSource = {
        kind: 'builder',
        blueprint: value.blueprint,
      };
      resolved[key] = await ownerValue(
        { source, ownerKey: value.ownerKey },
        run,
      );
    }
  }

  return resolved;
}

function isRelationMarker(value: unknown): value is RelationMarker {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { kind?: unknown }).kind === 'belongsTo' &&
    'blueprint' in value
  );
}

async function persistBatch(
  entities: Attrs[],
  blueprint: Blueprint,
  run: RunState,
): Promise<void> {
  if (run.mode === 'make') {
    return;
  }

  await run.context.persist?.upsert(
    blueprint.collection,
    entities as Array<Attrs & { id: string }>,
  );
  for (const entity of entities) {
    await blueprint.afterCreating?.(entity, run.context);
  }
}

async function produceChildren(
  parents: Attrs[],
  blueprint: Blueprint,
  run: RunState,
): Promise<void> {
  for (const parent of parents) {
    for (const link of blueprint.childLinks) {
      await produceChildBatch(parent, link, run);
    }
  }
}

async function produceChildBatch(
  parent: Attrs,
  link: ChildLink,
  run: RunState,
): Promise<void> {
  const forced = { [link.foreignKey]: parent[link.ownerKey] };
  const children = await produceBatch(
    link.blueprint,
    { ...run, parentChain: [] },
    link.blueprint.count,
    {},
    forced,
  );

  for (const child of children) {
    recordRelated(run, link.blueprint.collection, child);
  }
}

function recordRelated(run: RunState, collection: string, entity: Attrs): void {
  const bucket = run.related.get(collection) ?? [];

  bucket.push(entity);
  run.related.set(collection, bucket);
}
