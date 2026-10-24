import { assertFreshAllowed } from '../fresh-guard.js';
import type { InspectableSeedPersister } from '../persister.js';

export interface RefreshDatabaseOptions {
  collections?: string[];
  guard?: Parameters<typeof assertFreshAllowed>[0];
}

/** Delete items in selected collections, or all collections when omitted. */
export async function refreshDatabase(
  persister: InspectableSeedPersister,
  options: RefreshDatabaseOptions = {},
): Promise<void> {
  if (options.guard !== undefined) {
    assertFreshAllowed(options.guard);
  }

  await persister.reset(options.collections);
}
