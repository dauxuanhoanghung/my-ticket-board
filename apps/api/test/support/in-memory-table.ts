import { ConcurrencyError } from '../../src/shared/kernel/index.js';
import type {
  InMemoryUnitOfWork,
  Rollbackable,
} from './in-memory-unit-of-work.js';

type Row = { readonly id: string; readonly version: number };

/**
 * A pretend database table for in-memory repositories.
 *
 * - Rows are copied in and out, so a test can't change saved data by accident.
 * - `save` checks the version, like `UPDATE … WHERE version = :expected`.
 * - Rolls back with the `InMemoryUnitOfWork` given to the constructor.
 */
export class InMemoryTable<TRow extends Row> implements Rollbackable {
  #rows = new Map<string, TRow>();

  constructor(uow?: InMemoryUnitOfWork) {
    uow?.register(this);
  }

  get(id: string): TRow | undefined {
    const row = this.#rows.get(id);
    return row && structuredClone(row);
  }

  find(predicate: (row: TRow) => boolean): TRow | undefined {
    const row = [...this.#rows.values()].find(predicate);
    return row && structuredClone(row);
  }

  /**
   * Inserts (when `expectedVersion` is 0) or updates the row, but only if the
   * stored row is still at `expectedVersion`. Otherwise someone else saved
   * first, so it throws `ConcurrencyError`.
   */
  save(row: TRow, expectedVersion: number, aggregateType: string): void {
    const storedVersion = this.#rows.get(row.id)?.version ?? 0;
    if (storedVersion !== expectedVersion) {
      throw new ConcurrencyError(
        aggregateType,
        row.id,
        expectedVersion,
        storedVersion,
      );
    }
    this.#rows.set(row.id, structuredClone(row));
  }

  snapshot(): unknown {
    return new Map(this.#rows);
  }

  restore(snapshot: unknown): void {
    this.#rows = snapshot as Map<string, TRow>;
  }
}
