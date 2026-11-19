import { describe, expect, it } from 'vitest';
import { isUuidV7 } from '../../src/shared/kernel/index.js';
import { FixedClock, SequentialIdGenerator } from './fake-ports.js';

describe('FixedClock', () => {
  it('only moves when told to, and hands out copies', () => {
    const clock = new FixedClock('2026-11-11T09:00:00.000Z');
    clock.now().setFullYear(1999);

    expect(clock.now().toISOString()).toBe('2026-11-11T09:00:00.000Z');
    clock.advance(60_000);
    expect(clock.now().toISOString()).toBe('2026-11-11T09:01:00.000Z');
    clock.set('2027-01-01T00:00:00.000Z');
    expect(clock.now().toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });
});

describe('SequentialIdGenerator', () => {
  it('generates predictable, valid UUIDv7 strings', () => {
    const ids = new SequentialIdGenerator();
    const [a, b] = [ids.uuidv7(), ids.uuidv7()];

    expect(a).toBe('00000000-0000-7000-8000-000000000001');
    expect(b).toBe('00000000-0000-7000-8000-000000000002');
    expect(isUuidV7(a) && isUuidV7(b)).toBe(true);
  });
});
