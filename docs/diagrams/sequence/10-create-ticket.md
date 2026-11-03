# Sequence 10 · Create ticket (optimistic, idempotent)

> Index: [07 · Sequence flows](../../07-sequence-flows.md) · Use case: [List and ticket](../use-case/04-list-and-ticket.md) · State: [Ticket](../state/08-ticket.md)

```mermaid
sequenceDiagram
  autonumber
  actor U as User
  participant B as Browser
  participant N as BFF /api/graphql
  participant A as API (Board)
  participant DB as PostgreSQL
  participant C as Cache

  U->>B: Type a title in the composer, press Enter
  B->>B: id = uuidv7(), position = keyBetween(last ticket, null)
  B->>B: optimistic insert into the board cache, composer stays open
  B->>N: mutation createTicket(id, listId, title, prevTicketId = last, clientMutationId)
  N->>A: forward with Bearer + correlation id
  A->>A: BoardPolicy canEditContent
  A->>DB: BEGIN
  A->>DB: SELECT ticket by id (idempotency check)
  alt already exists (client retry after timeout)
    A->>DB: ROLLBACK
    A-->>N: existing ticket
  else new
    A->>DB: SELECT list FOR UPDATE (active, same board)
    A->>DB: resolve neighbours, compute position
    A->>DB: UPDATE boards SET ticket_seq = ticket_seq + 1 RETURNING ticket_seq
    A->>DB: INSERT tickets (number, short_id, position, version 1)
    A->>DB: INSERT ticket_watchers (creator)
    A->>DB: INSERT activities + outbox board.ticket.created
    A->>DB: COMMIT
    A->>C: forget board snapshot
    A-->>N: Ticket (number, shortId, position, version)
  end
  N-->>B: payload
  B->>B: fill in number and shortId, keep the authoritative position
  Note over B: other viewers receive ticket.created via SSE (fan-out as in sequence 11)
```

## Notes

- **Client-generated UUIDv7** makes creates idempotent and removes temp-id swapping in the UI. The server rejects ids that aren't valid v7 or whose timestamp is more than 5 min off.
- Rapid entry (5 tickets in 2 s) works because each create anchors on the previous optimistic ticket's id. The server resolves `prevTicketId` in order, since creates in one list serialise on the list lock.
