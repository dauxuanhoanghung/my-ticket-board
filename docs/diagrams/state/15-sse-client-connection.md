# State · SSE client connection (`useRealtime` hook)

> Index: [08 · State machines](../../08-state-machines.md) · Sequence: [19](../sequence/19-sse-connection-lifecycle.md) · Architecture: [Realtime fan-out](../architecture/06-realtime-fanout.md)

```mermaid
stateDiagram-v2
  [*] --> Connecting : mount, new EventSource
  Connecting --> Syncing : 200 + event ready
  Connecting --> Reconnecting : network error
  Connecting --> Closed : 401 or 403 (fatal, no retry)
  Syncing --> Live : snapshot refetched, buffered events applied by version
  Syncing --> Reconnecting : stream dropped
  Live --> Live : event applied (version newer) or ignored (older, own echo)
  Live --> Reconnecting : stream closed (token expiry, deploy, network)
  Live --> Closed : access.revoked or session.revoked
  Live --> Closed : unmount or board change
  Reconnecting --> Connecting : after retry delay (3 s, browser-managed)
  Closed --> [*]
```

| State | UI indicator |
|---|---|
| Connecting / Syncing | none (first 2 s), then a subtle "Connecting…" |
| Live | none |
| Reconnecting > 5 s | "Reconnecting… changes may be delayed" banner |
| Closed (revoked) | redirect with an explanation |
