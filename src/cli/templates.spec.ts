import { describe, expect, it } from 'vitest';
import { normalizeName } from './names.js';
import { factoryTemplate, seederTemplate } from './templates.js';

describe('seederTemplate', () => {
  it('renders the public seeder contract and environment guard', () => {
    const template = seederTemplate(normalizeName('UserProfileSeeder'), 'ts');
    expect(template).toContain(
      "import type { Seeder } from '@lightsoft-pe/seeding';",
    );
    expect(template).toContain(
      'export const userProfileSeeder: Seeder<string> = {',
    );
    expect(template).toContain("name: 'UserProfile'");
    expect(template).toContain("allowedEnvironments: ['local', 'dev']");
    expect(template).toContain('async run(context)');
    expect(template).toContain('TODO');
  });

  it('renders JavaScript without TypeScript syntax', () => {
    const template = seederTemplate(normalizeName('Demo'), 'js');
    expect(template).toContain(
      "@type {import('@lightsoft-pe/seeding').Seeder<string>}",
    );
    expect(template).toContain('export const demoSeeder = {');
    expect(template).not.toContain('import type');
    expect(template).not.toContain(': Seeder<string>');
  });
});

describe('factoryTemplate', () => {
  it('renders the domain placeholder and deterministic factory definition', () => {
    const template = factoryTemplate(
      normalizeName('ProductFactory'),
      'products',
    );
    expect(template).toContain(
      "import { defineFactory, deterministicUuid } from '@lightsoft-pe/seeding';",
    );
    expect(template).toContain(
      'TODO: Replace this interface with your domain type.',
    );
    expect(template).toContain('interface Product {\n  id: string;\n}');
    expect(template).toContain(
      'export const productFactory = defineFactory<Product>({',
    );
    expect(template).toContain("name: 'Product'");
    expect(template).toContain('collection: "products"');
    expect(template).toContain('definition: ({ faker }) => ({');
    expect(template).toContain('id: deterministicUuid(faker)');
  });

  it('escapes custom collection text as a string literal', () => {
    const collection = 'products"\\\n\u2028\u2029';
    const template = factoryTemplate(normalizeName('Product'), collection);
    expect(template).toContain(
      'collection: "products\\"\\\\\\n\\u2028\\u2029"',
    );
  });
});
