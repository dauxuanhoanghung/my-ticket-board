# State · Checklist item

> Index: [08 · State machines](../../08-state-machines.md) · Column: `checklist_items.completed_at` · Class: [Board](../class/04-board.md)

```mermaid
stateDiagram-v2
  [*] --> Incomplete : addChecklistItem
  Incomplete --> Complete : toggle (completed_at, completed_by)
  Complete --> Incomplete : toggle (cleared)
  Incomplete --> Incomplete : edit content, move, assign and set due (P2)
  Incomplete --> ConvertedToTicket : convert to ticket (P2)
  Incomplete --> [*] : delete
  Complete --> [*] : delete
  ConvertedToTicket --> [*] : item removed, new ticket created
```

Each transition emits `board.checklist_item.*`, which updates the `checklist x/y` badge live for every viewer.
