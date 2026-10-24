import { describe, expect, it } from 'vitest';
import {
  InvalidFactoryCountError,
  MissingPersisterError,
  UnknownFactoryStateError,
} from '../errors.js';
import { InMemorySeedPersister } from '../persister.js';
import { defineFactory } from './define-factory.js';
import { testContext, userFactory } from './fixtures.js';

describe('definition and make', () => {
  it('builds an entity from the definition defaults', async () => {
    const user = await userFactory.make(testContext());

    expect(user).toMatchObject({ role: 'member', active: true });
  });

  it('gives each entity of a batch distinct ids', async () => {
    const users = await userFactory.count(3).makeMany(testContext());

    expect(new Set(users.map((user) => user.id)).size).toBe(3);
  });

  it('never touches the persister on make', async () => {
    const persister = new InMemorySeedPersister();

    await userFactory.count(2).makeMany(testContext(persister));

    expect(persister.collectionNames()).toEqual([]);
  });
});

describe('count', () => {
  it.each([-1, -0.5, 1.5, NaN, Infinity, -Infinity])(
    'rejects invalid count %s',
    (amount) => {
      expect(() => userFactory.count(amount)).toThrowError(
        InvalidFactoryCountError,
      );
      expect(() => userFactory.count(amount)).toThrowError(
        expect.objectContaining({ code: 'INVALID_FACTORY_COUNT' }),
      );
    },
  );

  it('allows zero without producing parents or persisting an empty batch', async () => {
    const persister = new InMemorySeedPersister();
    const builder = userFactory.for(userFactory, 'name').count(0);

    expect(await builder.createMany(testContext(persister))).toEqual([]);
    expect(persister.collectionNames()).toEqual([]);
  });

  it('defaults to one entity for makeMany', async () => {
    expect(await userFactory.makeMany(testContext())).toHaveLength(1);
  });

  it('sets the batch size', async () => {
    expect(await userFactory.count(4).makeMany(testContext())).toHaveLength(4);
  });

  it('is ignored by single make', async () => {
    const user = await userFactory.count(4).make(testContext());

    expect(Array.isArray(user)).toBe(false);
  });
});

describe('states', () => {
  it('applies a named state', async () => {
    const user = await userFactory.state('inactive').make(testContext());

    expect(user.active).toBe(false);
  });

  it('applies a partial object state', async () => {
    const user = await userFactory.state({ name: 'Ada' }).make(testContext());

    expect(user.name).toBe('Ada');
  });

  it('applies a function state with the definition input', async () => {
    const users = await userFactory
      .state(({ sequence }) => ({ name: `user-${sequence}` }))
      .count(2)
      .makeMany(testContext());

    expect(users.map((user) => user.name)).toEqual(['user-0', 'user-1']);
  });

  it('lets later states win', async () => {
    const user = await userFactory
      .state({ role: 'first' })
      .state('admin')
      .make(testContext());

    expect(user.role).toBe('admin');
  });

  it('keeps earlier states when later ones do not override them', async () => {
    const user = await userFactory
      .state('inactive')
      .state('admin')
      .make(testContext());

    expect(user).toMatchObject({ active: false, role: 'admin' });
  });

  it('rejects an unknown named state', () => {
    expect(() => userFactory.state('missing')).toThrowError(
      UnknownFactoryStateError,
    );
  });

  it('does not mutate the original builder', async () => {
    userFactory.state('inactive');

    const user = await userFactory.make(testContext());

    expect(user.active).toBe(true);
  });
});

describe('sequence', () => {
  it('cycles through values by index', async () => {
    const users = await userFactory
      .sequence({ role: 'a' }, { role: 'b' })
      .count(5)
      .makeMany(testContext());

    expect(users.map((user) => user.role)).toEqual(['a', 'b', 'a', 'b', 'a']);
  });

  it('accepts index functions', async () => {
    const users = await userFactory
      .sequence((index) => ({ name: `n${index}` }))
      .count(2)
      .makeMany(testContext());

    expect(users.map((user) => user.name)).toEqual(['n0', 'n1']);
  });

  it('restarts from zero on every call', async () => {
    const builder = userFactory.sequence({ role: 'a' }, { role: 'b' });

    const first = await builder.make(testContext());
    const second = await builder.make(testContext());

    expect(first.role).toBe(second.role);
  });

  it('beats states', async () => {
    const user = await userFactory
      .state({ role: 'state' })
      .sequence({ role: 'sequence' })
      .make(testContext());

    expect(user.role).toBe('sequence');
  });
});

describe('overrides precedence', () => {
  it('beats definition, states and sequence', async () => {
    const user = await userFactory
      .state({ role: 'state' })
      .sequence({ role: 'sequence' })
      .make(testContext(), { role: 'override' });

    expect(user.role).toBe('override');
  });

  it('applies to every entity of a batch', async () => {
    const users = await userFactory
      .count(2)
      .makeMany(testContext(), { active: false });

    expect(users.map((user) => user.active)).toEqual([false, false]);
  });
});

describe('create', () => {
  it('persists the batch once into the collection', async () => {
    const persister = new InMemorySeedPersister();

    const users = await userFactory.count(3).createMany(testContext(persister));

    expect(persister.documentsIn('users')).toEqual(users);
  });

  it('requires a persister', async () => {
    const create = userFactory.create(testContext());

    await expect(create).rejects.toBeInstanceOf(MissingPersisterError);
  });

  it('requires a persister for createMany too', async () => {
    const create = userFactory.createMany(testContext());

    await expect(create).rejects.toBeInstanceOf(MissingPersisterError);
  });
});

describe('hooks', () => {
  it('runs afterMaking on make', async () => {
    const calls: string[] = [];
    const factory = hookedFactory(calls);

    await factory.make(testContext());

    expect(calls).toEqual(['making']);
  });

  it('runs afterMaking, persists, then afterCreating on create', async () => {
    const calls: string[] = [];
    const persister = new InMemorySeedPersister();
    const factory = hookedFactory(calls, () =>
      calls.push(`stored:${persister.documentsIn('users').length}`),
    );

    await factory.create(testContext(persister));

    expect(calls).toEqual(['making', 'stored:1', 'creating']);
  });

  it('lets afterMaking change the entity before persistence', async () => {
    const persister = new InMemorySeedPersister();
    const factory = defineFactory<{ id: string; tag: string }>({
      name: 'tagged',
      collection: 'tagged',
      definition: () => ({ id: 'x', tag: 'before' }),
      afterMaking: (entity) => {
        entity.tag = 'after';
      },
    });

    await factory.create(testContext(persister));

    expect(persister.documentsIn('tagged')).toEqual([
      { id: 'x', tag: 'after' },
    ]);
  });

  it('never runs afterCreating on make', async () => {
    const calls: string[] = [];

    await hookedFactory(calls).make(testContext());

    expect(calls).not.toContain('creating');
  });
});

describe('determinism', () => {
  it('produces identical output for the same seed', async () => {
    const first = await userFactory.count(5).makeMany(testContext());
    const second = await userFactory.count(5).makeMany(testContext());

    expect(second).toEqual(first);
  });

  it('produces different output for a different seed', async () => {
    const first = await userFactory.make(testContext(undefined, 1));
    const second = await userFactory.make(testContext(undefined, 2));

    expect(second.id).not.toBe(first.id);
  });
});

function hookedFactory(
  calls: string[],
  onPersistProbe: () => void = () => undefined,
) {
  return defineFactory<{ id: string }>({
    name: 'user',
    collection: 'users',
    definition: () => ({ id: 'u1' }),
    afterMaking: () => {
      calls.push('making');
    },
    afterCreating: () => {
      onPersistProbe();
      calls.push('creating');
    },
  });
}
