import { describe, expect, it } from 'vitest';
import { matchesPartial } from './index.js';

describe('matchesPartial', () => {
  it('matches nested objects without requiring every document field', () => {
    expect(
      matchesPartial(
        {
          id: 'u1',
          profile: { name: 'Ada', location: { city: 'Lima', zip: 1 } },
        },
        { profile: { location: { city: 'Lima' } } },
      ),
    ).toBe(true);
  });

  it('rejects a different nested field', () => {
    expect(
      matchesPartial(
        { profile: { city: 'Lima' } },
        { profile: { city: 'Cusco' } },
      ),
    ).toBe(false);
  });

  it.each([
    [[{ name: 'Ada' }], [{ name: 'Ada' }], true],
    [[{ name: 'Ada', active: true }], [{ name: 'Ada' }], false],
    [[1, 2], [1], false],
    [[1, 2], [2, 1], false],
    [{ 0: 1 }, [1], false],
  ])('matches array %j against %j exactly: %s', (document, expected, match) => {
    expect(matchesPartial({ items: document }, { items: expected })).toBe(
      match,
    );
  });

  it.each([
    [NaN, NaN, true],
    [-0, 0, false],
    [1, '1', false],
    [null, null, true],
    [null, {}, false],
    [undefined, undefined, true],
    [true, false, false],
  ])(
    'compares primitives %j and %j with Object.is: %s',
    (document, expected, match) => {
      expect(matchesPartial(document, expected)).toBe(match);
    },
  );

  it('distinguishes an absent field from an explicitly undefined field', () => {
    expect(matchesPartial({}, { name: undefined })).toBe(false);
  });

  it('matches an explicitly undefined field', () => {
    expect(matchesPartial({ name: undefined }, { name: undefined })).toBe(true);
  });

  it('does not match an inherited field', () => {
    const document: unknown = Object.create({ name: 'Ada' });

    expect(matchesPartial(document, { name: 'Ada' })).toBe(false);
  });
});
