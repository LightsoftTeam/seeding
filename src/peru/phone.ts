import type { Faker } from '@faker-js/faker';

const MOBILE_PREFIX = '9';
const MOBILE_SUBSCRIBER_DIGITS = 8;
const MOBILE_PATTERN = /^9\d{8}$/;

export function generateMobilePhone(faker: Faker): string {
  return `${MOBILE_PREFIX}${faker.string.numeric({ length: MOBILE_SUBSCRIBER_DIGITS, allowLeadingZeros: true })}`;
}

export function isValidMobilePhone(value: string): boolean {
  return MOBILE_PATTERN.test(value);
}
