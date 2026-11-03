# Architecture · Realtime fan-out (RabbitMQ → API instances → SSE)

> Index: [04 · Architecture §4.6](../../04-architecture.md#46-realtime-design-summary) · Sequences: [11](../sequence/11-move-ticket-realtime.md), [19](../sequence/19-sse-connection-lifecycle.md) · Client state: [15](../state/15-sse-client-connection.md) · Scale path: [12](./12-realtime-scale-path.md)

```mermaid
flowchart LR
  subgraph API1["api instance 1"]
    reg1["ConnectionRegistry<br/>boardId → streams<br/>userId → streams"]
    q1["consumer: tb.realtime.api-1"]
  end
  subgraph API2["api instance 2"]
    reg2["ConnectionRegistry"]
    q2["consumer: tb.realtime.api-2"]
  end
  relay["worker: outbox relay"] --> ex{{"tb.events (topic)"}}
  ex -- "board.# collab.# storage.#<br/>notification.# workspace.member.#" --> q1
  ex -- "same bindings" --> q2
  q1 --> reg1 --> s1["SSE streams → BFF → browsers"]
  q2 --> reg2 --> s2["SSE streams → BFF → browsers"]
```

## Notes

- Queues `tb.realtime.<instanceId>` are **classic, exclusive, auto-delete**: they vanish with the instance, and nothing piles up for dead instances.
- Every instance receives every realtime-relevant event and filters in memory. That's fine up to thousands of events per second. Scale path: add `boardId` to the routing key and bind dynamically per board with local subscribers.
- The registry also indexes by `sessionId` so `identity.session.revoked` can close that session's streams.
