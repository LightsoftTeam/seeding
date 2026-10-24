import type { Faker } from '@faker-js/faker';

export const DNI_LENGTH = 8;
const DNI_PATTERN = /^\d{8}$/;

export function generateDni(faker: Faker): string {
  return faker.string.numeric({ length: DNI_LENGTH, allowLeadingZeros: false });
}

export function isValidDni(value: string): boolean {
  return DNI_PATTERN.test(value);
}
