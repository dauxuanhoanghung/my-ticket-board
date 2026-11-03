# State · Workspace membership

> Index: [08 · State machines](../../08-state-machines.md) · Table: `workspace_members` · Class: [Workspace](../class/03-workspace.md)

```mermaid
stateDiagram-v2
  [*] --> Admin : create workspace (creator)
  [*] --> Invited : invitation pending
  Invited --> Member : accept with role member
  Invited --> Admin : accept with role admin
  Member --> Admin : promote
  Admin --> Member : demote [another admin exists]
  Member --> Removed : removed by an admin, or leaves
  Admin --> Removed : removed or leaves [another admin exists]
  Removed --> [*]

  note right of Removed
    row deleted
    removed from all boards of the workspace
    SSE streams for those boards closed
  end note
```

`Invited` lives in the `invitations` table, not in `workspace_members`. It's shown here to give the full lifecycle. **Board membership** follows the same shape with the roles `admin / member / observer` and the guard "another board admin exists".
