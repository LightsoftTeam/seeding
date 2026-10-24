import { describe, expect, it, vi } from 'vitest';
import { planCli, runCli, USAGE } from './core.js';
import { GeneratedFileExistsError } from './errors.js';

describe('planCli', () => {
  it.each([[], ['--help']])(
    'returns usage and exit code zero: %j',
    (...argv) => {
      expect(planCli(argv)).toEqual({ exitCode: 0, stdout: USAGE, stderr: '' });
    },
  );

  it('returns an error and usage on stderr for unknown commands', () => {
    expect(planCli(['make:unknown'])).toEqual({
      exitCode: 1,
      stdout: '',
      stderr: `Unknown command: make:unknown\n\n${USAGE}`,
    });
  });

  it('reports invalid names without producing a file', () => {
    const result = planCli(['make:seeder', '../User']);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Invalid name "../User"');
    expect(result.file).toBeUndefined();
  });

  it('plans a TypeScript seeder using normalized names', () => {
    const result = planCli(['make:seeder', 'UserProfileSeeder']);
    expect(result.file?.path).toBe(
      'src/database/seeders/user-profile.seeder.ts',
    );
    expect(result.file?.content).toContain('userProfileSeeder: Seeder<string>');
  });

  it('plans a JavaScript seeder in a custom directory', () => {
    const result = planCli([
      'make:seeder',
      'Demo',
      '--dir',
      'seeders',
      '--ext',
      'js',
    ]);
    expect(result.file?.path).toBe('seeders/demo.seeder.js');
    expect(result.file?.content).toContain('export const demoSeeder = {');
  });

  it('plans a factory in the default directory', () => {
    const result = planCli(['make:factory', 'Product']);
    expect(result.file?.path).toBe('src/database/factories/product.factory.ts');
    expect(result.file?.content).toContain('collection: "products"');
  });
});

describe('runCli', () => {
  it.each([[], ['--help'], ['unknown'], ['make:factory']])(
    'does not invoke the writer for help or invalid commands: %j',
    async (...argv) => {
      const writeFile = vi.fn();
      await runCli(argv, writeFile);
      expect(writeFile).not.toHaveBeenCalled();
    },
  );

  it('returns the relative path supplied by an injected writer', async () => {
    const writeFile = vi.fn().mockResolvedValue('seeders/demo.seeder.ts');
    const result = await runCli(['make:seeder', 'Demo'], writeFile);
    expect(result).toEqual({
      exitCode: 0,
      stdout: 'seeders/demo.seeder.ts\n',
      stderr: '',
    });
    expect(writeFile).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'src/database/seeders/demo.seeder.ts',
      }),
    );
  });

  it('returns exit one and the existing path without exiting the process', async () => {
    const writeFile = vi
      .fn()
      .mockRejectedValue(new GeneratedFileExistsError('demo.seeder.ts'));
    const result = await runCli(['make:seeder', 'Demo'], writeFile);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('File already exists: demo.seeder.ts');
  });

  it('converts unexpected writer failures to a clear error result', async () => {
    const writeFile = vi.fn().mockRejectedValue(new Error('disk full'));
    const result = await runCli(['make:factory', 'Product'], writeFile);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(
      'Could not create src/database/factories/product.factory.ts: disk full',
    );
  });
});
