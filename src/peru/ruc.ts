import type { Faker } from '@faker-js/faker';
import { SeedingError } from '../errors.js';
import { generateDni } from './dni.js';

export type Taxpayer = 'company' | 'individual';

const RUC_LENGTH = 11;
const RUC_BODY_LENGTH = 10;
const RUC_WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2] as const;
const CHECK_DIGIT_MODULUS = 11;
const CHECK_DIGIT_TEN = 10;
const RUC_BODY_PATTERN = /^\d{10}$/;
const RUC_PATTERN = /^\d{11}$/;
const COMPANY_PREFIX = '20';
const INDIVIDUAL_PREFIX = '10';
const COMPANY_SERIAL_DIGITS = 8;

export function computeRucCheckDigit(first10: string): number {
  if (!RUC_BODY_PATTERN.test(first10)) {
    throw new SeedingError('RUC body must be exactly 10 digits', {
      code: 'INVALID_RUC_BODY',
      details: { first10 },
    });
  }

  const weightedSum = RUC_WEIGHTS.reduce(
    (sum, weight, index) => sum + weight * Number(first10[index]),
    0,
  );
  const remainder = CHECK_DIGIT_MODULUS - (weightedSum % CHECK_DIGIT_MODULUS);

  return remainder % CHECK_DIGIT_TEN;
}

export function isValidRuc(ruc: string): boolean {
  if (!RUC_PATTERN.test(ruc)) {
    return false;
  }

  const body = ruc.slice(0, RUC_BODY_LENGTH);

  return computeRucCheckDigit(body) === Number(ruc[RUC_LENGTH - 1]);
}

export function generateRuc(faker: Faker, taxpayer: Taxpayer): string {
  const body =
    taxpayer === 'company' ? companyBody(faker) : individualBody(faker);

  return `${body}${computeRucCheckDigit(body)}`;
}

function companyBody(faker: Faker): string {
  const serial = faker.string.numeric({
    length: COMPANY_SERIAL_DIGITS,
    allowLeadingZeros: true,
  });

  return `${COMPANY_PREFIX}${serial}`;
}

function individualBody(faker: Faker): string {
  return `${INDIVIDUAL_PREFIX}${generateDni(faker)}`;
}
