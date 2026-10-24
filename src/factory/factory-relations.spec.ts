import { describe, expect, it } from 'vitest';
import {
  commentFactory,
  postFactory,
  RecordingPersister,
  testContext,
  userFactory,
} from './fixtures.js';
import type { Post, User } from './fixtures.js';

describe('for(entity)', () => {
  it('copies the owner key into the foreign key', async () => {
    const author = await userFactory.make(testContext());

    const post = await postFactory.for(author, 'authorId').make(testContext());

    expect(post.authorId).toBe(author.id);
  });

  it('supports a custom owner key', async () => {
    const author = await userFactory.make(testContext());

    const post = await postFactory
      .for(author, 'authorId', 'name')
      .make(testContext());

    expect(post.authorId).toBe(author.name);
  });

  it('is beaten by overrides', async () => {
    const author = await userFactory.make(testContext());

    const post = await postFactory
      .for(author, 'authorId')
      .make(testContext(), { authorId: 'manual' });

    expect(post.authorId).toBe('manual');
  });
});

describe('for(builder)', () => {
  it('shares one parent across the whole batch', async () => {
    const persister = new RecordingPersister();

    const posts = await postFactory
      .for(userFactory, 'authorId')
      .count(3)
      .createMany(testContext(persister));

    expect(new Set(posts.map((post) => post.authorId)).size).toBe(1);
    expect(persister.documentsIn('users')).toHaveLength(1);
  });

  it('persists the parent before the children', async () => {
    const persister = new RecordingPersister();

    await postFactory
      .for(userFactory, 'authorId')
      .create(testContext(persister));

    expect(persister.writes).toEqual(['users', 'posts']);
  });

  it('makes the parent without persisting on make', async () => {
    const persister = new RecordingPersister();

    await postFactory.for(userFactory, 'authorId').make(testContext(persister));

    expect(persister.writes).toEqual([]);
  });

  it('does not create a parent when the key is overridden', async () => {
    const persister = new RecordingPersister();

    await postFactory
      .for(userFactory, 'authorId')
      .create(testContext(persister), { authorId: 'manual' });

    expect(persister.writes).toEqual(['posts']);
  });
});

describe('has()', () => {
  it('creates the requested number of children per parent', async () => {
    const persister = new RecordingPersister();

    await userFactory
      .count(2)
      .has(postFactory.count(3), 'authorId')
      .createMany(testContext(persister));

    expect(persister.documentsIn('posts')).toHaveLength(6);
  });

  it('defaults to one child', async () => {
    const persister = new RecordingPersister();

    await userFactory
      .has(postFactory, 'authorId')
      .create(testContext(persister));

    expect(persister.documentsIn('posts')).toHaveLength(1);
  });

  it('wires the foreign key to the owning parent', async () => {
    const persister = new RecordingPersister();

    const users = await userFactory
      .count(2)
      .has(postFactory.count(2), 'authorId')
      .createMany(testContext(persister));

    const posts = persister.documentsIn<Post>('posts');
    const authors = new Set(users.map((user) => user.id));
    expect(posts.every((post) => authors.has(post.authorId))).toBe(true);
  });

  it('persists the parent before its children', async () => {
    const persister = new RecordingPersister();

    await userFactory
      .has(postFactory, 'authorId')
      .create(testContext(persister));

    expect(persister.writes).toEqual(['users', 'posts']);
  });

  it('does not create a stray parent for a child belongsTo it already has', async () => {
    const persister = new RecordingPersister();

    await userFactory
      .has(postFactory, 'authorId')
      .create(testContext(persister));

    expect(persister.documentsIn('users')).toHaveLength(1);
  });
});

describe('belongsTo()', () => {
  it('creates a parent when nothing is recycled', async () => {
    const persister = new RecordingPersister();

    const post = await postFactory.create(testContext(persister));

    const [author] = persister.documentsIn<User>('users');
    expect(post.authorId).toBe(author?.id);
  });

  it('persists the lazy parent before the child', async () => {
    const persister = new RecordingPersister();

    await postFactory.create(testContext(persister));

    expect(persister.writes).toEqual(['users', 'posts']);
  });

  it('makes the lazy parent on make without persisting', async () => {
    const persister = new RecordingPersister();

    const post = await postFactory.make(testContext(persister));

    expect(post.authorId).toEqual(expect.any(String));
    expect(persister.writes).toEqual([]);
  });

  it('creates a separate parent for each entity', async () => {
    const persister = new RecordingPersister();

    await postFactory.count(3).createMany(testContext(persister));

    expect(persister.documentsIn('users')).toHaveLength(3);
  });
});

describe('recycle', () => {
  it('reuses recycled entities for belongsTo', async () => {
    const persister = new RecordingPersister();
    const users = await userFactory.count(2).makeMany(testContext());

    const posts = await postFactory
      .recycle(userFactory, users)
      .count(6)
      .createMany(testContext(persister));

    const ids = new Set(users.map((user) => user.id));
    expect(posts.every((post) => ids.has(post.authorId))).toBe(true);
    expect(persister.documentsIn('users')).toEqual([]);
  });

  it('reuses recycled entities for for(builder)', async () => {
    const [user] = await userFactory.makeMany(testContext());

    const post = await postFactory
      .for(userFactory, 'authorId')
      .recycle(userFactory, [user as User])
      .make(testContext());

    expect(post.authorId).toBe(user?.id);
  });

  it('propagates into nested for/has/belongsTo builders', async () => {
    const persister = new RecordingPersister();
    const [user] = await userFactory.makeMany(testContext());
    const [post] = await postFactory.makeMany(testContext());

    const comments = await commentFactory
      .count(3)
      .recycle(userFactory, [user as User])
      .recycle(postFactory, [post as Post])
      .createMany(testContext(persister));

    expect(comments.every((comment) => comment.authorId === user?.id)).toBe(
      true,
    );
    expect(comments.every((comment) => comment.postId === post?.id)).toBe(true);
    expect(persister.writes).toEqual(['comments']);
  });

  it('applies to has() children relations', async () => {
    const persister = new RecordingPersister();
    const [user] = await userFactory.makeMany(testContext());
    const comments = await postFactory
      .recycle(userFactory, [user as User])
      .has(commentFactory.count(2), 'postId')
      .createMany(testContext(persister));

    expect(persister.documentsIn('comments')).toHaveLength(2);
    expect(persister.documentsIn('users')).toEqual([]);
    expect(comments[0]?.authorId).toBe(user?.id);
  });

  it('picks deterministically', async () => {
    const users = await userFactory.count(5).makeMany(testContext());
    const pick = async () =>
      (
        await postFactory
          .recycle(userFactory, users)
          .count(4)
          .makeMany(testContext(undefined, 7))
      ).map((post) => post.authorId);

    expect(await pick()).toEqual(await pick());
  });
});

describe('makeGraph', () => {
  it('returns entities and the related parents and children by collection', async () => {
    const graph = await userFactory
      .has(postFactory.count(2), 'authorId')
      .makeGraph(testContext());

    expect(graph.entities).toHaveLength(1);
    expect(graph.related['posts']).toHaveLength(2);
  });

  it('includes lazily made parents', async () => {
    const graph = await postFactory.makeGraph(testContext());

    expect(graph.related['users']).toHaveLength(1);
  });

  it('leaves recycled entities out of related', async () => {
    const users = await userFactory.makeMany(testContext());

    const graph = await postFactory
      .recycle(userFactory, users)
      .makeGraph(testContext());

    expect(graph.related['users']).toBeUndefined();
  });

  it('does not touch a persister', async () => {
    const persister = new RecordingPersister();

    await userFactory
      .has(postFactory, 'authorId')
      .makeGraph(testContext(persister));

    expect(persister.writes).toEqual([]);
  });
});
