import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execPath } from 'node:process';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const compiler = require.resolve('typescript/bin/tsc');
const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const consumerRoot = await mkdtemp(join(tmpdir(), 'seeding-types-'));
const consumerSource = `
import type { SeedPersister } from '@lightsoft-pe/seeding';
import type { CosmosSeedPersisterOptions } from '@lightsoft-pe/seeding/cosmos';
import type { Taxpayer } from '@lightsoft-pe/seeding/peru';
import type { RefreshDatabaseOptions } from '@lightsoft-pe/seeding/testing';

export type PublicTypes = [
  SeedPersister,
  CosmosSeedPersisterOptions,
  Taxpayer,
  RefreshDatabaseOptions,
];
`;

try {
  const scopeDirectory = join(consumerRoot, 'node_modules', '@lightsoft-pe');
  await mkdir(scopeDirectory, { recursive: true });
  await symlink(packageRoot, join(scopeDirectory, 'seeding'), 'junction');
  await symlink(
    join(packageRoot, 'node_modules', '@types'),
    join(consumerRoot, 'node_modules', '@types'),
    'junction',
  );
  await verifyConsumer('node', 'commonjs', 'consumer.cts');
  await verifyConsumer('nodenext', 'nodenext', 'consumer.cts');
  await verifyConsumer('nodenext', 'nodenext', 'consumer.mts');
} finally {
  await rm(consumerRoot, { recursive: true, force: true });
}

async function verifyConsumer(resolution, module, filename) {
  const consumerPath = join(consumerRoot, filename);
  await writeFile(consumerPath, consumerSource);
  execFileSync(
    execPath,
    [
      compiler,
      '--noEmit',
      '--strict',
      '--target',
      'es2022',
      '--moduleResolution',
      resolution,
      '--module',
      module,
      consumerPath,
    ],
    { cwd: consumerRoot, stdio: 'inherit' },
  );
  console.log(`ok types: ${resolution}/${module} (${filename})`);
}
