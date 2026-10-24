import type { SeederExtension } from './arguments.js';
import type { GeneratorName } from './names.js';

/** Render a seeder in TypeScript or executable JavaScript. */
export function seederTemplate(
  name: GeneratorName,
  extension: SeederExtension,
): string {
  const header =
    extension === 'ts'
      ? `import type { Seeder } from '@lightsoft-pe/seeding';\n\n`
      : `/** @type {import('@lightsoft-pe/seeding').Seeder<string>} */\n`;
  const annotation = extension === 'ts' ? ': Seeder<string>' : '';
  return `${header}export const ${name.camel}Seeder${annotation} = {
  name: '${name.pascal}',
  allowedEnvironments: ['local', 'dev'],
  async run(context) {
    // TODO: Seed your data using context.
  },
};
`;
}

/** Render a typed factory with a placeholder domain interface. */
export function factoryTemplate(
  name: GeneratorName,
  collection: string,
): string {
  return `import { defineFactory, deterministicUuid } from '@lightsoft-pe/seeding';

// TODO: Replace this interface with your domain type.
interface ${name.pascal} {
  id: string;
}

export const ${name.camel}Factory = defineFactory<${name.pascal}>({
  name: '${name.pascal}',
  collection: ${quoteString(collection)},
  definition: ({ faker }) => ({
    id: deterministicUuid(faker),
  }),
});
`;
}

function quoteString(value: string): string {
  return JSON.stringify(value)
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
