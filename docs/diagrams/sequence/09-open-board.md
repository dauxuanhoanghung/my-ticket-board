# Sequence 09 · Open board (SSR snapshot, cache-aside, realtime subscribe)

> Index: [07 · Sequence flows](../../07-sequence-flows.md) · Query: [06 · Database §6](../../06-database.md#6-key-queries) · Cache: [Sequence 21](./21-cache-aside-and-invalidation.md) · Realtime: [Sequence 19](./19-sse-connection-lifecycle.md)

```mermaid
sequenceDiagram
  autonumber
  participant B as Browser
  participant N as Next.js (RSC page)
  participant A as API
  participant C as Cache
  participant DB as PostgreSQL
  participant RT as API realtime gateway
  participant MQ as RabbitMQ

  B->>N: GET /b/Ab12Cd34/sprint-board
  N->>A: query BoardPage(shortId) with Bearer
  A->>C: get effective role (board, user)
  alt cache miss
    A->>DB: resolve role (board_members, workspace_members, visibility)
    A->>C: set effective role (60 s)
  end
  A->>A: BoardPolicy canView
  A->>C: get board snapshot
  alt cache miss
    A->>DB: lists, tickets with badges, labels, members
    A->>C: set board snapshot (60 s)
  end
  A->>DB: viewer overlay (myRole, isStarred, watched ticket ids)
  A-->>N: snapshot + overlay
  N-->>B: streamed HTML + RSC payload, dehydrated query state
  B->>B: hydrate TanStack Query key board/boardId
  B->>N: EventSource /api/realtime?boardId=...
  N->>RT: GET /realtime/stream?boardId=... (Bearer)
  RT->>RT: verify JWT, check canView, register stream (user, session, board)
  RT-->>B: 200 text/event-stream, retry 3000, event ready
  B->>B: background refetch of the snapshot (closes the gap between SSR and subscribe)
  loop every 25 s
    RT-->>B: comment line keep-alive
  end
  MQ->>RT: board events
  RT-->>B: ticket.moved, list.created, comment.created ...
```

## Notes

- **Subscribe, then refetch.** The SSR snapshot was read *before* the stream existed, so events in between could be missed. After `ready`, the client refetches once. Events and refetch are both idempotent thanks to entity `version`s.
- The snapshot is **shared by all viewers** (cached per board). Per-viewer bits (`myRole`, `isStarred`, watched ids) are a separate small query that's never cached with it.
- The ticket modal (`/c/:shortId`) loads `ticket(shortId)` separately: description, checklists, attachments, first page of the timeline.
