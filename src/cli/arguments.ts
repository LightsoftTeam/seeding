import { InvalidCliArgumentsError } from './errors.js';
import { normalizeName } from './names.js';
import type { GeneratorName } from './names.js';

const SEEDER_COMMAND = 'make:seeder';
const FACTORY_COMMAND = 'make:factory';
const DEFAULT_SEEDER_DIRECTORY = 'src/database/seeders';
const DEFAULT_FACTORY_DIRECTORY = 'src/database/factories';
const DEFAULT_EXTENSION = 'ts';
const HELP_FLAG = '--help';
const DIRECTORY_FLAG = '--dir';
const EXTENSION_FLAG = '--ext';
const COLLECTION_FLAG = '--collection';
const OPTION_PAIR_SIZE = 2;

export type SeederExtension = 'ts' | 'js';
export type GeneratorCommand =
  | { readonly kind: 'help' }
  | {
      readonly kind: 'seeder';
      readonly name: GeneratorName;
      readonly directory: string;
      readonly extension: SeederExtension;
    }
  | {
      readonly kind: 'factory';
      readonly name: GeneratorName;
      readonly directory: string;
      readonly collection: string;
    };

/** Parse command arguments without reading process state. */
export function parseArguments(argv: readonly string[]): GeneratorCommand {
  const [command, input, ...options] = argv;
  if (command === undefined || (command === HELP_FLAG && argv.length === 1)) {
    return { kind: 'help' };
  }
  assertKnownCommand(command);
  if (input === undefined || input.startsWith('--')) {
    throw new InvalidCliArgumentsError(`Missing name for ${command}.`);
  }

  const name = normalizeName(input);
  const values = parseOptions(options, command);
  return command === SEEDER_COMMAND
    ? seederCommand(name, values)
    : factoryCommand(name, values);
}

function assertKnownCommand(command: string): void {
  if (command === SEEDER_COMMAND || command === FACTORY_COMMAND) {
    return;
  }
  throw new InvalidCliArgumentsError(`Unknown command: ${command}`);
}

function parseOptions(
  options: readonly string[],
  command: string,
): Map<string, string> {
  const allowed = [
    DIRECTORY_FLAG,
    command === SEEDER_COMMAND ? EXTENSION_FLAG : COLLECTION_FLAG,
  ];
  const values = new Map<string, string>();
  for (let index = 0; index < options.length; index += OPTION_PAIR_SIZE) {
    const flag = options[index] ?? '';
    assertAllowedOption(flag, allowed, values);
    values.set(flag, optionValue(options[index + 1], flag));
  }
  return values;
}

function assertAllowedOption(
  flag: string,
  allowed: readonly string[],
  values: ReadonlyMap<string, string>,
): void {
  if (allowed.includes(flag) && !values.has(flag)) {
    return;
  }
  throw new InvalidCliArgumentsError(`Unknown or repeated option: ${flag}`);
}

function optionValue(value: string | undefined, flag: string): string {
  if (value === undefined || value.length === 0 || value.startsWith('--')) {
    throw new InvalidCliArgumentsError(`Missing value for ${flag}.`);
  }
  return value;
}

function seederCommand(
  name: GeneratorName,
  options: ReadonlyMap<string, string>,
): GeneratorCommand {
  const extension = options.get(EXTENSION_FLAG) ?? DEFAULT_EXTENSION;
  if (extension !== 'ts' && extension !== 'js') {
    throw new InvalidCliArgumentsError('Invalid extension: use ts or js.');
  }
  return {
    kind: 'seeder',
    name,
    directory: options.get(DIRECTORY_FLAG) ?? DEFAULT_SEEDER_DIRECTORY,
    extension,
  };
}

function factoryCommand(
  name: GeneratorName,
  options: ReadonlyMap<string, string>,
): GeneratorCommand {
  return {
    kind: 'factory',
    name,
    directory: options.get(DIRECTORY_FLAG) ?? DEFAULT_FACTORY_DIRECTORY,
    collection: options.get(COLLECTION_FLAG) ?? `${name.kebab}s`,
  };
}
