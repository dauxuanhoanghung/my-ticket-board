// A tiny aggregate and repository for testing the shared code. It follows the
// same pattern a real context will, so you can copy it for `User`.
import {
  AggregateRoot,
  defineEvent,
} from '../../../src/shared/kernel/index.js';
import { InMemoryTable } from '../in-memory-table.js';
import type { InMemoryUnitOfWork } from '../in-memory-unit-of-work.js';

// ---- domain -----------------------------------------------------------------

export type CounterId = string;

export const CounterCreated = defineEvent<{ counterId: string }>()({
  eventType: 'test.counter.created',
  eventVersion: 1,
  aggregateType: 'Counter',
});

export const CounterIncremented = defineEvent<{
  counterId: string;
  value: number;
}>()({
  eventType: 'test.counter.incremented',
  eventVersion: 1,
  aggregateType: 'Counter',
});

export class Counter extends AggregateRoot<CounterId> {
  private constructor(
    id: CounterId,
    version: number,
    private count: number,
  ) {
    super(id, version);
  }

  /** New counter: version 0, raises `created`. */
  static create(id: CounterId, now: Date): Counter {
    const counter = new Counter(id, 0, 0);
    counter.raise(CounterCreated.create(id, { counterId: id }, now));
    return counter;
  }

  /** Loaded from storage: keeps its version, raises nothing. */
  static rehydrate(state: {
    id: CounterId;
    version: number;
    value: number;
  }): Counter {
    return new Counter(state.id, state.version, state.value);
  }

  get value(): number {
    return this.count;
  }

  increment(now: Date): void {
    this.count += 1;
    this.raise(
      CounterIncremented.create(
        this.id,
        { counterId: this.id, value: this.count },
        now,
      ),
    );
  }

  /** A deliberate bug for tests: raises an event about another aggregate. */
  raiseForeignEvent(now: Date): void {
    const other = 'another-counter' as CounterId;
    this.raise(
      CounterIncremented.create(other, { counterId: other, value: 0 }, now),
    );
  }
}

/** The repository port. A real context declares this in `domain/repositories/`. */
export abstract class CounterRepository {
  abstract findById(id: CounterId): Promise<Counter | null>;
  abstract save(counter: Counter): Promise<void>;
}

// ---- infrastructure (in memory) ---------------------------------------------

type CounterRow = { id: string; version: number; value: number };

export class InMemoryCounterRepository extends CounterRepository {
  readonly table: InMemoryTable<CounterRow>;

  constructor(private readonly uow: InMemoryUnitOfWork) {
    super();
    this.table = new InMemoryTable(uow);
  }

  findById(id: CounterId): Promise<Counter | null> {
    const row = this.table.get(id);
    const counter = row
      ? Counter.rehydrate({ ...row, id: row.id as CounterId })
      : null;
    return Promise.resolve(counter);
  }

  /** Every repository's save does these three steps. */
  save(counter: Counter): Promise<void> {
    // 1. Write, checking nobody saved a newer version meanwhile.
    const row = {
      id: counter.id,
      version: counter.nextVersion,
      value: counter.value,
    };
    this.table.save(row, counter.version, 'Counter');
    // 2. The write worked, so the aggregate is now at the new version.
    counter.markPersisted();
    // 3. Give its events to the transaction.
    this.uow.track(counter);
    return Promise.resolve();
  }
}
