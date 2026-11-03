# State · List

> Index: [08 · State machines](../../08-state-machines.md) · Column: `lists.archived_at` · Class: [Board](../class/04-board.md)

```mermaid
stateDiagram-v2
  [*] --> Active : createList
  Active --> Active : rename, move (new position), setWipLimit
  Active --> Active : transfer to another board (P2, tickets follow)
  Active --> Archived : archive
  Archived --> Active : restore (old key kept, recomputed on collision)
  Active --> Deleted : board deleted (cascade)
  Archived --> Deleted : board deleted (cascade)
  Deleted --> [*]

  note right of Archived
    tickets inside stay as they are
    and are hidden with the list
  end note
```

Lists are never deleted on their own, only archived, the same as in Trello.
