# Sequence 04 · Log out and session revocation

> Index: [07 · Sequence flows](../../07-sequence-flows.md) · State: [Session](../state/02-session.md)

```mermaid
sequenceDiagram
  autonumber
  participant B as Browser (tab 1)
  participant B2 as Browser (tab 2, SSE open)
  participant N as Next.js BFF
  participant A as API
  participant C as Cache
  participant DB as PostgreSQL
  participant MQ as RabbitMQ
  participant RT as API realtime gateway

  B->>N: Server Action logout()
  N->>A: mutation logout (Bearer with sid claim)
  A->>DB: UPDATE sessions SET revoked_at, reason logout + outbox identity.session.revoked
  A->>C: set revoked-sid marker (TTL 15 min = access token lifetime)
  A-->>N: ok
  N-->>B: clear tb_at and tb_rt, redirect /login
  Note over A,MQ: the relay publishes identity.session.revoked
  MQ->>RT: identity.session.revoked (sessionId)
  RT->>RT: find streams opened with this sessionId
  RT-->>N: SSE event session.revoked, then close
  N-->>B2: event session.revoked
  B2->>B2: close EventSource, redirect /login
  Note over A,C: JwtAuthGuard checks the revoked-sid marker on every request,<br/>so already-issued access tokens stop working immediately
```

## Notes

- The revoked-sid marker in the cache is what makes revocation immediate. Without it, a stolen access token would live up to 15 min.
- If the cache is down (fail-open), revocation falls back to "at most 15 min". That's an accepted trade-off.
- "Log out of all devices" (P2) revokes every session of the user with the same mechanism.
