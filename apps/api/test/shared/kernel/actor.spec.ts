import { describe, expect, it } from 'vitest';
import {
  Actor,
  isUuidV7,
  type SessionId,
  type UserId,
} from '../../../src/shared/kernel/index.js';

const userId = '0192f000-aaaa-7000-8000-000000000001' as UserId;
const sessionId = '0192f000-bbbb-7000-8000-000000000009' as SessionId;

describe('Actor', () => {
  it('user actor exposes its id as the envelope actorId', () => {
    const actor = Actor.user(userId, sessionId, {
      correlationId: 'req_1',
      clientMutationId: 'cm_1',
    });

    expect(actor).toEqual({
      kind: 'user',
      userId,
      sessionId,
      correlationId: 'req_1',
      clientMutationId: 'cm_1',
    });
    expect(Object.isFrozen(actor)).toBe(true);
    expect(Actor.userIdOf(actor)).toBe(userId);
  });

  it('anonymous and system actors have no actorId', () => {
    expect(
      Actor.userIdOf(Actor.anonymous({ correlationId: 'req_2' })),
    ).toBeNull();
    expect(
      Actor.userIdOf(
        Actor.system('scheduler:invitations', { correlationId: 'job_1' }),
      ),
    ).toBeNull();
  });

  it('omits clientMutationId when absent instead of storing undefined', () => {
    const actor = Actor.anonymous({
      correlationId: 'req_2',
      clientMutationId: undefined,
    });
    expect('clientMutationId' in actor).toBe(false);
  });
});

describe('isUuidV7', () => {
  it.each([
    ['0192f5a3-7c1e-7b8a-9f00-3c2d1e4b5a69', true],
    ['0192f5a3-7c1e-4b8a-9f00-3c2d1e4b5a69', false], // v4
    ['0192f5a3-7c1e-7b8a-cf00-3c2d1e4b5a69', false], // wrong variant
    ['0192F5A3-7C1E-7B8A-9F00-3C2D1E4B5A69', false], // uppercase: the app only emits lowercase
    ['not-a-uuid', false],
  ])('%s → %s', (value, expected) => {
    expect(isUuidV7(value)).toBe(expected);
  });
});
