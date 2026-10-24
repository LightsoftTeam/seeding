import { describe, expect, it } from 'vitest';
import { parseArguments } from './arguments.js';
import { InvalidCliArgumentsError } from './errors.js';

describe('parseArguments', () => {
  it.each([[], ['--help']])('parses help: %j', (...argv) => {
    expect(parseArguments(argv)).toEqual({ kind: 'help' });
  });

  it('defaults seeders to TypeScript in src/database/seeders', () => {
    expect(parseArguments(['make:seeder', 'UserSeeder'])).toEqual({
      kind: 'seeder',
      name: { pascal: 'User', camel: 'user', kebab: 'user' },
      directory: 'src/database/seeders',
      extension: 'ts',
    });
  });

  it('reads a custom seeder directory and JavaScript extension', () => {
    expect(
      parseArguments([
        'make:seeder',
        'User',
        '--ext',
        'js',
        '--dir',
        'custom seeders',
      ]),
    ).toMatchObject({
      kind: 'seeder',
      directory: 'custom seeders',
      extension: 'js',
    });
  });

  it('defaults factories to a naively pluralized kebab collection', () => {
    expect(parseArguments(['make:factory', 'UserProfileFactory'])).toEqual({
      kind: 'factory',
      name: {
        pascal: 'UserProfile',
        camel: 'userProfile',
        kebab: 'user-profile',
      },
      directory: 'src/database/factories',
      collection: 'user-profiles',
    });
  });

  it('reads factory directory and collection overrides', () => {
    expect(
      parseArguments([
        'make:factory',
        'Person',
        '--dir',
        'factories',
        '--collection',
        'people',
      ]),
    ).toMatchObject({
      kind: 'factory',
      directory: 'factories',
      collection: 'people',
    });
  });

  it.each([
    ['unknown'],
    ['make:seeder'],
    ['make:factory', '--dir', 'factories'],
    ['make:seeder', 'User', '--ext', 'tsx'],
    ['make:seeder', 'User', '--dir'],
    ['make:seeder', 'User', '--dir', ''],
    ['make:seeder', 'User', '--dir', '--ext', 'ts'],
    ['make:seeder', 'User', '--collection', 'users'],
    ['make:factory', 'User', '--ext', 'js'],
    ['make:seeder', 'User', 'extra'],
    ['make:seeder', 'User', '--dir', 'one', '--dir', 'two'],
  ])('rejects malformed arguments: %j', (...argv) => {
    expect(() => parseArguments(argv)).toThrowError(InvalidCliArgumentsError);
  });
});
