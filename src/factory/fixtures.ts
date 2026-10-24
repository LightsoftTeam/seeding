import { createSeededFaker, deterministicUuid } from '../faker.js';
import { InMemorySeedPersister } from '../persister.js';
import type { SeedPersister } from '../persister.js';
import { defineFactory } from './define-factory.js';
import { belongsTo } from './belongs-to.js';
import type { FactoryContext } from './types.js';

export interface User {
  id: string;
  name: string;
  role: string;
  active: boolean;
}

export interface Post {
  id: string;
  title: string;
  authorId: string;
}

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
}

export const TEST_SEED = 42;

export const userFactory = defineFactory<User>({
  name: 'user',
  collection: 'users',
  definition: ({ faker }) => ({
    id: deterministicUuid(faker),
    name: faker.person.fullName(),
    role: 'member',
    active: true,
  }),
  states: {
    inactive: { active: false },
    admin: () => ({ role: 'admin' }),
  },
});

export const postFactory = defineFactory<Post>({
  name: 'post',
  collection: 'posts',
  definition: ({ faker }) => ({
    id: deterministicUuid(faker),
    title: faker.lorem.words(3),
    authorId: belongsTo(userFactory) as unknown as string,
  }),
});

export const commentFactory = defineFactory<Comment>({
  name: 'comment',
  collection: 'comments',
  definition: ({ faker }) => ({
    id: deterministicUuid(faker),
    postId: belongsTo(postFactory) as unknown as string,
    authorId: belongsTo(userFactory) as unknown as string,
  }),
});

export function testContext(
  persist?: SeedPersister,
  seed = TEST_SEED,
): FactoryContext {
  return { faker: createSeededFaker(seed), persist };
}

export class RecordingPersister extends InMemorySeedPersister {
  public readonly writes: string[] = [];

  public override async upsert<T extends { id: string }>(
    collection: string,
    documents: readonly T[],
  ): Promise<void> {
    this.writes.push(collection);
    await super.upsert(collection, documents);
  }
}
