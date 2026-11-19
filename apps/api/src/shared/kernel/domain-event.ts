import type { JsonShape } from './json.js';

/**
 * A past-tense fact raised by an aggregate method, e.g. `board.ticket.moved`.
 *
 * This is the **domain** half of an event. It knows nothing about transport. When the
 * UnitOfWork commits, the outbox writer wraps it in the integration envelope
 * (docs/05 §6) and adds what only infrastructure knows:
 *
 * - `id`: a UUIDv7, also used as the AMQP `message_id`
 * - `aggregate.version`: read from the aggregate after it was saved
 * - `metadata`: actor, correlation id, client mutation id
 *
 * `TPayload` is only `object` here so any event fits in a `DomainEvent[]`. JSON-safety is
 * enforced where events are declared, by `defineEvent`.
 */
export interface DomainEvent<
  TType extends string = string,
  TPayload extends object = object,
> {
  /** `<context>.<aggregate>.<past_tense>`, also the RabbitMQ routing key. */
  readonly eventType: TType;
  /** Payload schema version. Breaking changes publish v2 alongside v1. */
  readonly eventVersion: number;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly occurredAt: Date;
  readonly payload: Readonly<TPayload>;
}

export interface EventDefinition<
  TType extends string,
  TPayload extends JsonShape<TPayload>,
> {
  readonly eventType: TType;
  readonly eventVersion: number;
  readonly aggregateType: string;
  // Function-typed properties rather than methods: they don't use `this`, so they can be
  // passed around unbound, e.g. `events.filter(TicketMoved.is)`.

  /** Builds the event. `occurredAt` comes from the caller, so the domain never reads a clock. */
  readonly create: (
    aggregateId: string,
    payload: TPayload,
    occurredAt: Date,
  ) => DomainEvent<TType, TPayload>;
  /** Type guard for consumers and tests: matches on type **and** version. */
  readonly is: (event: DomainEvent) => event is DomainEvent<TType, TPayload>;
}

/** The event type produced by a definition: `type UserRegistered = EventOf<typeof UserRegistered>`. */
export type EventOf<TDef> =
  TDef extends EventDefinition<infer TType, infer TPayload>
    ? DomainEvent<TType, TPayload>
    : never;

/**
 * Declares an event once, with its name, version, aggregate type and payload shape.
 *
 * The call is curried because TypeScript can't mix an explicit type argument (the payload)
 * with an inferred one (the literal event type) in a single call:
 *
 * ```ts
 * export const UserRegistered = defineEvent<{ userId: UserId; email: string }>()({
 *   eventType: 'identity.user.registered',
 *   eventVersion: 1,
 *   aggregateType: 'User',
 * });
 * export type UserRegistered = EventOf<typeof UserRegistered>;
 *
 * this.raise(UserRegistered.create(this.id, { userId: this.id, email }, now));
 * if (UserRegistered.is(event)) event.payload.email; // typed
 * ```
 */
export function defineEvent<TPayload extends JsonShape<TPayload>>() {
  return <const TType extends string>(spec: {
    eventType: TType;
    eventVersion: number;
    aggregateType: string;
  }): EventDefinition<TType, TPayload> =>
    Object.freeze({
      ...spec,
      create: (aggregateId: string, payload: TPayload, occurredAt: Date) =>
        Object.freeze({
          ...spec,
          aggregateId,
          occurredAt,
          payload: Object.freeze({ ...payload }),
        }),
      is: (event: DomainEvent): event is DomainEvent<TType, TPayload> =>
        event.eventType === spec.eventType &&
        event.eventVersion === spec.eventVersion,
    });
}
