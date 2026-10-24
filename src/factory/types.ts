import type { Faker } from '@faker-js/faker';
import type { SeedPersister } from '../persister.js';

/** What a factory needs at runtime. A `SeederContext` is assignable to it. */
export interface FactoryContext {
  readonly faker: Faker;
  readonly persist?: SeedPersister;
}

export type Attributes<T> = Partial<T>;

export interface DefinitionInput {
  readonly faker: Faker;
  /** 0-based position of the entity inside the current batch. */
  readonly sequence: number;
}

export type StateFunction<T> = (input: DefinitionInput) => Attributes<T>;
export type StateSource<T> = Attributes<T> | StateFunction<T>;
export type SequenceFunction<T> = (index: number) => Attributes<T>;
export type SequenceValue<T> = Attributes<T> | SequenceFunction<T>;
export type FactoryHook<T> = (
  entity: T,
  context: FactoryContext,
) => void | Promise<void>;

export interface RelationMarker {
  readonly kind: 'belongsTo';
  readonly blueprint: Blueprint;
  readonly ownerKey: string;
}

/** A definition may hold `belongsTo` markers in place of foreign keys. */
export type Definition<T> = { [K in keyof T]: T[K] | RelationMarker };

export interface FactoryConfig<
  T extends { id: string },
  TStates extends string,
> {
  readonly name: string;
  readonly collection: string;
  readonly definition: (input: DefinitionInput) => Definition<T>;
  readonly states?: Readonly<Record<TStates, StateSource<T>>>;
  readonly afterMaking?: FactoryHook<T>;
  readonly afterCreating?: FactoryHook<T>;
}

export interface FactoryGraph<T> {
  readonly entities: T[];
  /** Parents and children produced around the entities, by collection. */
  readonly related: Record<string, unknown[]>;
}

/* Erased, runtime-level representation shared by builders and the engine. */

export type Attrs = Record<string, unknown>;
export type ErasedStateSource = Attrs | ((input: DefinitionInput) => Attrs);
export type ErasedSequenceValue = Attrs | ((index: number) => Attrs);
export type ErasedHook = (
  entity: Attrs,
  context: FactoryContext,
) => void | Promise<void>;

export type ParentSource =
  | { readonly kind: 'entity'; readonly entity: Attrs }
  | { readonly kind: 'builder'; readonly blueprint: Blueprint };

export interface ParentLink {
  readonly source: ParentSource;
  readonly foreignKey: string;
  readonly ownerKey: string;
}

export interface ChildLink {
  readonly blueprint: Blueprint;
  readonly foreignKey: string;
  readonly ownerKey: string;
}

export interface Blueprint {
  readonly name: string;
  readonly collection: string;
  readonly definition: (input: DefinitionInput) => Attrs;
  readonly namedStates: Readonly<Record<string, ErasedStateSource>>;
  readonly afterMaking?: ErasedHook;
  readonly afterCreating?: ErasedHook;
  readonly stateSteps: readonly ErasedStateSource[];
  readonly sequenceSteps: readonly ErasedSequenceValue[];
  readonly count: number;
  readonly parentLinks: readonly ParentLink[];
  readonly childLinks: readonly ChildLink[];
  readonly recycled: ReadonlyMap<string, readonly Attrs[]>;
}
