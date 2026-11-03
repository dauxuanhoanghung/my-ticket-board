# State · Ticket

> Index: [08 · State machines](../../08-state-machines.md) · Column: `tickets.archived_at` · Class: [Board](../class/04-board.md) · Sequences: [10](../sequence/10-create-ticket.md), [11](../sequence/11-move-ticket-realtime.md), [13](../sequence/13-move-ticket-across-boards.md)

```mermaid
stateDiagram-v2
  [*] --> Active : createTicket
  state Active {
    [*] --> InList
    InList --> InList : moveTicket within the board
    InList --> InList : edit, label, assign, dates, cover, checklist
    InList --> InList : transfer to another board (new number)
  }
  Active --> Archived : archive
  Archived --> Active : restore (back to its list, or first active list)
  Archived --> Deleted : delete (admin or member)
  Active --> Deleted : board deleted (cascade)
  Deleted --> [*] : worker removes attachment objects

  note right of Archived
    hidden from the board
    shown in "Archived items"
    keeps comments, attachments, history
  end note
```

- Restoring a ticket whose list is archived → it goes to the first active list, at the bottom.
- Delete requires the ticket to be archived first (UI rule, mirrors Trello). Bulk cascades skip that rule.
