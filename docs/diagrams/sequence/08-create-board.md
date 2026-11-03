# Sequence 08 · Create board

> Index: [07 · Sequence flows](../../07-sequence-flows.md) · Use case: [UC-BRD-01](../use-case/03-board.md#uc-brd-01--create-board) · State: [Board](../state/06-board.md)

```mermaid
sequenceDiagram
  autonumber
  actor U as User
  participant B as Browser
  participant N as Next.js BFF
  participant A as API (Board)
  participant ACL as WorkspaceMembershipReader
  participant DB as PostgreSQL
  participant C as Cache

  U->>B: Create board (name, background, visibility, template Basic)
  B->>N: Server Action createBoard(form)
  N->>A: mutation createBoard(input)
  A->>ACL: roleOf(workspaceId, userId)
  ACL->>DB: SELECT role FROM workspace_members
  A->>A: BoardPolicy: workspace member AND (creation policy = members OR role = admin)
  A->>DB: BEGIN
  A->>DB: INSERT boards (random 8-char short_id, ticket_seq 0)
  A->>DB: INSERT board_members (creator, admin)
  A->>DB: INSERT 6 default labels (green, yellow, orange, red, purple, blue)
  opt template Basic
    A->>DB: INSERT lists To Do (a0), Doing (a1), Done (a2)
  end
  A->>DB: INSERT activities board.created + outbox board.board.created
  A->>DB: COMMIT
  A->>C: forget viewer cache of the user
  A-->>N: Board (id, shortId, slug)
  N-->>B: redirect /b/shortId/slug
```

## Notes

- `short_id` is random base62 (62⁸ ≈ 2.2 × 10¹⁴). On the rare unique violation, the handler retries with a new id (max 3).
- The Basic template's list names use the creator's locale ([12 §5](../../12-internationalisation.md#5-what-gets-translated)). After that they're ordinary board data.
