# UI · Board view wireframe

> Index: [01 · Trello analysis §4](../../01-trello-analysis.md#4-ui-anatomy) · Components: [05-component-tree](./05-component-tree.md)

```text
+--------------------------------------------------------------------------------------+
| AppHeader: [Workspaces v] [Recent v] [Starred v] [+ Create]   [Search..] [Bell] [AB] |
+--------------------------------------------------------------------------------------+
| BoardHeader: Sprint Board (edit)  [*]  [Workspace v]        (AB)(CD)(EF)+2 [Share]   |
|                                                               [Filter] [... menu]    |
+--------------------------------------------------------------------------------------+
|  +----------------+  +----------------+  +----------------+  +----------------+      |
|  | To Do      ... |  | Doing  3/5 ... |  | Done       ... |  | + Add a list   |      |
|  | +------------+ |  | +------------+ |  | +------------+ |  +----------------+      |
|  | | [==][==]   | |  | | [  cover ] | |  | | Ship v1    | |                          |
|  | | Login page | |  | | Upload API | |  | | [done Oct1]| |                          |
|  | | [Oct 30]   | |  | | [c2][a1]   | |  | +------------+ |                          |
|  | | [2/5] (AB) | |  | | (CD)(EF)   | |  |                |                          |
|  | +------------+ |  | +------------+ |  | + Add a ticket |                          |
|  | + Add a ticket |  | + Add a ticket |  +----------------+                          |
|  +----------------+  +----------------+                                              |
+--------------------------------------------------------------------------------------+
   lists scroll horizontally · tickets scroll vertically inside a list · drag both
```

## Regions

| Region | Component | Data source |
|---|---|---|
| App header | `AppHeader` | `viewer` query (workspaces, starred, unread count) + user SSE channel |
| Board header | `BoardHeader` | board snapshot: name, visibility, members, `isStarred`, `myRole` |
| Canvas | `BoardCanvas` → `ListColumn` → `TicketCard` | board snapshot, kept live by the board SSE channel |
| `3/5` in list header | WIP indicator (P2) | `list.wipLimit` vs open ticket count |
