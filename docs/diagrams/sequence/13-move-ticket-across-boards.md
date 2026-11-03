# Sequence 13 · Move ticket to another board

> Index: [07 · Sequence flows](../../07-sequence-flows.md) · Use case: [UC-TKT-05](../use-case/04-list-and-ticket.md#uc-tkt-05--move-ticket-to-another-board) · Class: [TicketTransferService](../class/04-board.md)

```mermaid
sequenceDiagram
  autonumber
  actor U as User
  participant B as Browser
  participant N as BFF
  participant A as API (Board)
  participant TS as TicketTransferService
  participant DB as PostgreSQL
  participant MQ as RabbitMQ
  participant VX as Board X viewers
  participant VY as Board Y viewers

  U->>B: Move popover: board Y, list L9, position 2
  B->>N: mutation moveTicket(T, toListId L9, prev, next, cmid)
  N->>A: forward
  A->>DB: load source board X and target board Y (members, labels)
  A->>A: policy: actor can edit content on X AND on Y
  A->>DB: BEGIN
  A->>DB: lock lists (source list, L9) ORDER BY id FOR UPDATE
  A->>TS: plan(ticket, X, Y)
  TS-->>A: labelMap (match name + color, create missing), assignees to keep, watchers to keep
  A->>DB: INSERT missing labels on Y
  A->>DB: UPDATE boards Y SET ticket_seq + 1 RETURNING new number
  A->>DB: UPDATE tickets SET board_id Y, list_id L9, number, position, version + 1
  A->>DB: rewrite ticket_labels via labelMap, drop non-member assignees and item assignees
  A->>DB: UPDATE comments, attachments, activities SET board_id Y WHERE ticket_id = T
  A->>DB: DELETE watchers who can't view Y
  A->>DB: INSERT activities on X (transferred out) and on Y (transferred in)
  A->>DB: INSERT outbox board.ticket.transferred
  A->>DB: COMMIT (deferred unique check on board_id, number passes)
  A-->>N: Ticket with its new number
  N-->>B: remove from the current board, toast "Moved to Y"
  MQ->>VX: ticket.removed (via realtime gateways)
  MQ->>VY: ticket.created with the full ticket card
```

## Notes

- The ticket's **short link stays the same**, so old links keep working. Its **number** changes (#42 on X → #7 on Y), as in Trello.
- Moving a whole list to another board (P2) is the same procedure applied to every ticket of the list in one transaction, batched.
