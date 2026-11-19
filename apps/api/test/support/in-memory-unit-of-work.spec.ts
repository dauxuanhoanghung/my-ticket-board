import { beforeEach, describe, expect, it } from 'vitest';
import { ConcurrencyError } from '../../src/shared/kernel/index.js';
import {
  Counter,
  CounterCreated,
  InMemoryCounterRepository,
  type CounterId,
} from './fixtures/counter.js';
import { InMemoryUnitOfWork } from './in-memory-unit-of-work.js';

const id = 'c1' as CounterId;
const now = new Date('2026-11-16T09:00:00.000Z');

describe('InMemoryUnitOfWork', () => {
  let uow: InMemoryUnitOfWork;
  let counters: InMemoryCounterRepository;

  beforeEach(() => {
    uow = new InMemoryUnitOfWork();
    counters = new InMemoryCounterRepository(uow);
  });

  const eventTypes = () => uow.committed.map((e) => e.eventType);

  it('commits the saved aggregate and its events', async () => {
    await uow.run(() => counters.save(Counter.create(id, now)));

    expect(await counters.findById(id)).not.toBeNull();
    expect(eventTypes()).toEqual(['test.counter.created']);
  });

  it('commits recorded events in the order they happened', async () => {
    await uow.run(async () => {
      uow.record(CounterCreated.create('other', { counterId: 'other' }, now));
      await counters.save(Counter.create(id, now));
    });

    expect(uow.committed.map((e) => e.aggregateId)).toEqual(['other', id]);
  });

  it('rolls back the data and the events when the work throws', async () => {
    await expect(
      uow.run(async () => {
        await counters.save(Counter.create(id, now));
        throw new Error('something failed');
      }),
    ).rejects.toThrow('something failed');

    expect(await counters.findById(id)).toBeNull();
    expect(uow.committed).toEqual([]);
  });

  it('a run inside a run is part of the same transaction', async () => {
    await expect(
      uow.run(async () => {
        await uow.run(() => counters.save(Counter.create(id, now)));
        throw new Error('outer failed');
      }),
    ).rejects.toThrow('outer failed');

    expect(await counters.findById(id)).toBeNull();
  });

  it('track and record only work inside run()', () => {
    const counter = Counter.create(id, now);
    expect(() => uow.track(counter)).toThrow('outside uow.run()');
  });

  it('a save from an old version loses (optimistic concurrency)', async () => {
    await uow.run(() => counters.save(Counter.create(id, now)));
    const first = (await counters.findById(id))!;
    const second = (await counters.findById(id))!;

    first.increment(now);
    await uow.run(() => counters.save(first));

    second.increment(now);
    await expect(uow.run(() => counters.save(second))).rejects.toBeInstanceOf(
      ConcurrencyError,
    );
    expect((await counters.findById(id))?.value).toBe(1);
  });
});
