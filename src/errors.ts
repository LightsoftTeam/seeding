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

export class UnknownCollectionError extends SeedingError {
  public constructor(
    message: string,
    { code = 'UNKNOWN_COLLECTION', details }: SeedingErrorOptions = {},
  ) {
    super(message, { code, details });
  }
}

export class MissingPartitionKeyError extends SeedingError {
  public constructor(
    message: string,
    { code = 'MISSING_PARTITION_KEY', details }: SeedingErrorOptions = {},
  ) {
    super(message, { code, details });
  }
}

export class ConflictingCollectionConfigError extends SeedingError {
  public constructor(
    message: string,
    { code = 'CONFLICTING_COLLECTION_CONFIG', details }: SeedingErrorOptions = {},
  ) {
    super(message, { code, details });
  }
}

export class FreshForbiddenError extends SeedingError {
  public constructor(
    message: string,
    { code = 'FRESH_ENVIRONMENT_FORBIDDEN', details }: SeedingErrorOptions = {},
  ) {
    super(message, { code, details });
  }
}

export class FreshConfirmationError extends SeedingError {
  public constructor(
    message: string,
    { code = 'FRESH_CONFIRMATION_MISMATCH', details }: SeedingErrorOptions = {},
  ) {
    super(message, { code, details });
  }
}

export class MissingPersisterError extends SeedingError {
  public constructor(
    message: string,
    { code = 'MISSING_PERSISTER', details }: SeedingErrorOptions = {},
  ) {
    super(message, { code, details });
  }
}

export class UnknownFactoryStateError extends SeedingError {
  public constructor(
    message: string,
    { code = 'UNKNOWN_FACTORY_STATE', details }: SeedingErrorOptions = {},
  ) {
    super(message, { code, details });
  }
}

export class FactoryCycleError extends SeedingError {
  public constructor(
    message: string,
    { code = 'FACTORY_CYCLE', details }: SeedingErrorOptions = {},
  ) {
    super(message, { code, details });
  }
}

export class InvalidFactoryCountError extends SeedingError {
  public constructor(
    message: string,
    { code = 'INVALID_FACTORY_COUNT', details }: SeedingErrorOptions = {},
  ) {
    super(message, { code, details });
  }
}
