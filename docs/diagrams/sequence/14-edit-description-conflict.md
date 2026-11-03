# Sequence 14 · Edit description with conflict detection

> Index: [07 · Sequence flows](../../07-sequence-flows.md) · Use case: [UC-TKT-03](../use-case/04-list-and-ticket.md#uc-tkt-03--edit-title-or-description)

```mermaid
sequenceDiagram
  autonumber
  participant BA as Browser A
  participant BB as Browser B
  participant API as API
  participant DB as PostgreSQL

  Note over BA,BB: both opened ticket T at version 7, A starts editing
  BB->>API: updateTicket(T, description d2, expectedVersion 7)
  API->>DB: UPDATE tickets SET description d2, version 8 WHERE id AND version = 7 (1 row)
  API-->>BB: ok, version 8
  API-->>BA: SSE ticket.updated (version 8, description changed)
  BA->>BA: editor is dirty, keep the draft, show a banner "B changed the description"
  BA->>API: updateTicket(T, description d1, expectedVersion 7)
  API->>DB: UPDATE ... WHERE version = 7 (0 rows)
  API-->>BA: VERSION_CONFLICT (current version 8, current description d2, updatedBy B)
  BA->>BA: conflict dialog: theirs d2 vs mine d1
  alt Keep mine
    BA->>API: updateTicket(T, d1, expectedVersion 8)
    API-->>BA: ok, version 9
  else Use theirs
    BA->>BA: discard the draft, show d2
  else Merge manually
    BA->>BA: diff editor, then save with expectedVersion 8
  end
```

## Notes

- Only **title and description** use `expectedVersion`. Labels, assignees, dates, cover and moves are commutative, last-writer-wins, and retried server-side on version races.
- When the editor is **clean**, an incoming `ticket.updated` just replaces the text. There's no dialog.
