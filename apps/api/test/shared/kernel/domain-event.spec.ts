import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  defineEvent,
  type DomainEvent,
  type EventOf,
} from '../../../src/shared/kernel/index.js';

const TicketMoved = defineEvent<{
  ticketId: string;
  toListId: string;
  position: string;
}>()({
  eventType: 'board.ticket.moved',
  eventVersion: 1,
  aggregateType: 'Ticket',
});
type TicketMoved = EventOf<typeof TicketMoved>;

const TicketMovedV2 = defineEvent<{ ticketId: string; toListId: string }>()({
  eventType: 'board.ticket.moved',
  eventVersion: 2,
  aggregateType: 'Ticket',
});

const now = new Date('2026-11-10T09:00:00.000Z');
const payload = { ticketId: 't1', toListId: 'l2', position: 'a0V' };

describe('defineEvent', () => {
  it('exposes the definition and builds events from it', () => {
    expect(TicketMoved.eventType).toBe('board.ticket.moved');

    const event = TicketMoved.create('t1', payload, now);

    expect(event).toEqual({
      eventType: 'board.ticket.moved',
      eventVersion: 1,
      aggregateType: 'Ticket',
      aggregateId: 't1',
      occurredAt: now,
      payload,
    });
    expectTypeOf(event.eventType).toEqualTypeOf<'board.ticket.moved'>();
  });

  it('freezes the event and copies the payload', () => {
    const input = { ...payload };
    const event = TicketMoved.create('t1', input, now);
    input.position = 'changed';

    expect(Object.isFrozen(event)).toBe(true);
    expect(Object.isFrozen(event.payload)).toBe(true);
    expect(event.payload.position).toBe('a0V');
  });

  it('is() narrows on event type and version', () => {
    const events: DomainEvent[] = [
      TicketMoved.create('t1', payload, now),
      TicketMovedV2.create('t1', { ticketId: 't1', toListId: 'l2' }, now),
    ];

    const v1 = events.filter(TicketMoved.is);

    expect(v1).toHaveLength(1);
    expectTypeOf(v1).toEqualTypeOf<TicketMoved[]>();
    expect(v1[0]?.payload.position).toBe('a0V');
  });

  it('only accepts JSON-safe payloads (checked by the compiler)', () => {
    // @ts-expect-error a Date would become a string in jsonb. Use an ISO string instead.
    defineEvent<{ dueAt: Date }>();
    // @ts-expect-error a Map serialises to {}
    defineEvent<{ labels: Map<string, string> }>();
    // @ts-expect-error functions aren't data
    defineEvent<{ callback: () => void }>();

    interface WithInterface {
      ids: readonly string[];
      nested: { at: string; count: number | null };
      optional?: boolean;
    }
    defineEvent<WithInterface>();
  });
});
