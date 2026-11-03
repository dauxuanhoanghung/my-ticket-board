# State · Outbox event

> Index: [08 · State machines](../../08-state-machines.md) · Table: `outbox_events` · Sequence: [18](../sequence/18-outbox-relay-and-consumers.md)

```mermaid
stateDiagram-v2
  [*] --> Pending : INSERT inside the command transaction
  Pending --> Claimed : relay SELECT FOR UPDATE SKIP LOCKED
  Claimed --> Published : broker confirms, published_at set
  Claimed --> Backoff : publish failed (attempts + 1, available_at = now + backoff)
  Backoff --> Pending : available_at reached
  Published --> Purged : 7 days later
  Purged --> [*]

  note right of Backoff
    backoff 1 s, 2 s, 4 s ... capped at 60 s
    alert when attempts exceed 10
  end note
```

`Claimed` exists only inside the relay's transaction. A relay crash rolls it back to `Pending`, and the event is published again (consumers are idempotent).
