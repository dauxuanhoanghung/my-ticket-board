import { describe, expect, it } from 'vitest';
// Counter is a minimal aggregate showing the create / rehydrate pattern every real one follows.
import { Counter, type CounterId } from '../../support/fixtures/counter.js';

const id = '0192f5a3-0000-7000-8000-000000000001' as CounterId;
const now = new Date('2026-11-10T09:00:00.000Z');

describe('AggregateRoot', () => {
  describe('create', () => {
    it('starts new at version 0 and raises the created event', () => {
      const counter = Counter.create(id, now);

      expect(counter.version).toBe(0);
      expect(counter.isNew).toBe(true);
      expect(counter.nextVersion).toBe(1);
      expect(counter.pullEvents()).toEqual([
        {
          eventType: 'test.counter.created',
          eventVersion: 1,
          aggregateType: 'Counter',
          aggregateId: id,
          occurredAt: now,
          payload: { counterId: id },
        },
      ]);
    });
  });

  describe('rehydrate', () => {
    it('keeps the stored version and raises nothing', () => {
      const counter = Counter.rehydrate({ id, version: 7, value: 3 });

      expect(counter.version).toBe(7);
      expect(counter.isNew).toBe(false);
      expect(counter.value).toBe(3);
      expect(counter.hasPendingEvents).toBe(false);
      expect(counter.pullEvents()).toEqual([]);
    });

    it.each([-1, 1.5, Number.NaN])('rejects version %s', (version) => {
      expect(() => Counter.rehydrate({ id, version, value: 0 })).toThrow(
        RangeError,
      );
    });
  });

  describe('pullEvents', () => {
    it('returns events in the order they were raised, then clears them', () => {
      const counter = Counter.rehydrate({ id, version: 1, value: 0 });
      counter.increment(now);
      counter.increment(now);

      expect(counter.hasPendingEvents).toBe(true);
      expect(
        counter.pullEvents().map((e) => (e.payload as { value: number }).value),
      ).toEqual([1, 2]);
      expect(counter.hasPendingEvents).toBe(false);
      expect(counter.pullEvents()).toEqual([]);
    });
  });

  describe('markPersisted', () => {
    it('bumps the version once per save, however many events were raised', () => {
      const counter = Counter.create(id, now);
      counter.increment(now);
      counter.increment(now);

      counter.markPersisted();
      expect(counter.version).toBe(1);
      expect(counter.isNew).toBe(false);

      counter.increment(now);
      counter.markPersisted();
      expect(counter.version).toBe(2);
    });
  });

  it('refuses an event that targets another aggregate', () => {
    const counter = Counter.create(id, now);
    expect(() => counter.raiseForeignEvent(now)).toThrow(
      /targets aggregate another-counter/,
    );
  });
});
