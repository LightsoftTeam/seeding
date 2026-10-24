import { InvalidGeneratorNameError } from './errors.js';

const VALID_NAME = /^[a-z][a-z\d_-]*$/i;
const GENERATOR_SUFFIX = /[-_]?(?:seeder|factory)$/i;
const ACRONYM_BOUNDARY = /([A-Z]+)([A-Z][a-z])/g;
const WORD_BOUNDARY = /([a-z\d])([A-Z])/g;
const WORD_SEPARATOR = /[-_]+/;

export interface GeneratorName {
  readonly pascal: string;
  readonly camel: string;
  readonly kebab: string;
}

/** Validate an identifier and remove an optional generator suffix. */
export function normalizeName(input: string): GeneratorName {
  if (!VALID_NAME.test(input)) {
    throw new InvalidGeneratorNameError(input);
  }

  const words = splitWords(input.replace(GENERATOR_SUFFIX, ''));
  if (words.length === 0) {
    throw new InvalidGeneratorNameError(input);
  }

  const pascal = words.map(capitalize).join('');
  const camel = pascal.charAt(0).toLowerCase() + pascal.slice(1);
  return { pascal, camel, kebab: words.join('-') };
}

function splitWords(input: string): string[] {
  return input
    .replace(ACRONYM_BOUNDARY, '$1-$2')
    .replace(WORD_BOUNDARY, '$1-$2')
    .toLowerCase()
    .split(WORD_SEPARATOR)
    .filter(Boolean);
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
