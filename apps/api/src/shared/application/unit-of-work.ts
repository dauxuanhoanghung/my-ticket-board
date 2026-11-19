import type { AggregateRoot, DomainEvent } from '../kernel/index.js';

/**
 * Runs one command's work in a single database transaction.
 *
 * Everything inside `run()` is saved together or not at all: the aggregate
 * rows and the events about them (rule 5). A command handler uses it like this:
 *
 * ```ts
 * await this.uow.run(async () => {
 *   const user = User.register(email, fullName, hash, now);
 *   await this.users.save(user); // the repository calls uow.track(user)
 * });
 * ```
 *
 * Interfaces don't exist at runtime, so Nest can't inject by this type alone.
 * Use the `UNIT_OF_WORK` token below to register and inject it.
 */
export interface UnitOfWork {
  /** Runs `work` in one transaction. Commits if it resolves, rolls back if it throws. */
  run<T>(work: () => Promise<T>): Promise<T>;

  /** For repositories: call after saving an aggregate, so its events are kept too. */
  track(aggregate: AggregateRoot<string>): void;

  /** For handlers: keep an event that no aggregate raised (e.g. `signup_attempted`). */
  record(event: DomainEvent): void;
}
export const UNIT_OF_WORK = Symbol('UnitOfWork');
