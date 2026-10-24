# @lightsoft-pe/seeding

Database-agnostic, Laravel-inspired seeders and factories for TypeScript. Compose seeders, generate related fixtures, and persist through a small adapter port. Seeded Faker instances and deterministic UUIDs make runs reproducible; explicit environment allow lists guard seeder execution.

## Install

Requires Node.js >= 20. The library exports ESM and CommonJS builds, with TypeScript declarations.

```sh
npm i -D @lightsoft-pe/seeding @faker-js/faker
```

Faker is a required peer dependency (`^10.0.0`). For the optional `/cosmos` adapter, also install its peer dependency:

```sh
npm i -D @azure/cosmos@^4.10.1
```

## Seeders

A `Seeder<Environment>` supplies a unique `name`, an `allowedEnvironments` list, and an async `run(context)`. Its context exposes `faker`, `environment`, `persist`, `log`, and `call(...seeders)`.

```ts
import { base, es } from '@faker-js/faker';
import {
  InMemorySeedPersister,
  deterministicUuid,
  runSeeders,
  type Seeder,
} from '@lightsoft-pe/seeding';

type Environment = 'local' | 'test' | 'production';

const usersSeeder: Seeder<Environment> = {
  name: 'Users',
  allowedEnvironments: ['local', 'test'],
  async run(ctx) {
    await ctx.persist.upsert('users', [
      { id: deterministicUuid(ctx.faker), name: ctx.faker.person.fullName() },
    ]);
  },
};

const rootSeeder: Seeder<Environment> = {
  name: 'Database',
  allowedEnvironments: ['local', 'test'],
  calls: [usersSeeder],
  async run(ctx) {
    await ctx.call(usersSeeder);
  },
};

await runSeeders<Environment>({
  root: rootSeeder,
  seeders: [usersSeeder],
  environment: 'local',
  seed: 42,
  persister: new InMemorySeedPersister(),
  logger: (message, data) => console.log(message, data),
  fakerLocale: [es, base],
});
```

| Option        | Behavior                                                                                                              |
| ------------- | --------------------------------------------------------------------------------------------------------------------- |
| `root`        | Required default entry seeder.                                                                                        |
| `seeders`     | Optional registry searched by `only`; defaults to `[]`.                                                               |
| `only`        | Select a registry entry by exact name instead of `root`; unknown names fail.                                          |
| `environment` | Required string, checked against every seeder's allow list.                                                           |
| `seed`        | Required numeric Faker seed; one Faker instance is shared by the run.                                                 |
| `persister`   | Required `SeedPersister`, exposed as `ctx.persist`.                                                                   |
| `logger`      | Optional `(message, data?) => void`; defaults to a no-op. Receives start/completion messages and completion duration. |
| `fakerLocale` | Optional Faker locale array; defaults to `[en, base]`.                                                                |

`ctx.call(a, b)` awaits seeders in order and supports nested calls. Declare the complete static call graph with each seeder's optional `calls` property: the selected entry and all declared descendants are checked for environment access and cycles **before any `run` executes**. `calls` only declares dependencies; `run` must still invoke `ctx.call`.

Environment access fails closed: an unlisted environment, including an empty allow list, throws `SeedingForbiddenError`. Undeclared dynamic calls are checked immediately before that callee runs, so earlier work may already have happened. Cycles are detected by identity or repeated name within a branch (`SEEDER_CYCLE`); sequential reuse is allowed. Use distinct names and declare calls for full preflight protection.

## Factories

`defineFactory<T>` requires an entity type with `id: string`, a factory `name`, a `collection`, and a `definition({ faker, sequence })`. A `SeederContext` also works as a factory context.

```ts
import {
  InMemorySeedPersister,
  belongsTo,
  createSeededFaker,
  defineFactory,
  deterministicUuid,
} from '@lightsoft-pe/seeding';

interface User {
  id: string;
  name: string;
  active: boolean;
}

interface Post {
  id: string;
  authorId: string;
  title: string;
}

const userFactory = defineFactory<User>({
  name: 'User',
  collection: 'users',
  definition: ({ faker }) => ({
    id: deterministicUuid(faker),
    name: faker.person.fullName(),
    active: true,
  }),
  states: { inactive: { active: false } },
  afterMaking(user) {
    user.name = user.name.trim();
  },
  afterCreating(user, ctx) {
    // Async hooks are supported too.
    void user;
    void ctx;
  },
});

const postFactory = defineFactory<Post>({
  name: 'Post',
  collection: 'posts',
  definition: ({ faker, sequence }) => ({
    id: deterministicUuid(faker),
    authorId: belongsTo(userFactory),
    title: `Post ${sequence}`,
  }),
});

const ctx = {
  faker: createSeededFaker(42),
  persist: new InMemorySeedPersister(),
};

const users = await userFactory
  .state('inactive')
  .sequence({ name: 'Ada' }, { name: 'Grace' })
  .count(2)
  .createMany(ctx);

const post = await postFactory.for(userFactory, 'authorId').create(ctx);
const recycled = await postFactory
  .recycle(userFactory, users)
  .count(3)
  .makeMany(ctx);
const graph = await userFactory
  .has(postFactory.count(2), 'authorId')
  .makeGraph(ctx);
```

Builders are immutable: each modifier returns a new builder.

| Method                                                    | Behavior                                                                                                                                           |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `state(name \| object \| function)`                       | Apply a named or inline partial state; functions receive `{ faker, sequence }`. Later states win.                                                  |
| `sequence(...objectsOrIndexFunctions)`                    | Cycle through values by zero-based batch index; restarts for each batch.                                                                           |
| `count(n)`                                                | Set a non-negative integer batch size; default `1`, with `0` producing nothing.                                                                    |
| `for(entityOrFactory, foreignKey, ownerKey?)`             | Copy an existing parent's key or resolve one shared parent per batch; owner key defaults to `id`.                                                  |
| `has(childFactory, foreignKey, ownerKey?)`                | Produce the child's configured count for each parent, wiring its foreign key.                                                                      |
| `recycle(factory, entities)`                              | Reuse existing parents by factory name through nested relations; selection uses the seeded Faker. Recycled entities are not persisted again.       |
| `belongsTo(factory, ownerKey?)`                           | Lazy marker inside a definition; resolves one parent per entity unless recycled or replaced.                                                       |
| `make(ctx, overrides?)` / `makeMany(ctx, overrides?)`     | Return one entity / the configured count without persistence, including relations.                                                                 |
| `create(ctx, overrides?)` / `createMany(ctx, overrides?)` | As above, but persist via `ctx.persist`; missing persisters throw.                                                                                 |
| `makeGraph(ctx, overrides?)`                              | Make the configured count and return `{ entities, related }`, with newly generated relations grouped by collection. Recycled parents are excluded. |

Attribute precedence, lowest to highest: definition → states → sequences → `for` foreign keys → `has`-forced foreign keys → explicit overrides. Overrides or forced keys skip unnecessary parent resolution. Relations resolve before `afterMaking(entity, ctx)`, which runs in both modes and may mutate the entity. In create mode, the batch is persisted, then `afterCreating(entity, ctx)` runs for each entity, then children are produced. Parent resolution cycles throw `FactoryCycleError`.

Typing caveat: `belongsTo` returns a `RelationMarker`, not the final foreign-key value. Current factory definitions accept it directly, as above. If you separately annotate a definition as the domain entity (`Post`), a string field will reject the marker; prefer the exported `Definition<Post>` type, or use the explicit escape hatch `belongsTo(userFactory) as unknown as string`. That cast does not validate the parent's owner-key type. With `defineFactory<User>(...)`, named state arguments are typed as `string`; omit the explicit generic and let the config infer types when you want inferred state names.

For reproducibility, use a fresh `createSeededFaker(seed)` per independent run, `deterministicUuid(faker)` for IDs, and the same locale, definitions, call order, and Faker version. Avoid unseeded randomness and wall-clock-dependent values in definitions and hooks. Reusing a context advances its random stream.

## Persisters

Implement `SeedPersister.upsert<T extends { id: string }>(collection, documents)` to connect any database. The optional `InspectableSeedPersister` port adds `findAll<T>(collection)` and `reset(collections?)` for testing and cleanup.

`InMemorySeedPersister` implements both ports, upserts by ID, and also exposes synchronous `documentsIn<T>(collection)` and `collectionNames()`. `reset()` clears all collections; `reset(['users'])` clears selected ones; `reset([])` clears nothing.

### Cosmos DB

Import the optional adapter from `@lightsoft-pe/seeding/cosmos`. The caller creates and passes an existing SDK `Database`; the adapter does not provision infrastructure.

```ts
import type { Database } from '@azure/cosmos';
import { createCosmosSeedPersister } from '@lightsoft-pe/seeding/cosmos';

function seedStore(database: Database) {
  return createCosmosSeedPersister({
    database,
    collections: {
      users: { container: 'people', partitionKeyPath: '/tenant/id' },
      posts: { container: 'articles', partitionKeyPath: '/tenant/id' },
    },
  });
}
```

Mappings control container names and partition-key paths, including nested paths. Unknown collections fail. `upsert` validates partition-key presence across the entire batch before writing any item, then writes sequentially; this is validation, not a transaction. `findAll` queries all items across partitions.

`reset` deletes items using each item's ID and partition key, **never containers**. It validates all selected mappings and existing items before deleting anything, deduplicates shared containers, and rejects conflicting partition paths for the same container. Omitting collections selects every mapped container; a shared container is cleared in full. Database failures can still leave partial writes or deletions.

## Fresh guard

Before destructive cleanup, call `assertFreshAllowed` with an explicitly allowed environment and exact `host/database` confirmation. Environment checks run first; confirmation is case-sensitive and is not trimmed. `parseConfirmFlag` reads the first `--confirm=value` argument; the space-separated form is not supported.

An application-owned `fresh.ts` script can expose cleanup through a CLI:

```ts
import {
  assertFreshAllowed,
  parseConfirmFlag,
  type InspectableSeedPersister,
} from '@lightsoft-pe/seeding';

export async function fresh(
  persister: InspectableSeedPersister,
  environment: string,
) {
  assertFreshAllowed({
    environment,
    allowedEnvironments: ['local', 'test'],
    target: { host: 'localhost:8081', database: 'seed-tests' },
    confirm: parseConfirmFlag(process.argv.slice(2)),
  });
  await persister.reset();
}

// Your application calls fresh(persister, environment) with its configured target.
```

After compiling and wiring that script:

```sh
node fresh.js --confirm=localhost:8081/seed-tests
```

Use the actual configured host and database as the guard target. The bundled `seeding` CLI generates files; it does not provide a `db:fresh` command.

## Testing helpers

`@lightsoft-pe/seeding/testing` works with any `InspectableSeedPersister`. Pass a guard to `refreshDatabase` to validate before reset; its guard is optional, so omitting it performs an unguarded reset. Omit `collections` to reset all collections, or pass `[]` to reset none.

```ts
import { InMemorySeedPersister } from '@lightsoft-pe/seeding';
import {
  assertDatabaseCount,
  assertDatabaseHas,
  assertDatabaseMissing,
  matchesPartial,
  refreshDatabase,
} from '@lightsoft-pe/seeding/testing';

const persister = new InMemorySeedPersister();
await refreshDatabase(persister, {
  collections: ['users'],
  guard: {
    environment: 'test',
    allowedEnvironments: ['test'],
    target: { host: 'memory', database: 'tests' },
    confirm: 'memory/tests',
  },
});
await persister.upsert('users', [
  { id: 'u1', active: true, profile: { city: 'Lima', name: 'Ada' } },
]);

await assertDatabaseHas(persister, 'users', { profile: { city: 'Lima' } });
await assertDatabaseMissing(persister, 'users', { id: 'absent' });
await assertDatabaseCount(persister, 'users', 1, { active: true });
matchesPartial({ tags: ['reader', 'writer'] }, { tags: ['reader'] }); // false
```

`assertDatabaseCount` accepts an optional partial `where` filter. Assertions throw Node.js `AssertionError` on failure. `matchesPartial` recursively matches own fields of plain objects (including null-prototype objects); extra document fields are allowed. Arrays and other non-plain values use exact deep strict equality; dates compare timestamps. Primitive matching follows `Object.is`, and a missing field differs from an explicitly `undefined` field.

## Peru generators

The `/peru` entry point generates synthetic DNI strings (8 digits), mobile numbers (9 digits beginning with `9`), and RUCs with check digits (`20` for companies, `10` for individuals).

```ts
import { createSeededFaker } from '@lightsoft-pe/seeding';
import {
  computeRucCheckDigit,
  generateDni,
  generateMobilePhone,
  generateRuc,
  isValidDni,
  isValidMobilePhone,
  isValidRuc,
} from '@lightsoft-pe/seeding/peru';

const faker = createSeededFaker(42);
isValidDni(generateDni(faker));
isValidMobilePhone(generateMobilePhone(faker));
isValidRuc(generateRuc(faker, 'company'));
isValidRuc(generateRuc(faker, 'individual'));
computeRucCheckDigit('2010007097'); // 0
```

Validators check format (and the RUC checksum), not whether an identifier is registered or belongs to a person or business.

## CLI generators

```sh
npx seeding make:seeder User
npx seeding make:seeder Demo --dir seeders --ext js
npx seeding make:factory User
npx seeding make:factory Person --dir factories --collection people
npx seeding --help
```

Seeders default to `src/database/seeders/<name>.seeder.ts`; use `--dir <path>` and `--ext ts|js`. Factories are TypeScript and default to `src/database/factories/<name>.factory.ts`; use `--dir <path>` and `--collection <name>`. The default collection is the kebab-case name plus `s`. Flags take space-separated values.

Names normalize to kebab-case filenames and camelCase exports, removing an optional `Seeder` or `Factory` suffix. Generators create parent directories and refuse to overwrite existing files. Edit generated placeholders before use.

## Releasing (maintainers)

From a clean, verified release checkout, choose one version increment:

```sh
npm version <patch|minor|major> && git push --follow-tags
```

Pushing the resulting `v*` tag triggers [`.github/workflows/release.yml`](.github/workflows/release.yml). The workflow checks that the tag matches `package.json`, runs the publish-time type checks, lint, tests, build, and export checks, then publishes publicly through npm Trusted Publishing (OIDC) with provenance. Configure npm's trusted publisher for `LightsoftTeam/seeding`, workflow `release.yml`, and GitHub environment `npm`; no npm token secret is used.

If the tag push does not start the workflow, run it manually from the tag: `gh workflow run release.yml --ref v<version>`.

## License

[MIT](LICENSE).
