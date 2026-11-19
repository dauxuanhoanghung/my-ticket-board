import type { DomainEvent } from './domain-event.js';
import { Entity } from './entity.js';

/**
 * The consistency boundary: one aggregate per transaction, loaded and saved as a whole.
 *
 * ### Two ways to get an instance
 *
 * Every subclass exposes two static factories and keeps its constructor private:
 *
 * - **create** (`User.register`, `Board.create`) validates input, sets `version` to 0 and
 *   raises the "created" event.
 * - **rehydrate** rebuilds an instance from stored state at its stored version. It never
 *   validates business rules again and never raises events. Only repositories call it.
 *
 * ### Version
 *
 * `version` is the version this instance was **loaded at** (0 = never saved). A repository
 * writes `UPDATE … SET version = :next WHERE id = :id AND version = :version`, then calls
 * `markPersisted()`. 0 affected rows means someone else saved first → `ConcurrencyError`.
 * One save bumps the version by one, however many events the command raised.
 *
 * ### Events
 *
 * Methods call `raise()`. The UnitOfWork calls `pullEvents()` after the save, inside the
 * same transaction, and hands the events to the outbox writer.
 */
export abstract class AggregateRoot<TId extends string> extends Entity<TId> {
  #version: number;
  #pendingEvents: DomainEvent[] = [];

  protected constructor(id: TId, version: number) {
    super(id);
    if (!Number.isInteger(version) || version < 0) {
      throw new RangeError(
        `Aggregate version must be a non-negative integer, got ${version}`,
      );
    }
    this.#version = version;
  }

  /** Version as last loaded or saved. 0 for an aggregate that was never persisted. */
  get version(): number {
    return this.#version;
  }

  /** The version the next save writes. */
  get nextVersion(): number {
    return this.#version + 1;
  }

  get isNew(): boolean {
    return this.#version === 0;
  }

  get hasPendingEvents(): boolean {
    return this.#pendingEvents.length > 0;
  }

  /**
   * Called by the repository after a successful write, never by domain code.
   * TypeScript has no "friend" access, so this is public by necessity.
   */
  markPersisted(): void {
    this.#version = this.nextVersion;
  }

  /** Returns the pending events and clears them, so a second call returns nothing. */
  pullEvents(): readonly DomainEvent[] {
    const events = this.#pendingEvents;
    this.#pendingEvents = [];
    return events;
  }

  protected raise(event: DomainEvent): void {
    if (event.aggregateId !== this.id) {
      throw new Error(
        `Event ${event.eventType} targets aggregate ${event.aggregateId}, raised on ${this.id}`,
      );
    }
    this.#pendingEvents.push(event);
  }
}
