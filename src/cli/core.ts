import { join } from 'node:path';
import { SeedingError } from '../errors.js';
import { parseArguments } from './arguments.js';
import type { GeneratorCommand } from './arguments.js';
import { GeneratedFileWriteError } from './errors.js';
import { factoryTemplate, seederTemplate } from './templates.js';

const SUCCESS_EXIT_CODE = 0;
const FAILURE_EXIT_CODE = 1;

export const USAGE = `Usage:
  seeding make:seeder <Name> [--dir <path>] [--ext ts|js]
  seeding make:factory <Name> [--dir <path>] [--collection <name>]
  seeding --help
`;

export interface GeneratedFile {
  readonly path: string;
  readonly content: string;
}

export interface CliResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface CliPlan extends CliResult {
  readonly file?: GeneratedFile;
}

export type FileWriter = (file: GeneratedFile) => Promise<string>;

/** Plan output and file contents without writing files or exiting. */
export function planCli(argv: readonly string[]): CliPlan {
  try {
    const command = parseArguments(argv);
    if (command.kind === 'help') {
      return { exitCode: SUCCESS_EXIT_CODE, stdout: USAGE, stderr: '' };
    }
    return {
      exitCode: SUCCESS_EXIT_CODE,
      stdout: '',
      stderr: '',
      file: generatedFile(command),
    };
  } catch (error) {
    return failureResult(error);
  }
}

/** Execute a plan through an injected writer; return process-independent output. */
export async function runCli(
  argv: readonly string[],
  writeFile: FileWriter,
): Promise<CliResult> {
  const plan = planCli(argv);
  if (plan.file === undefined) {
    return plan;
  }
  try {
    const path = await writeFile(plan.file);
    return { exitCode: SUCCESS_EXIT_CODE, stdout: `${path}\n`, stderr: '' };
  } catch (error) {
    return failureResult(asWriteError(error, plan.file.path));
  }
}

function generatedFile(
  command: Exclude<GeneratorCommand, { kind: 'help' }>,
): GeneratedFile {
  if (command.kind === 'seeder') {
    return {
      path: join(
        command.directory,
        `${command.name.kebab}.seeder.${command.extension}`,
      ),
      content: seederTemplate(command.name, command.extension),
    };
  }
  return {
    path: join(command.directory, `${command.name.kebab}.factory.ts`),
    content: factoryTemplate(command.name, command.collection),
  };
}

function failureResult(error: unknown): CliResult {
  const message = error instanceof Error ? error.message : String(error);
  return {
    exitCode: FAILURE_EXIT_CODE,
    stdout: '',
    stderr: `${message}\n\n${USAGE}`,
  };
}

function asWriteError(error: unknown, path: string): SeedingError {
  return error instanceof SeedingError
    ? error
    : new GeneratedFileWriteError(path, error);
}
