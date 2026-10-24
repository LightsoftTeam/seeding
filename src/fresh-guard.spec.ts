import { describe, expect, it } from 'vitest';
import {
  FreshConfirmationError,
  FreshForbiddenError,
  SeedingError,
} from './errors.js';
import { assertFreshAllowed, parseConfirmFlag } from './fresh-guard.js';
import type { FreshRequest } from './fresh-guard.js';

type Environment = 'sandbox' | 'production';

function request(): FreshRequest<Environment> {
  return {
    environment: 'sandbox',
    allowedEnvironments: ['sandbox'],
    target: { host: 'localhost:8081', database: 'seed-tests' },
    confirm: 'localhost:8081/seed-tests',
  };
}

describe('assertFreshAllowed', () => {
  it('allows a custom environment with exact target confirmation', () => {
    expect(() => assertFreshAllowed(request())).not.toThrow();
  });

  it('rejects an environment outside the allow list', () => {
    expect(() =>
      assertFreshAllowed({ ...request(), environment: 'production' }),
    ).toThrowError(FreshForbiddenError);
  });

  it('rejects every environment when the allow list is empty', () => {
    expect(() =>
      assertFreshAllowed({ ...request(), allowedEnvironments: [] }),
    ).toThrowError(FreshForbiddenError);
  });

  it('checks the environment before target confirmation', () => {
    expect(() =>
      assertFreshAllowed({
        ...request(),
        environment: 'production',
        confirm: undefined,
      }),
    ).toThrowError(FreshForbiddenError);
  });

  it.each([
    undefined,
    '',
    'localhost:8081/other',
    'other:8081/seed-tests',
    'LOCALHOST:8081/seed-tests',
    ' localhost:8081/seed-tests',
    'localhost:8081/seed-tests ',
  ])('rejects a mismatched confirmation: %s', (confirm) => {
    expect(() => assertFreshAllowed({ ...request(), confirm })).toThrowError(
      FreshConfirmationError,
    );
  });

  it('shows the exact required confirmation flag', () => {
    expect(() =>
      assertFreshAllowed({ ...request(), confirm: undefined }),
    ).toThrowError('--confirm=localhost:8081/seed-tests');
  });

  it('uses core SeedingError subclasses for guard failures', () => {
    expect(() =>
      assertFreshAllowed({ ...request(), confirm: undefined }),
    ).toThrowError(SeedingError);
  });
});

describe('parseConfirmFlag', () => {
  it('reads confirmation among unrelated arguments', () => {
    expect(
      parseConfirmFlag([
        'node',
        'fresh.js',
        '--seed',
        '--confirm=localhost:8081/seed-tests',
      ]),
    ).toBe('localhost:8081/seed-tests');
  });

  it('returns undefined when the flag is absent', () => {
    expect(parseConfirmFlag(['--seed'])).toBeUndefined();
  });

  it('requires the equals-sign form', () => {
    expect(parseConfirmFlag(['--confirm', 'host/database'])).toBeUndefined();
  });

  it('does not accept a different flag with the same suffix', () => {
    expect(parseConfirmFlag(['--other-confirm=host/database'])).toBeUndefined();
  });

  it('preserves an empty confirmation', () => {
    expect(parseConfirmFlag(['--confirm='])).toBe('');
  });

  it('preserves equals signs inside the confirmation', () => {
    expect(parseConfirmFlag(['--confirm=host/database=value'])).toBe(
      'host/database=value',
    );
  });

  it('uses the first confirmation when repeated', () => {
    expect(
      parseConfirmFlag([
        '--confirm=first/database',
        '--confirm=second/database',
      ]),
    ).toBe('first/database');
  });
});
