# Activity · Move ticket: server-side position resolution

> Index: [03 · Use cases](../../03-use-cases.md) · Use case: [UC-TKT-04](../use-case/04-list-and-ticket.md#uc-tkt-04--move-ticket-drag-and-drop) · Sequences: [11](../sequence/11-move-ticket-realtime.md), [12](../sequence/12-concurrent-moves.md) · Ordering: [06 · Database §4](../../06-database.md#4-ordering-fractional-indexing)

```mermaid
flowchart TD
  S((start)) --> A["Lock source and target list rows<br/>ORDER BY id FOR UPDATE"]
  A --> B{"Target list active and on a board the actor can edit?"}
  B -- no --> E1["TARGET_LIST_UNAVAILABLE / FORBIDDEN"]
  B -- yes --> C{"prevTicketId given AND still active in target list?"}
  C -- yes --> D["lower = prev.position<br/>upper = first position after prev"]
  C -- no --> F{"nextTicketId given AND still active in target list?"}
  F -- yes --> G["upper = next.position<br/>lower = last position before next"]
  F -- no --> H["lower = last position in list<br/>upper = null (append)"]
  D --> K["key = keyBetween(lower, upper)"]
  G --> K
  H --> K
  K --> L{"Is the ticket moving to a different board?"}
  L -- yes --> M["Cross-board path: renumber,<br/>remap labels, drop non-member assignees"] --> N
  L -- no --> N["UPDATE ticket SET list_id, position, version+1"]
  N --> O["INSERT activity + outbox event"] --> P["COMMIT"] --> Z((end))
```

## Why the server re-resolves neighbours

The client's `prevTicketId`/`nextTicketId` reflect what **it** saw. Another user may have dropped a ticket into the same gap a moment earlier. Locking the list rows serialises writers per list. Re-reading the actual successor of `prev` then guarantees `lower < key < upper` with **no duplicate keys**, even when two users target the same slot ([Sequence 12](../sequence/12-concurrent-moves.md)).

Locks are always taken in `id` order (source and target list) to avoid deadlocks between opposite cross-list moves.
