import { UnknownFactoryStateError } from '../errors.js';
import { produceBatch, startRun } from './engine.js';
import type { ProductionMode, RunState } from './engine.js';
import type {
  Attributes,
  Attrs,
  Blueprint,
  FactoryContext,
  FactoryGraph,
  SequenceValue,
  StateSource,
} from './types.js';

const DEFAULT_OWNER_KEY = 'id';
const SINGLE_ENTITY = 1;

/** Immutable: every modifier returns a new builder. */
export class FactoryBuilder<
  T extends { id: string },
  TStates extends string = string,
> {
  public constructor(public readonly blueprint: Blueprint) {}

  public state(source: TStates | StateSource<T>): FactoryBuilder<T, TStates> {
    const resolved =
      typeof source === 'string' ? this.namedState(source) : source;

    return this.evolve({
      stateSteps: [...this.blueprint.stateSteps, resolved as Attrs],
    });
  }

  public sequence(...values: SequenceValue<T>[]): FactoryBuilder<T, TStates> {
    if (values.length === 0) {
      return this;
    }
    const cycling = (index: number): Attrs => {
      const value = values[index % values.length];
      return (typeof value === 'function' ? value(index) : value) as Attrs;
    };

    return this.evolve({
      sequenceSteps: [...this.blueprint.sequenceSteps, cycling],
    });
  }

  public count(amount: number): FactoryBuilder<T, TStates> {
    return this.evolve({ count: amount });
  }

  public for<TParent extends object>(
    parent: TParent | FactoryBuilder<{ id: string }, string>,
    foreignKey: keyof T & string,
    ownerKey: string = DEFAULT_OWNER_KEY,
  ): FactoryBuilder<T, TStates> {
    const source =
      parent instanceof FactoryBuilder
        ? ({ kind: 'builder', blueprint: parent.blueprint } as const)
        : ({ kind: 'entity', entity: parent as Attrs } as const);

    return this.evolve({
      parentLinks: [
        ...this.blueprint.parentLinks,
        { source, foreignKey, ownerKey },
      ],
    });
  }

  public has<TChild extends { id: string }>(
    child: FactoryBuilder<TChild, string>,
    foreignKey: keyof TChild & string,
    ownerKey: string = DEFAULT_OWNER_KEY,
  ): FactoryBuilder<T, TStates> {
    const link = { blueprint: child.blueprint, foreignKey, ownerKey };

    return this.evolve({ childLinks: [...this.blueprint.childLinks, link] });
  }

  public recycle<TOther extends { id: string }>(
    factory: FactoryBuilder<TOther, string>,
    entities: readonly TOther[],
  ): FactoryBuilder<T, TStates> {
    const recycled = new Map(this.blueprint.recycled);

    recycled.set(factory.blueprint.name, entities as readonly Attrs[]);

    return this.evolve({ recycled });
  }

  public async make(
    context: FactoryContext,
    overrides?: Attributes<T>,
  ): Promise<T> {
    return this.produceOne('make', context, overrides);
  }

  public async makeMany(
    context: FactoryContext,
    overrides?: Attributes<T>,
  ): Promise<T[]> {
    return this.produceMany('make', context, overrides);
  }

  public async create(
    context: FactoryContext,
    overrides?: Attributes<T>,
  ): Promise<T> {
    return this.produceOne('create', context, overrides);
  }

  public async createMany(
    context: FactoryContext,
    overrides?: Attributes<T>,
  ): Promise<T[]> {
    return this.produceMany('create', context, overrides);
  }

  public async makeGraph(
    context: FactoryContext,
    overrides?: Attributes<T>,
  ): Promise<FactoryGraph<T>> {
    const run = startRun(context, 'make');
    const entities = await this.run(run, this.blueprint.count, overrides);

    return { entities, related: Object.fromEntries(run.related) };
  }

  private async produceOne(
    mode: ProductionMode,
    context: FactoryContext,
    overrides?: Attributes<T>,
  ): Promise<T> {
    const [entity] = await this.run(
      startRun(context, mode),
      SINGLE_ENTITY,
      overrides,
    );

    return entity as T;
  }

  private produceMany(
    mode: ProductionMode,
    context: FactoryContext,
    overrides?: Attributes<T>,
  ): Promise<T[]> {
    return this.run(startRun(context, mode), this.blueprint.count, overrides);
  }

  private async run(
    run: RunState,
    count: number,
    overrides?: Attributes<T>,
  ): Promise<T[]> {
    const entities = await produceBatch(
      this.blueprint,
      run,
      count,
      overrides as Attrs,
    );

    return entities as T[];
  }

  private namedState(name: string): StateSource<T> {
    const found = this.blueprint.namedStates[name];

    if (found === undefined) {
      throw new UnknownFactoryStateError(
        `Factory "${this.blueprint.name}" has no state named "${name}"`,
        { details: { factory: this.blueprint.name, state: name } },
      );
    }

    return found as StateSource<T>;
  }

  private evolve(changes: Partial<Blueprint>): FactoryBuilder<T, TStates> {
    return new FactoryBuilder({ ...this.blueprint, ...changes });
  }
}
