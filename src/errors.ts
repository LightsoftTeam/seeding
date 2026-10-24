export interface SeedingErrorOptions {
  code?: string;
  details?: unknown;
}

export class SeedingError extends Error {
  public readonly code: string;
  public readonly details?: unknown;

  public constructor(
    message: string,
    { code = 'SEEDING_FAILED', details }: SeedingErrorOptions = {},
  ) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.details = details;
  }
}

export class SeedingForbiddenError extends SeedingError {
  public constructor(
    message: string,
    { code = 'SEEDING_FORBIDDEN', details }: SeedingErrorOptions = {},
  ) {
    super(message, { code, details });
  }
}

export class UnknownSeederError extends SeedingError {
  public constructor(
    message: string,
    { code = 'UNKNOWN_SEEDER', details }: SeedingErrorOptions = {},
  ) {
    super(message, { code, details });
  }
}
