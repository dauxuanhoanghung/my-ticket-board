import type { SessionId, UserId } from './ids.js';

/**
 * Who triggered a command, plus the tracing data that follows it into outbox metadata and
 * realtime events.
 *
 * Three kinds, because not every command has a signed-in user:
 * - `user`: an authenticated request (the usual case).
 * - `anonymous`: public auth flows such as `register` or `requestPasswordReset`.
 * - `system`: the worker, a consumer or a scheduled job (`SetAvatar`, `ExpireInvitations`).
 */
interface ActorTrace {
  /** From the BFF's `x-correlation-id`, or from the AMQP message in the worker. */
  readonly correlationId: string;
  /** Echoed into realtime events so a client can ignore its own echo. */
  readonly clientMutationId?: string;
}

export interface UserActor extends ActorTrace {
  readonly kind: 'user';
  readonly userId: UserId;
  readonly sessionId: SessionId;
}

export interface AnonymousActor extends ActorTrace {
  readonly kind: 'anonymous';
}

export interface SystemActor extends ActorTrace {
  readonly kind: 'system';
  /** What acted, for logs and activity: `'worker:image-processor'`, `'scheduler:invitations'`. */
  readonly name: string;
}

export type Actor = UserActor | AnonymousActor | SystemActor;

type Trace = { correlationId: string; clientMutationId?: string | undefined };

function trace({ correlationId, clientMutationId }: Trace): ActorTrace {
  return clientMutationId === undefined
    ? { correlationId }
    : { correlationId, clientMutationId };
}

/** Factories, so call sites read `Actor.user(…)`. The type and the value share one name. */
export const Actor = {
  user: (userId: UserId, sessionId: SessionId, t: Trace): UserActor =>
    Object.freeze({ kind: 'user', userId, sessionId, ...trace(t) }),

  anonymous: (t: Trace): AnonymousActor =>
    Object.freeze({ kind: 'anonymous', ...trace(t) }),

  system: (name: string, t: Trace): SystemActor =>
    Object.freeze({ kind: 'system', name, ...trace(t) }),

  /** The user id if a user acted, else `null`. This is the envelope's `metadata.actorId`. */
  userIdOf: (actor: Actor): UserId | null =>
    actor.kind === 'user' ? actor.userId : null,
} as const;
