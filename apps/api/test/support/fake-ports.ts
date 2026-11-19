import { Clock, IdGenerator } from '../../src/shared/kernel/index.js';

/** A clock that only moves when the test says so. */
export class FixedClock extends Clock {
  #now: Date;

  constructor(now: Date | string = '2026-01-01T00:00:00.000Z') {
    super();
    this.#now = new Date(now);
  }

  now(): Date {
    return new Date(this.#now); // a copy: callers can't move the clock by mutating it
  }

  set(now: Date | string): void {
    this.#now = new Date(now);
  }

  advance(ms: number): void {
    this.#now = new Date(this.#now.getTime() + ms);
  }
}

/**
 * Predictable ids: `00000000-0000-7000-8000-000000000001`, `…002`, …
 * Valid UUIDv7 strings, so code that checks `isUuidV7` accepts them.
 */
export class SequentialIdGenerator extends IdGenerator {
  #next = 1;

  uuidv7(): string {
    const n = (this.#next++).toString(16).padStart(12, '0');
    return `00000000-0000-7000-8000-${n}`;
  }

  shortId(): string {
    return `short${this.#next++}`;
  }
}
