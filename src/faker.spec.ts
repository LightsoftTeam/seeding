import { describe, expect, it } from 'vitest';
import { es, base } from '@faker-js/faker';
import { createSeededFaker, deterministicUuid } from './faker.js';

const RFC_4122_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ENGLISH_TITLE = 'English';
const SPANISH_TITLE = 'Spanish';

function draw(seed: number) {
  const faker = createSeededFaker(seed);

  return { uuid: deterministicUuid(faker), name: faker.person.fullName() };
}

describe('createSeededFaker', () => {
  it('produces the same values for the same seed', () => {
    expect(draw(2026)).toEqual(draw(2026));
  });

  it('produces different values for a different seed', () => {
    expect(draw(2026)).not.toEqual(draw(2027));
  });

  it('uses the English locale by default', () => {
    expect(createSeededFaker(1).definitions.metadata?.title).toBe(
      ENGLISH_TITLE,
    );
  });

  it('uses a custom locale when provided', () => {
    const faker = createSeededFaker(1, { locale: [es, base] });

    expect(faker.definitions.metadata?.title).toBe(SPANISH_TITLE);
  });
});

describe('deterministicUuid', () => {
  it('has the RFC 4122 version 4 shape', () => {
    expect(deterministicUuid(createSeededFaker(1))).toMatch(RFC_4122_PATTERN);
  });

  it('does not repeat within one run', () => {
    const faker = createSeededFaker(1);

    expect(deterministicUuid(faker)).not.toBe(deterministicUuid(faker));
  });
});
