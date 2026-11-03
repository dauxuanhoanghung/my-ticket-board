# Sequence 19 · SSE connection lifecycle (through the BFF)

> Index: [07 · Sequence flows](../../07-sequence-flows.md) · State: [SSE client connection](../state/15-sse-client-connection.md) · Contract: [09 · API §5](../../09-api-contract.md#5-realtime-sse-contract) · Decision: [ADR-005](../../11-decisions.md#adr-005)

```mermaid
sequenceDiagram
  autonumber
  participant B as Browser (EventSource)
  participant P as Next.js proxy.ts
  participant N as BFF /api/realtime
  participant RT as API realtime gateway
  participant C as Cache
  participant MQ as RabbitMQ

  B->>P: GET /api/realtime?boardId=X (cookies)
  P->>P: refresh the session if needed (sequence 03)
  P->>N: forward
  N->>RT: fetch GET /realtime/stream?boardId=X, Bearer, signal = request.signal
  RT->>RT: verify JWT, sid not revoked
  RT->>C: effective role for (X, user)
  alt cannot view the board
    RT-->>N: 403
    N-->>B: 403 (EventSource fails and does not retry)
  else allowed
    RT->>RT: registry.add(stream, user, session, board X), close timer at token exp
    RT-->>N: 200 text/event-stream
    N-->>B: new Response(upstream.body), no-transform, X-Accel-Buffering no
    RT-->>B: retry 3000 + event ready (serverTime)
    B->>B: background refetch of the board snapshot
    loop every 25 s
      RT-->>B: comment line keep-alive
    end
    MQ->>RT: board.member.removed (this user, board X)
    RT-->>B: event access.revoked, then close
    B->>B: close EventSource, navigate to the workspace page
  end
  Note over B,RT: at token expiry RT closes the stream, EventSource reconnects after 3 s,<br/>proxy.ts refreshes the session, the stream reopens and the client refetches
  B->>N: tab closed or navigation to another board
  N->>RT: abort the upstream fetch
  RT->>RT: registry.remove(stream)
```

## Notes

- **One stream per tab.** It always carries the **user channel** (notifications, own watch changes). It also carries the **board channel** when `boardId` is given. Switching boards closes and reopens the stream.
- HTTP/2 between browser and edge removes the 6-connections-per-origin limit of HTTP/1.1 for multi-tab users.
- BFF route handler: `export const dynamic = 'force-dynamic'`, Node.js runtime, no response caching.
