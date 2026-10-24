import { describe, expect, it } from 'vitest';
import { SeedingForbiddenError } from './errors.js';
import { InMemorySeedPersister } from './persister.js';
import { runSeeders } from './runner.js';
import type { Seeder } from './seeder.js';

type TestEnvironment = 'local' | 'production';

const LOCAL_ONLY: readonly TestEnvironment[] = ['local'];
const EVERYWHERE: readonly TestEnvironment[] = ['local', 'production'];
const USERS_COLLECTION = 'users';

function seeder(
  name: string,
  run: Seeder<TestEnvironment>['run'] = async () => undefined,
  extras: Partial<Seeder<TestEnvironment>> = {},
): Seeder<TestEnvironment> {
  return { name, allowedEnvironments: EVERYWHERE, run, ...extras };
}

function options(
  root: Seeder<TestEnvironment>,
  environment: TestEnvironment = 'local',
) {
  return {
    root,
    environment,
    seed: 1,
    persister: new InMemorySeedPersister(),
  };
}

describe('per-branch ancestry', () => {
  it('does not report a cycle for concurrent siblings sharing a callee', async () => {
    const shared = seeder(
      'Shared',
      () => new Promise((done) => setTimeout(done, 5)),
    );
    const left = seeder('Left', (context) => context.call(shared));
    const right = seeder('Right', (context) => context.call(shared));
    const root = seeder('Root', async (context) => {
      await Promise.all([context.call(left), context.call(right)]);
    });

    await expect(runSeeders(options(root))).resolves.toBeUndefined();
  });

  it('detects a real cycle inside one concurrent branch', async () => {
    const ping: Seeder<TestEnvironment> = seeder('Ping', (context) =>
      context.call(pong),
    );
    const pong: Seeder<TestEnvironment> = seeder('Pong', (context) =>
      context.call(ping),
    );
    const healthy = seeder('Healthy');
    const root = seeder('Root', async (context) => {
      await Promise.all([context.call(healthy), context.call(ping)]);
    });

    const run = runSeeders(options(root));

    await expect(run).rejects.toThrowError('Ping -> Pong -> Ping');
  });

  it('detects same-name cycles with different seeder identities', async () => {
    const twin = seeder('Twin');
    const sameName = seeder('Twin', (context) => context.call(twin));
    const root = seeder('Root', (context) => context.call(sameName));

    await expect(runSeeders(options(root))).rejects.toMatchObject({
      code: 'SEEDER_CYCLE',
      details: { path: ['Root', 'Twin', 'Twin'] },
    });
  });

  it('detects a cycle when each call creates a fresh seeder', async () => {
    function freshSeeder(): Seeder<TestEnvironment> {
      return seeder('Fresh', (context) => context.call(freshSeeder()));
    }

    await expect(runSeeders(options(freshSeeder()))).rejects.toMatchObject({
      code: 'SEEDER_CYCLE',
      details: { path: ['Fresh', 'Fresh'] },
    });
  });
});

describe('static preflight of declared calls', () => {
  it('rejects a forbidden callee before any seeder runs', async () => {
    const persister = new InMemorySeedPersister();
    const allowedWriter = seeder('Writer', async (context) => {
      await context.persist.upsert(USERS_COLLECTION, [{ id: 'u1' }]);
    });
    const forbidden = seeder('Forbidden', undefined, {
      allowedEnvironments: LOCAL_ONLY,
    });
    const root = seeder(
      'Root',
      async (context) => {
        await context.call(allowedWriter, forbidden);
      },
      { calls: [allowedWriter, forbidden] },
    );

    const run = runSeeders({ ...options(root, 'production'), persister });

    await expect(run).rejects.toBeInstanceOf(SeedingForbiddenError);
    expect(persister.documentsIn(USERS_COLLECTION)).toEqual([]);
  });

  it('walks nested declarations', async () => {
    const forbidden = seeder('Deep', undefined, {
      allowedEnvironments: LOCAL_ONLY,
    });
    const middle = seeder('Middle', undefined, { calls: [forbidden] });
    const root = seeder('Root', undefined, { calls: [middle] });

    const run = runSeeders(options(root, 'production'));

    await expect(run).rejects.toBeInstanceOf(SeedingForbiddenError);
  });

  it('accepts diamond-shaped declarations', async () => {
    const shared = seeder('Shared');
    const left = seeder('Left', undefined, { calls: [shared] });
    const right = seeder('Right', undefined, { calls: [shared] });
    const root = seeder('Root', undefined, { calls: [left, right] });

    await expect(runSeeders(options(root))).resolves.toBeUndefined();
  });

  it('detects cycles in declared calls before running', async () => {
    let executed = false;
    const second = seeder('Second');
    const first = seeder('First', async () => {
      executed = true;
    });
    Object.assign(second, { calls: [first] });
    Object.assign(first, { calls: [second] });

    const run = runSeeders(options(first));

    await expect(run).rejects.toMatchObject({ code: 'SEEDER_CYCLE' });
    expect(executed).toBe(false);
  });

  it('checks same-name ancestry even for previously verified declarations', async () => {
    let executed = false;
    const twin = seeder('Twin');
    const sameName = seeder('Twin', undefined, { calls: [twin] });
    const root = seeder(
      'Root',
      async () => {
        executed = true;
      },
      { calls: [twin, sameName] },
    );

    await expect(runSeeders(options(root))).rejects.toMatchObject({
      code: 'SEEDER_CYCLE',
      details: { path: ['Root', 'Twin', 'Twin'] },
    });
    expect(executed).toBe(false);
  });

  it('checks shared descendants against each declared branch ancestry', async () => {
    const leaf = seeder('Twin');
    const shared = seeder('Shared', undefined, { calls: [leaf] });
    const sameName = seeder('Twin', undefined, { calls: [shared] });
    const root = seeder('Root', undefined, { calls: [shared, sameName] });

    await expect(runSeeders(options(root))).rejects.toMatchObject({
      code: 'SEEDER_CYCLE',
      details: { path: ['Root', 'Twin', 'Shared', 'Twin'] },
    });
  });

  it('still enforces the environment at runtime for undeclared calls', async () => {
    const forbidden = seeder('Late', undefined, {
      allowedEnvironments: LOCAL_ONLY,
    });
    const root = seeder('Root', (context) => context.call(forbidden));

    const run = runSeeders(options(root, 'production'));

    await expect(run).rejects.toBeInstanceOf(SeedingForbiddenError);
  });
});
