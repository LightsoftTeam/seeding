import type { LocaleDefinition } from '@faker-js/faker';
import { createSeededFaker } from './faker.js';
import {
  SeedingError,
  SeedingForbiddenError,
  UnknownSeederError,
} from './errors.js';
import type { SeedPersister } from './persister.js';
import type { SeedLogger, Seeder, SeederContext } from './seeder.js';

const SEEDER_CYCLE_CODE = 'SEEDER_CYCLE';
const CYCLE_PATH_SEPARATOR = ' -> ';
const NO_OP_LOGGER: SeedLogger = () => undefined;

export interface RunSeedersOptions<TEnvironment extends string = string> {
  root: Seeder<TEnvironment>;
  seeders?: readonly Seeder<TEnvironment>[];
  only?: string;
  environment: TEnvironment;
  seed: number;
  persister: SeedPersister;
  logger?: SeedLogger;
  fakerLocale?: LocaleDefinition[];
}

interface SharedRunState<TEnvironment extends string> {
  readonly faker: SeederContext<TEnvironment>['faker'];
  readonly environment: TEnvironment;
  readonly persist: SeedPersister;
  readonly log: SeedLogger;
}

export async function runSeeders<TEnvironment extends string = string>(
  options: RunSeedersOptions<TEnvironment>,
): Promise<void> {
  const target = selectSeeder(options);

  assertReachableAllowed(target, options.environment);
  await createContext(createSharedState(options), []).call(target);
}

function selectSeeder<TEnvironment extends string>({
  root,
  seeders = [],
  only,
}: RunSeedersOptions<TEnvironment>): Seeder<TEnvironment> {
  if (only === undefined) {
    return root;
  }

  const found = seeders.find((seeder) => seeder.name === only);

  if (found === undefined) {
    const available = seeders.map((seeder) => seeder.name);
    throw new UnknownSeederError(
      `Unknown seeder "${only}". Available seeders: ${available.join(', ') || '(none)'}`,
      { details: { requested: only, available } },
    );
  }

  return found;
}

function createSharedState<TEnvironment extends string>(
  options: RunSeedersOptions<TEnvironment>,
): SharedRunState<TEnvironment> {
  return {
    faker: createSeededFaker(options.seed, { locale: options.fakerLocale }),
    environment: options.environment,
    persist: options.persister,
    log: options.logger ?? NO_OP_LOGGER,
  };
}

function createContext<TEnvironment extends string>(
  shared: SharedRunState<TEnvironment>,
  ancestry: readonly Seeder<TEnvironment>[],
): SeederContext<TEnvironment> {
  return {
    ...shared,
    call: async (...seeders) => {
      for (const seeder of seeders) {
        await execute(seeder, shared, ancestry);
      }
    },
  };
}

async function execute<TEnvironment extends string>(
  seeder: Seeder<TEnvironment>,
  shared: SharedRunState<TEnvironment>,
  ancestry: readonly Seeder<TEnvironment>[],
): Promise<void> {
  assertAllowed(seeder, shared.environment);
  assertNoCycle(seeder, ancestry);
  const startedAt = Date.now();

  shared.log(`Seeding ${seeder.name}`);
  await seeder.run(createContext(shared, [...ancestry, seeder]));
  shared.log(`Seeded ${seeder.name}`, {
    durationMs: Date.now() - startedAt,
  });
}

function assertReachableAllowed<TEnvironment extends string>(
  seeder: Seeder<TEnvironment>,
  environment: TEnvironment,
  ancestry: readonly Seeder<TEnvironment>[] = [],
  verified: Set<Seeder<TEnvironment>> = new Set(),
): void {
  if (verified.has(seeder)) {
    return;
  }

  assertAllowed(seeder, environment);
  assertNoCycle(seeder, ancestry);
  const branch = [...ancestry, seeder];

  for (const callee of seeder.calls ?? []) {
    assertReachableAllowed(callee, environment, branch, verified);
  }
  verified.add(seeder);
}

function assertNoCycle<TEnvironment extends string>(
  seeder: Seeder<TEnvironment>,
  ancestry: readonly Seeder<TEnvironment>[],
): void {
  if (!ancestry.includes(seeder)) {
    return;
  }

  const path = [...ancestry, seeder].map((member) => member.name);
  throw new SeedingError(
    `Seeder cycle detected: ${path.join(CYCLE_PATH_SEPARATOR)}`,
    { code: SEEDER_CYCLE_CODE, details: { path } },
  );
}

function assertAllowed<TEnvironment extends string>(
  seeder: Seeder<TEnvironment>,
  environment: TEnvironment,
): void {
  if (seeder.allowedEnvironments.includes(environment)) {
    return;
  }

  throw new SeedingForbiddenError(
    `Seeder "${seeder.name}" is not allowed in environment "${environment}"`,
    {
      details: {
        seeder: seeder.name,
        environment,
        allowedEnvironments: seeder.allowedEnvironments,
      },
    },
  );
}
