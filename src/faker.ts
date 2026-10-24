import { Faker, base, en } from '@faker-js/faker';
import type { LocaleDefinition } from '@faker-js/faker';

const DEFAULT_LOCALE: LocaleDefinition[] = [en, base];
const UUID_VERSION_4 = '4';
const UUID_HEX_LENGTH = 32;
const UUID_VERSION_INDEX = 12;
const UUID_VARIANT_INDEX = 16;
const UUID_VARIANT_DIGITS = ['8', '9', 'a', 'b'] as const;
const HEX_RADIX = 16;
const UUID_GROUPS = [
  [0, 8],
  [8, 12],
  [12, 16],
  [16, 20],
  [20, 32],
] as const;

export interface SeededFakerOptions {
  locale?: LocaleDefinition[];
}

export function createSeededFaker(
  seed: number,
  { locale = DEFAULT_LOCALE }: SeededFakerOptions = {},
): Faker {
  const faker = new Faker({ locale });
  faker.seed(seed);

  return faker;
}

export function deterministicUuid(faker: Faker): string {
  const hex = faker.string.hexadecimal({
    length: UUID_HEX_LENGTH,
    casing: 'lower',
    prefix: '',
  });
  const variantSource = parseInt(hex.charAt(UUID_VARIANT_INDEX), HEX_RADIX);
  const digits = [...hex];
  digits[UUID_VERSION_INDEX] = UUID_VERSION_4;
  digits[UUID_VARIANT_INDEX] =
    UUID_VARIANT_DIGITS[variantSource % UUID_VARIANT_DIGITS.length] ?? '8';
  const normalized = digits.join('');

  return UUID_GROUPS.map(([start, end]) => normalized.slice(start, end)).join(
    '-',
  );
}
