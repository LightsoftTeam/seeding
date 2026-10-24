import { FreshConfirmationError, FreshForbiddenError } from './errors.js';

const CONFIRM_FLAG_PREFIX = '--confirm=';

export interface FreshRequest<TEnv extends string = string> {
  environment: TEnv;
  allowedEnvironments: readonly TEnv[];
  target: { host: string; database: string };
  confirm?: string;
}

/** Require an explicitly allowed environment and exact target confirmation. */
export function assertFreshAllowed<TEnv extends string>(
  request: FreshRequest<TEnv>,
): void {
  assertAllowedEnvironment(request);
  assertConfirmedTarget(request);
}

/** Read the first --confirm=value argument without interpreting other flags. */
export function parseConfirmFlag(argv: readonly string[]): string | undefined {
  return argv
    .find((argument) => argument.startsWith(CONFIRM_FLAG_PREFIX))
    ?.slice(CONFIRM_FLAG_PREFIX.length);
}

function assertAllowedEnvironment<TEnv extends string>({
  environment,
  allowedEnvironments,
}: FreshRequest<TEnv>): void {
  if (allowedEnvironments.includes(environment)) {
    return;
  }

  throw new FreshForbiddenError(
    `db:fresh is refused in environment "${environment}"`,
    { details: { environment, allowedEnvironments } },
  );
}

function assertConfirmedTarget<TEnv extends string>({
  target,
  confirm,
}: FreshRequest<TEnv>): void {
  const expected = `${target.host}/${target.database}`;
  if (confirm === expected) {
    return;
  }

  throw new FreshConfirmationError(
    `db:fresh requires --confirm=${expected} to proceed`,
    { details: { expected, received: confirm } },
  );
}
