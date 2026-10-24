import { FactoryBuilder } from './factory-builder.js';
import type { Blueprint, FactoryConfig } from './types.js';

const DEFAULT_COUNT = 1;

/**
 * Defines a factory. Pass `states` without an explicit generic argument to get
 * typed state names; with `defineFactory<User>(...)` state names are `string`.
 */
export function defineFactory<
  T extends { id: string },
  TStates extends string = string,
>(config: FactoryConfig<T, TStates>): FactoryBuilder<T, TStates> {
  const blueprint = {
    name: config.name,
    collection: config.collection,
    definition: config.definition,
    namedStates: config.states ?? {},
    afterMaking: config.afterMaking,
    afterCreating: config.afterCreating,
    stateSteps: [],
    sequenceSteps: [],
    count: DEFAULT_COUNT,
    parentLinks: [],
    childLinks: [],
    recycled: new Map(),
  } as unknown as Blueprint;

  return new FactoryBuilder<T, TStates>(blueprint);
}
