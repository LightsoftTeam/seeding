import { SeedingError } from '../errors.js';

export class InvalidCliArgumentsError extends SeedingError {
  public constructor(message: string) {
    super(message, { code: 'INVALID_CLI_ARGUMENTS' });
  }
}

export class InvalidGeneratorNameError extends SeedingError {
  public constructor(name: string) {
    super(
      `Invalid name "${name}": start with a letter, use only letters, digits, - or _, and include a name before Seeder/Factory.`,
      { code: 'INVALID_GENERATOR_NAME' },
    );
  }
}

export class GeneratedFileExistsError extends SeedingError {
  public constructor(path: string) {
    super(`File already exists: ${path}`, {
      code: 'GENERATED_FILE_EXISTS',
      details: { path },
    });
  }
}

export class GeneratedFileWriteError extends SeedingError {
  public constructor(path: string, cause: unknown) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    super(`Could not create ${path}: ${reason}`, {
      code: 'GENERATED_FILE_WRITE_FAILED',
      details: { path },
    });
  }
}
