# Use case · Board management

> Index: [03 · Use cases](../../03-use-cases.md) · Features: BRD-01…18 · Context: Board

```mermaid
flowchart LR
  wmember["👤 Workspace Member"]
  badmin["👤 Board Admin"]
  bmember["👤 Board Member"]
  bobs["👤 Board Observer"]

  subgraph SYS["Ticket Board · Board"]
    direction TB
    B01(["BRD-01 Create board"])
    B01t(["Apply Basic template"])
    B02(["BRD-02 Rename / describe board"])
    B03(["BRD-03 Change visibility"])
    B04(["BRD-04 Change background"])
    B05(["BRD-05 Star board"])
    B06a(["BRD-06 Add / invite board member"])
    B06b(["BRD-06 Change member role"])
    B06c(["BRD-06 Remove member"])
    B06d(["Leave board"])
    B07(["BRD-07 Set board policies"])
    B08(["BRD-08 Manage labels"])
    B09(["BRD-09 Archive / reopen board"])
    B10(["BRD-10 Delete board"])
    B11(["BRD-11 View activity"])
    B12(["BRD-12 Restore archived items"])
    BVIEW(["View board (live)"])
    BJOIN(["Self-join board"])
    BGUARD(["Ensure at least one board admin"])
  end

  wmember --- B01
  wmember --- BJOIN
  wmember --- BVIEW
  badmin --- B03
  badmin --- B06b
  badmin --- B06c
  badmin --- B07
  badmin --- B09
  badmin --- B10
  bmember --- B02
  bmember --- B04
  bmember --- B06a
  bmember --- B08
  bmember --- B12
  bmember --- B06d
  bobs --- BVIEW
  bobs --- B05
  bobs --- B11
  B01t -. "«extend»" .-> B01
  B06b -. "«include»" .-> BGUARD
  B06c -. "«include»" .-> BGUARD
  B06d -. "«include»" .-> BGUARD
  B10 -. "«include» must be archived" .-> B09

  classDef actor fill:transparent,stroke:transparent,font-weight:bold
  class wmember,badmin,bmember,bobs actor
```

> Board Admin inherits every Board Member use case, and Board Member inherits every Observer use case (see [00-actors](./00-actors.md)). `B06a` is subject to the board's invite policy, `BJOIN` to its self-join policy, `B01` to the workspace's board-creation policy.

---

## UC-BRD-01 · Create board

| | |
|---|---|
| **Actor** | Workspace Member (subject to the workspace board-creation policy) |
| **Main flow** | 1. User enters a name, picks a background, visibility (default `workspace`) and optional "Basic" template. 2. API creates the board with a `short_id` and the 6 default unnamed labels (green, yellow, orange, red, purple, blue). The creator becomes `ADMIN`. 3. If the template was chosen, it creates the lists To Do / Doing / Done. 4. Redirect to `/b/:shortId/:slug`. |
| **Related** | [Sequence 08](../sequence/08-create-board.md) · [State: Board](../state/06-board.md) |

## UC-BRD-09/10 · Archive and delete board

| | |
|---|---|
| **Actor** | Board Admin |
| **Rules** | Archiving makes the board read-only for everyone (including admins, except for reopen/delete) and hides it from lists. Only archived boards can be deleted. Deletion is permanent: it cascades lists, tickets, comments and attachment rows, and the worker deletes the objects from storage asynchronously. |
| **Realtime** | Viewers receive `board.archived` (UI switches to read-only banner) or `board.deleted` (redirect to workspace). |
