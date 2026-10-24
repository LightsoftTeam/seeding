import { describe, expect, it } from 'vitest';
import { matchesPartial } from './index.js';

describe('matchesPartial', () => {
  it.each([
    [new Date('2026-01-01'), new Date('2026-01-01'), true],
    [new Date('2026-01-01'), new Date('2026-01-02'), false],
    [new Date('2026-01-01'), {}, false],
    [{}, new Date('2026-01-01'), false],
  ])('compares dates %j and %j: %s', (document, expected, match) => {
    expect(matchesPartial({ value: document }, { value: expected })).toBe(match);
  });

  it.each([
    [new Map([['id', 1]]), new Map([['id', 1]]), true],
    [new Map([['id', 1]]), new Map([['id', 2]]), false],
    [new Map([['id', 1]]), new Map(), false],
    [new Map(), {}, false],
    [new Set([1, 2]), new Set([2, 1]), true],
    [new Set([1, 2]), new Set([1]), false],
    [new Set(), {}, false],
  ])('compares collections structurally: %s and %s', (document, expected, match) => {
    expect(matchesPartial({ value: document }, { value: expected })).toBe(match);
  });

  it('compares class instances exactly, including their prototype', () => {
    class Profile {
      public constructor(public readonly name: string) {}
    }

    expect(matchesPartial(new Profile('Ada'), new Profile('Ada'))).toBe(true);
    expect(matchesPartial(new Profile('Ada'), new Profile('Grace'))).toBe(false);
    expect(matchesPartial(new Profile('Ada'), { name: 'Ada' })).toBe(false);
    expect(matchesPartial(new Profile('Ada'), {})).toBe(false);
  });

  it('partially matches objects with null prototypes', () => {
    const document: unknown = Object.assign(Object.create(null), {
      name: 'Ada',
      active: true,
    });
    const expected: unknown = Object.assign(Object.create(null), { name: 'Ada' });

    expect(matchesPartial(document, expected)).toBe(true);
  });

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
