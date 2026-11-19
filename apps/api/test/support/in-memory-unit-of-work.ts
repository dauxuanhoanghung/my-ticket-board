import type { UnitOfWork } from '../../src/shared/application/index.js';
import type {
  AggregateRoot,
  DomainEvent,
} from '../../src/shared/kernel/index.js';

/** Anything that can be put back the way it was when a transaction fails. */
export interface Rollbackable {
  snapshot(): unknown;
  restore(snapshot: unknown): void;
}

/**
 * A `UnitOfWork` for tests. No database, same behaviour:
 *
 * - "Commit": the events of the transaction are added to `committed`, which
 *   stands in for the outbox table.
 * - "Rollback": every registered `InMemoryTable` goes back to how it was.
 * - A `run()` inside another `run()` joins it.
 *
 * Handles one transaction at a time, which is all a unit test needs.
 */
export class InMemoryUnitOfWork implements UnitOfWork {
  /** Events of every committed transaction, oldest first. */
  readonly committed: DomainEvent[] = [];

  #pending: DomainEvent[] | null = null; // null = no transaction running
  readonly #tables: Rollbackable[] = [];

  /** Called by `InMemoryTable`, so the table rolls back with this UoW. */
  register(table: Rollbackable): void {
    this.#tables.push(table);
  }

  async run<T>(work: () => Promise<T>): Promise<T> {
    if (this.#pending) return work(); // nested: join the running transaction

    this.#pending = [];
    const snapshots = this.#tables.map((table) => ({
      table,
      rows: table.snapshot(),
    }));

    try {
      const result = await work();
      this.committed.push(...this.#pending); // COMMIT
      return result;
    } catch (error) {
      for (const { table, rows } of snapshots) table.restore(rows); // ROLLBACK
      throw error;
    } finally {
      this.#pending = null;
    }
  }

  track(aggregate: AggregateRoot<string>): void {
    this.#transaction().push(...aggregate.pullEvents());
  }

  record(event: DomainEvent): void {
    this.#transaction().push(event);
  }

  #transaction(): DomainEvent[] {
    if (!this.#pending) throw new Error('Called outside uow.run()');
    return this.#pending;
  }
}
