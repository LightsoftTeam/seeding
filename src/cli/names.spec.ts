import { describe, expect, it } from 'vitest';
import { SeedingError } from '../errors.js';
import { InvalidGeneratorNameError } from './errors.js';
import { normalizeName } from './names.js';

describe('normalizeName', () => {
  it.each([
    'UserProfile',
    'userProfile',
    'user-profile',
    'user_profile',
    'UserProfileSeeder',
    'UserProfileFactory',
    'user-profile-seeder',
    'user_profile_factory',
  ])('normalizes %s to all identifier forms', (input) => {
    expect(normalizeName(input)).toEqual({
      pascal: 'UserProfile',
      camel: 'userProfile',
      kebab: 'user-profile',
    });
  });

  it('keeps acronyms together and preserves digits', () => {
    expect(normalizeName('HTTPUser2Factory')).toEqual({
      pascal: 'HttpUser2',
      camel: 'httpUser2',
      kebab: 'http-user2',
    });
  });

  it.each([
    '',
    '1User',
    '../User',
    'User Name',
    'User.Name',
    'Usér',
    'Seeder',
    'Factory',
  ])('rejects an invalid name: %s', (input) => {
    expect(() => normalizeName(input)).toThrowError(InvalidGeneratorNameError);
  });

  it('uses a SeedingError subclass with a code and clear message', () => {
    try {
      normalizeName('../User');
      expect.unreachable('Expected an invalid name error');
    } catch (error) {
      expect(error).toBeInstanceOf(SeedingError);
      expect(error).toMatchObject({ code: 'INVALID_GENERATOR_NAME' });
      expect((error as Error).message).toContain('start with a letter');
    }
  });
});
