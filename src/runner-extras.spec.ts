import { describe, expect, it } from 'vitest';
import { SeedingError, SeedingForbiddenError } from './errors.js';
import { InMemorySeedPersister } from './persister.js';
import { runSeeders } from './runner.js';
import type { Seeder } from './seeder.js';
import { es, base } from '@faker-js/faker';

type StagingEnvironment = 'staging' | 'production';

const STAGING: readonly StagingEnvironment[] = ['staging'];
const SPANISH_TITLE = 'Spanish';

function seeder(
  name: string,
  run: Seeder<StagingEnvironment>['run'],
  allowedEnvironments: readonly StagingEnvironment[] = STAGING,
): Seeder<StagingEnvironment> {
  return { name, allowedEnvironments, run };
}

function baseOptions(environment: StagingEnvironment = 'staging') {
  return { environment, seed: 1, persister: new InMemorySeedPersister() };
}

describe('runSeeders with custom environments', () => {
  it('accepts an arbitrary environment union', async () => {
    const executed: string[] = [];
    const root = seeder('Root', async () => {
      executed.push('Root');
    });

    await runSeeders({ ...baseOptions(), root });

    expect(executed).toEqual(['Root']);
  });

  it('blocks an environment missing from the seeder allow list', async () => {
    const root = seeder('Root', async () => undefined);

    const run = runSeeders({ ...baseOptions('production'), root });

    await expect(run).rejects.toBeInstanceOf(SeedingForbiddenError);
  });
});

describe('runSeeders logger', () => {
  it('runs without a logger', async () => {
    const root = seeder('Root', async (context) => context.log('hello'));

    await expect(
      runSeeders({ ...baseOptions(), root }),
    ).resolves.toBeUndefined();
  });

  it('reports the duration of each seeder', async () => {
    const calls: Array<[string, unknown]> = [];
    const root = seeder('Root', async () => undefined);

    await runSeeders({
      ...baseOptions(),
      root,
      logger: (message, data) => calls.push([message, data]),
    });

    expect(calls[1]?.[1]).toEqual({ durationMs: expect.any(Number) });
  });
});

describe('runSeeders faker locale', () => {
  it('passes the configured locale to the context faker', async () => {
    let title: string | undefined;
    const root = seeder('Root', async ({ faker }) => {
      title = faker.definitions.metadata?.title;
    });

    await runSeeders({ ...baseOptions(), root, fakerLocale: [es, base] });

    expect(title).toBe(SPANISH_TITLE);
  });
});

describe('runSeeders cycle detection', () => {
  it('fails when a seeder calls itself', async () => {
    const selfCalling: Seeder<StagingEnvironment> = seeder('Loop', (context) =>
      context.call(selfCalling),
    );

    const run = runSeeders({ ...baseOptions(), root: selfCalling });

    await expect(run).rejects.toMatchObject({ code: 'SEEDER_CYCLE' });
  });

  it('fails on an indirect cycle and names the path', async () => {
    const first: Seeder<StagingEnvironment> = seeder('First', (context) =>
      context.call(second),
    );
    const second: Seeder<StagingEnvironment> = seeder('Second', (context) =>
      context.call(first),
    );

    const run = runSeeders({ ...baseOptions(), root: first });

    await expect(run).rejects.toThrowError('First -> Second -> First');
  });

  it('throws a SeedingError for a cycle', async () => {
    const loop: Seeder<StagingEnvironment> = seeder('Loop', (context) =>
      context.call(loop),
    );

    const run = runSeeders({ ...baseOptions(), root: loop });

    await expect(run).rejects.toBeInstanceOf(SeedingError);
  });

  it('allows the same seeder to run twice sequentially', async () => {
    let runs = 0;
    const shared = seeder('Shared', async () => {
      runs += 1;
    });
    const root = seeder('Root', (context) => context.call(shared, shared));

    await runSeeders({ ...baseOptions(), root });

    expect(runs).toBe(2);
  });
});

describe('runSeeders nested guard', () => {
  it('rejects a forbidden child before its run executes', async () => {
    let childRan = false;
    const child = seeder(
      'Child',
      async () => {
        childRan = true;
      },
      ['production'],
    );
    const root = seeder('Root', (context) => context.call(child));

    await runSeeders({ ...baseOptions(), root }).catch(() => undefined);

    expect(childRan).toBe(false);
  });
});
