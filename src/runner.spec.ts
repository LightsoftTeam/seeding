import { describe, expect, it } from 'vitest';
import { SeedingForbiddenError } from './errors.js';
import { InMemorySeedPersister } from './persister.js';
import { runSeeders } from './runner.js';
import type { Seeder } from './seeder.js';

type SeedEnvironment = 'local' | 'dev' | 'test' | 'prod';

const ALL_NON_PROD: readonly SeedEnvironment[] = ['local', 'dev', 'test'];

function recordingSeeder(
  name: string,
  executed: string[],
  allowedEnvironments: readonly SeedEnvironment[] = ALL_NON_PROD,
): Seeder<SeedEnvironment> {
  return {
    name,
    allowedEnvironments,
    run: async (context) => {
      executed.push(name);
      await context.persist.upsert('items', [{ id: name }]);
    },
  };
}

function compositeSeeder(
  name: string,
  children: Seeder<SeedEnvironment>[],
): Seeder<SeedEnvironment> {
  return {
    name,
    allowedEnvironments: ALL_NON_PROD,
    run: (context) => context.call(...children),
  };
}

function setup(environment: SeedEnvironment = 'local') {
  const persister = new InMemorySeedPersister();
  const messages: string[] = [];
  const base = {
    environment,
    seed: 1,
    persister,
    logger: (message: string) => messages.push(message),
  };

  return { persister, messages, base };
}

describe('runSeeders', () => {
  it('runs nested seeders depth-first in declared order', async () => {
    const executed: string[] = [];
    const a = recordingSeeder('A', executed);
    const b = recordingSeeder('B', executed);
    const c = recordingSeeder('C', executed);
    const root = compositeSeeder('Root', [compositeSeeder('Group', [a, b]), c]);

    await runSeeders({ ...setup().base, root });

    expect(executed).toEqual(['A', 'B', 'C']);
  });

  it('runs only the named seeder from the registry', async () => {
    const executed: string[] = [];
    const first = recordingSeeder('First', executed);
    const second = recordingSeeder('Second', executed);
    const root = compositeSeeder('Root', [first, second]);

    await runSeeders({
      ...setup().base,
      root,
      seeders: [first, second],
      only: 'Second',
    });

    expect(executed).toEqual(['Second']);
  });

  it('fails on an unknown seeder name listing the available names', async () => {
    const seeder = recordingSeeder('Known', []);

    const run = runSeeders({
      ...setup().base,
      root: seeder,
      seeders: [seeder],
      only: 'Missing',
    });

    await expect(run).rejects.toThrowError(
      'Unknown seeder "Missing". Available seeders: Known',
    );
  });

  it('blocks a seeder outside its allowed environments', async () => {
    const executed: string[] = [];
    const { base } = setup('prod');

    const run = runSeeders({
      ...base,
      root: recordingSeeder('Demo', executed),
    });

    await expect(run).rejects.toBeInstanceOf(SeedingForbiddenError);
  });

  it('persists nothing when the guard blocks the run', async () => {
    const executed: string[] = [];
    const { base, persister } = setup('prod');

    await runSeeders({
      ...base,
      root: recordingSeeder('Demo', executed),
    }).catch(() => undefined);

    expect(persister.collectionNames()).toEqual([]);
  });

  it('blocks a child seeder that is not allowed in the environment', async () => {
    const executed: string[] = [];
    const prodOnlyChild = recordingSeeder('Child', executed, ['prod']);

    const run = runSeeders({
      ...setup('local').base,
      root: compositeSeeder('Root', [prodOnlyChild]),
    });

    await expect(run).rejects.toBeInstanceOf(SeedingForbiddenError);
  });

  it('fails closed when an environment is not explicitly listed', async () => {
    const seeder = recordingSeeder('NoProd', []);

    const run = runSeeders({ ...setup('prod').base, root: seeder });

    await expect(run).rejects.toThrowError(/not allowed in environment "prod"/);
  });

  it('is idempotent when a run is repeated', async () => {
    const { base, persister } = setup();
    const root = recordingSeeder('Root', []);

    await runSeeders({ ...base, root });
    await runSeeders({ ...base, root });

    expect(persister.documentsIn('items')).toHaveLength(1);
  });

  it('logs each seeder with its name and duration', async () => {
    const { base, messages } = setup();

    await runSeeders({ ...base, root: recordingSeeder('Root', []) });

    expect(messages).toEqual(['Seeding Root', 'Seeded Root']);
  });

  it('shares one seeded faker across the whole run', async () => {
    const draws: string[] = [];
    const drawing = (name: string): Seeder<SeedEnvironment> => ({
      name,
      allowedEnvironments: ALL_NON_PROD,
      run: async ({ faker }) => {
        draws.push(faker.string.alphanumeric(12));
      },
    });
    const root = compositeSeeder('Root', [drawing('A'), drawing('B')]);

    await runSeeders({ ...setup().base, root });

    const [first, second] = draws;
    expect(first).not.toBe(second);
  });
});
