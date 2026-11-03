# Sequence 11 · Move ticket (drag and drop) with realtime fan-out

> Index: [07 · Sequence flows](../../07-sequence-flows.md) · Use case: [UC-TKT-04](../use-case/04-list-and-ticket.md#uc-tkt-04--move-ticket-drag-and-drop) · Activity: [Position resolution](../activity/04-move-ticket-position.md) · States: [Drag UI](../state/14-ticket-drag-ui.md), [SSE client](../state/15-sse-client-connection.md) · Architecture: [Realtime fan-out](../architecture/06-realtime-fanout.md)

This is the most important flow in the product.

```mermaid
sequenceDiagram
  autonumber
  actor U1 as User A
  participant B1 as Browser A
  participant N1 as BFF (web 1)
  participant A1 as API 1
  participant C as Cache
  participant DB as PostgreSQL
  participant R as Outbox relay (worker)
  participant MQ as RabbitMQ
  participant A2 as API 2 (realtime gateway)
  participant N2 as BFF (web 2)
  participant B2 as Browser B

  U1->>B1: Drop ticket T between P and N in list L2
  B1->>B1: pos = keyBetween(P.pos, N.pos), apply optimistically, new clientMutationId
  B1->>N1: POST /api/graphql moveTicket(T, L2, prev P, next N, cmid)
  N1->>A1: forward with Authorization Bearer, x-correlation-id
  A1->>A1: JwtAuthGuard, then MoveTicketHandler
  A1->>C: get effective role (board, user)
  A1->>A1: BoardPolicy canEditContent
  rect rgba(120, 160, 255, 0.12)
    Note over A1,DB: one transaction
    A1->>DB: BEGIN
    A1->>DB: SELECT lists WHERE id IN (L1, L2) ORDER BY id FOR UPDATE
    A1->>DB: SELECT T FOR UPDATE, read the real successor of P in L2
    A1->>A1: Position.between(lower, upper), ticket.moveTo(L2, pos) raises TicketMoved
    A1->>DB: UPDATE tickets SET list_id, position, version = v+1 WHERE id AND version = v
    A1->>DB: INSERT activities (ticket.moved with from/to list names)
    A1->>DB: INSERT outbox_events (board.ticket.moved, metadata cmid and boardId)
    A1->>DB: COMMIT (outbox trigger queues pg_notify)
  end
  A1->>C: forget board snapshot
  A1-->>N1: MoveTicketPayload (listId, position, version)
  N1-->>B1: 200
  B1->>B1: reconcile to the server position and version, mark cmid confirmed
  DB-->>R: NOTIFY outbox_new
  R->>DB: SELECT pending ORDER BY id LIMIT 200 FOR UPDATE SKIP LOCKED
  R->>MQ: publish tb.events, routing key board.ticket.moved (publisher confirm)
  MQ-->>R: confirm
  R->>DB: UPDATE outbox_events SET published_at
  par fan-out to every API instance
    MQ->>A1: queue tb.realtime.api-1
    A1->>A1: project to client event ticket.moved, look up streams of the board
    A1-->>B1: SSE ticket.moved (cmid matches, ignored)
  and
    MQ->>A2: queue tb.realtime.api-2
    A2->>A2: project, look up streams of the board
    A2-->>N2: SSE id, event ticket.moved, data
    N2-->>B2: piped
    B2->>B2: event version newer than cached? apply move and re-sort the list
  end
```

## Failure branches

| Failure | Behaviour |
|---|---|
| `FORBIDDEN` / `TARGET_LIST_UNAVAILABLE` | Client rolls back the optimistic move and shows a toast. `TARGET_LIST_UNAVAILABLE` also refetches the board |
| `ConcurrencyError` on the ticket row | Handler retries up to 3 times (moves are last-writer-wins on placement) |
| Network error / timeout | Client rolls back. A retry with the same `clientMutationId` is safe |
| Relay or RabbitMQ down | Mutation still succeeds. Other viewers see the change late, once the outbox drains. Clients reconnecting refetch anyway |
| Browser B missed events (sleep, network) | EventSource reconnects → refetch snapshot ([Sequence 19](./19-sse-connection-lifecycle.md)) |

## Latency budget (target p95 < 500 ms A→B)

| Hop | Budget |
|---|---|
| API transaction | 30 ms |
| Commit → NOTIFY → relay publish + confirm | 20 ms |
| RabbitMQ → API instance | 5 ms |
| SSE through BFF → browser | 20 ms + network |
