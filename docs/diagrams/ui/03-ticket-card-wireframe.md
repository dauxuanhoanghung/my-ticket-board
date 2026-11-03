# UI · Ticket front (card tile) wireframe

> Index: [01 · Trello analysis §4](../../01-trello-analysis.md#4-ui-anatomy)

```text
+--------------------------------------+
| [ cover color or image ]             |  cover (optional, normal or full size)
| [green][red  Bug]                    |  labels (color chips, name when expanded)
| Implement upload API                 |  title
| [eye] [clock Oct 30] [=] [c 2] [a 1] |  badges: watching · due · has description
| [check 2/5]                (AB)(CD)  |          comments · attachments · checklist · assignees
+--------------------------------------+
```

## Badge rules

| Badge | Shown when | Source field (board snapshot) |
|---|---|---|
| Watching (eye) | viewer watches the ticket | `isWatching` |
| Due chip | `dueAt` set | `dueAt`, `dueCompletedAt` → status color ([state: due status](../state/09-ticket-due-status.md)) |
| Description (=) | description not empty | `badges.hasDescription` |
| Comments (c n) | n > 0 | `badges.commentCount` |
| Attachments (a n) | n > 0 | `badges.attachmentCount` |
| Checklist (check x/y) | y > 0. Green when x = y | `badges.checklistDone` / `badges.checklistTotal` |
| Assignees | ≥ 1 | `assigneeIds` → board members |
