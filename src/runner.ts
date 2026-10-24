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

export async function runSeeders<TEnvironment extends string = string>(
  options: RunSeedersOptions<TEnvironment>,
): Promise<void> {
  const target = selectSeeder(options);
  const context = createContext(options);

  await context.call(target);
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

function createContext<TEnvironment extends string>(
  options: RunSeedersOptions<TEnvironment>,
): SeederContext<TEnvironment> {
  const activeStack: string[] = [];
  const context: SeederContext<TEnvironment> = {
    faker: createSeededFaker(options.seed, { locale: options.fakerLocale }),
    environment: options.environment,
    persist: options.persister,
    log: options.logger ?? NO_OP_LOGGER,
    call: async (...seeders) => {
      for (const seeder of seeders) {
        await execute(seeder, context, activeStack);
      }
    },
  };

  return context;
}

async function execute<TEnvironment extends string>(
  seeder: Seeder<TEnvironment>,
  context: SeederContext<TEnvironment>,
  activeStack: string[],
): Promise<void> {
  assertAllowed(seeder, context.environment);
  assertNoCycle(seeder, activeStack);
  const startedAt = Date.now();

  context.log(`Seeding ${seeder.name}`);
  activeStack.push(seeder.name);
  try {
    await seeder.run(context);
  } finally {
    activeStack.pop();
  }
  context.log(`Seeded ${seeder.name}`, {
    durationMs: Date.now() - startedAt,
  });
}

function assertNoCycle(seeder: Seeder<string>, activeStack: string[]): void {
  if (!activeStack.includes(seeder.name)) {
    return;
  }

  const path = [...activeStack, seeder.name];
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
