import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runCli } from './core.js';
import { GeneratedFileExistsError, GeneratedFileWriteError } from './errors.js';
import { writeGeneratedFile } from './files.js';

describe('writeGeneratedFile', () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'seeding-cli-test-'));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('creates nested directories and writes a seeder in a temporary directory', async () => {
    const result = await runCli(['make:seeder', 'Demo'], (file) =>
      writeGeneratedFile(file, directory),
    );
    expect(result).toEqual({
      exitCode: 0,
      stdout: 'src/database/seeders/demo.seeder.ts\n',
      stderr: '',
    });
    const content = await readFile(
      join(directory, 'src/database/seeders/demo.seeder.ts'),
      'utf8',
    );
    expect(content).toContain('export const demoSeeder: Seeder<string>');
  });

  it('writes a factory with a custom collection into an absolute directory', async () => {
    const result = await runCli(
      [
        'make:factory',
        'Person',
        '--dir',
        join(directory, 'factories'),
        '--collection',
        'people',
      ],
      (file) => writeGeneratedFile(file, directory),
    );
    expect(result.stdout).toBe('factories/person.factory.ts\n');
    const content = await readFile(
      join(directory, 'factories/person.factory.ts'),
      'utf8',
    );
    expect(content).toContain('collection: "people"');
  });

  it('preserves existing file contents and names the conflicting path', async () => {
    const file = { path: 'demo.seeder.ts', content: 'original' };
    await writeGeneratedFile(file, directory);
    await expect(
      writeGeneratedFile({ ...file, content: 'replacement' }, directory),
    ).rejects.toMatchObject({
      code: 'GENERATED_FILE_EXISTS',
      message: 'File already exists: demo.seeder.ts',
    });
    expect(await readFile(join(directory, file.path), 'utf8')).toBe('original');
  });

  it('prints the relative path when the working directory uses a symlink alias', async () => {
    const alias = join(directory, 'alias');
    await symlink(directory, alias, 'dir');
    const path = await writeGeneratedFile(
      { path: join(directory, 'demo.seeder.ts'), content: 'seeder' },
      alias,
    );
    expect(path).toBe('demo.seeder.ts');
  });

  it('allows only one concurrent writer to create the same file', async () => {
    const file = { path: 'concurrent.factory.ts', content: 'factory' };
    const results = await Promise.allSettled([
      writeGeneratedFile(file, directory),
      writeGeneratedFile(file, directory),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    const failure = results.find((result) => result.status === 'rejected');
    expect(failure?.reason).toBeInstanceOf(GeneratedFileExistsError);
  });

  it('reports filesystem failures as SeedingError subclasses with a code', async () => {
    await writeFile(join(directory, 'blocked'), 'not a directory');
    await expect(
      writeGeneratedFile(
        { path: 'blocked/demo.seeder.ts', content: '' },
        directory,
      ),
    ).rejects.toBeInstanceOf(GeneratedFileWriteError);
    await expect(
      writeGeneratedFile(
        { path: 'blocked/demo.seeder.ts', content: '' },
        directory,
      ),
    ).rejects.toMatchObject({ code: 'GENERATED_FILE_WRITE_FAILED' });
  });
});
