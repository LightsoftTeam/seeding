import { describe, expect, it } from 'vitest';
import { createSeededFaker } from '../faker.js';
import { generateDni, isValidDni } from './dni.js';
import { generateMobilePhone, isValidMobilePhone } from './phone.js';
import { computeRucCheckDigit, generateRuc, isValidRuc } from './ruc.js';

const SEED = 7;
const SAMPLE_SIZE = 50;
const KNOWN_VALID_RUCS = ['20100070970', '20131312955'];

function sample<T>(generate: () => T): T[] {
  return Array.from({ length: SAMPLE_SIZE }, generate);
}

describe('computeRucCheckDigit', () => {
  it.each(KNOWN_VALID_RUCS)('reproduces the check digit of %s', (ruc) => {
    expect(computeRucCheckDigit(ruc.slice(0, 10))).toBe(Number(ruc[10]));
  });

  it('maps a remainder of 10 to check digit 0', () => {
    expect(computeRucCheckDigit('2010007097')).toBe(0);
  });

  it('maps a remainder of 11 to check digit 1', () => {
    expect(computeRucCheckDigit('0000000000')).toBe(1);
  });

  it('rejects a body that is not 10 digits', () => {
    expect(() => computeRucCheckDigit('123')).toThrowError(/10 digits/);
  });
});

describe('isValidRuc', () => {
  it.each(KNOWN_VALID_RUCS)('accepts the real RUC %s', (ruc) => {
    expect(isValidRuc(ruc)).toBe(true);
  });

  it('rejects a RUC with a wrong check digit', () => {
    expect(isValidRuc('20100070971')).toBe(false);
  });

  it('rejects a RUC with the wrong length', () => {
    expect(isValidRuc('2010007097')).toBe(false);
  });
});

describe('generateRuc', () => {
  it('generates valid company RUCs starting with 20', () => {
    const faker = createSeededFaker(SEED);

    const rucs = sample(() => generateRuc(faker, 'company'));

    expect(rucs.every((ruc) => isValidRuc(ruc) && ruc.startsWith('20'))).toBe(
      true,
    );
  });

  it('generates valid individual RUCs starting with 10', () => {
    const faker = createSeededFaker(SEED);

    const rucs = sample(() => generateRuc(faker, 'individual'));

    expect(rucs.every((ruc) => isValidRuc(ruc) && ruc.startsWith('10'))).toBe(
      true,
    );
  });
});

describe('generateDni', () => {
  it('generates 8-digit DNIs', () => {
    const faker = createSeededFaker(SEED);

    expect(sample(() => generateDni(faker)).every(isValidDni)).toBe(true);
  });

  it('rejects DNIs with the wrong length', () => {
    expect(isValidDni('1234567')).toBe(false);
  });
});

describe('generateMobilePhone', () => {
  it('generates 9-digit numbers starting with 9', () => {
    const faker = createSeededFaker(SEED);

    expect(
      sample(() => generateMobilePhone(faker)).every(isValidMobilePhone),
    ).toBe(true);
  });

  it('rejects numbers that do not start with 9', () => {
    expect(isValidMobilePhone('812345678')).toBe(false);
  });
});
