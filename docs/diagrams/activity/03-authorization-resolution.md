# Activity · Authorization resolution (effective board role)

> Index: [03 · Use cases](../../03-use-cases.md) · Permission matrix: [02 §3](../../02-product-scope.md#3-permission-matrix-mvp) · Cache: [Sequence 21](../sequence/21-cache-aside-and-invalidation.md)

The API runs this before every board-scoped command or query. The result is cached as `perm:board:{boardId}:user:{userId}` for 60 s and invalidated on membership and visibility events.

```mermaid
flowchart TD
  S((start)) --> B{"Authenticated?"}
  B -- no --> UA["UNAUTHENTICATED"]
  B -- yes --> A{"Board exists and not deleted?"}
  A -- no --> NF["NOT_FOUND"]
  A -- yes --> D{"Row in board_members?"}
  D -- yes --> R1["role = board_members.role"]
  D -- no --> E{"visibility = workspace AND user is workspace member?"}
  E -- yes --> R2["role = WORKSPACE_VIEWER<br/>(can self-join if policy allows)"]
  E -- no --> NF2["NOT_FOUND (don't leak existence)"]
  R1 --> H{"Board archived?"}
  H -- yes --> I["Read-only except reopen/delete by ADMIN"] --> G["Apply policy matrix for the requested action"]
  H -- no --> G
  R2 --> G
  G --> J{"Allowed?"}
  J -- yes --> OK["proceed"]
  J -- no --> FB["FORBIDDEN"]
```

## Effective roles

| Effective role | Source | Capabilities |
|---|---|---|
| `ADMIN` | `board_members.role` | everything on the board |
| `MEMBER` | `board_members.role` | edit content. Invite only if policy = members |
| `OBSERVER` | `board_members.role` | read. Comment if policy allows |
| `WORKSPACE_VIEWER` | workspace membership + visibility = workspace | read. Comment if policy = workspace. Self-join if enabled |

Every board needs a signed-in user. Public boards aren't in the MVP ([ADR-022](../../11-decisions.md#adr-022)).
