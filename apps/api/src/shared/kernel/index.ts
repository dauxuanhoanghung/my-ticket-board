// Public surface of the shared kernel. Contexts import from here, never from the files.
// Keep the kernel tiny (docs/04 §4.2): add something only when two or more contexts need it.

export {
  Actor,
  type AnonymousActor,
  type SystemActor,
  type UserActor,
} from './actor.js';
export { AggregateRoot } from './aggregate-root.js';
export { Clock } from './clock.js';
export {
  defineEvent,
  type DomainEvent,
  type EventDefinition,
  type EventOf,
} from './domain-event.js';
export {
  ConcurrencyError,
  DomainError,
  NotFoundError,
  ValidationError,
  type FieldErrors,
} from './domain-error.js';
export { Entity } from './entity.js';
export { IdGenerator } from './id-generator.js';
export { isUuidV7, type SessionId, type UserId } from './ids.js';
export type {
  JsonObject,
  JsonPrimitive,
  JsonShape,
  JsonValue,
} from './json.js';
export {
  fail,
  ok,
  unwrap,
  validateFields,
  type Fail,
  type Ok,
  type Result,
} from './result.js';
