# Sequence 12 · Concurrent moves into the same slot

> Index: [07 · Sequence flows](../../07-sequence-flows.md) · Activity: [Position resolution](../activity/04-move-ticket-position.md) · Ordering: [06 · Database §4](../../06-database.md#4-ordering-fractional-indexing)

```mermaid
sequenceDiagram
  autonumber
  participant BA as Browser A
  participant BB as Browser B
  participant API as API
  participant DB as PostgreSQL

  Note over BA,BB: both see list L2 = [P a0, N a1] and drop a ticket between P and N
  BA->>BA: optimistic X at keyBetween(a0, a1) = a0V
  BB->>BB: optimistic Y at keyBetween(a0, a1) = a0V
  par
    BA->>API: moveTicket(X, L2, prev P, next N)
  and
    BB->>API: moveTicket(Y, L2, prev P, next N)
  end
  API->>DB: tx A: SELECT L2 FOR UPDATE (granted)
  API->>DB: tx B: SELECT L2 FOR UPDATE (waits)
  API->>DB: tx A: successor of P is N (a1), X = a0V, COMMIT
  DB-->>API: tx B: lock granted
  API->>DB: tx B: successor of P is now X (a0V), Y = keyBetween(a0, a0V) ≈ a0F, COMMIT
  API-->>BA: X at a0V
  API-->>BB: Y at a0F
  API-->>BA: SSE ticket.moved Y at a0F, A re-sorts to P, Y, X, N
  API-->>BB: SSE ticket.moved X at a0V, B re-sorts to P, Y, X, N
  Note over BA,BB: everyone converges on P, Y, X, N with no duplicate keys
```

## Why it can't produce duplicates

1. The **list row lock** serialises writers per list.
2. The server **ignores the client's `next`** when `prev` is still valid and uses `prev`'s *actual* successor. It honours the user's intent ("right after P") instead of a stale snapshot.
3. The partial unique index `(list_id, position) WHERE archived_at IS NULL` is a last line of defence. A violation would surface as a 500 and alert, never as silent corruption.
