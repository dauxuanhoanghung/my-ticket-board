# Architecture · Deployment view (production sketch)

> Index: [04 · Architecture §7](../../04-architecture.md#7-deployment-view-production-sketch)

```mermaid
flowchart TB
  inet(["Internet"]) --> lb["Load balancer / reverse proxy<br/>TLS, HTTP/2, no buffering on /api/realtime"]
  lb --> web1["web #1"]
  lb --> web2["web #2"]
  lb --> s3pub["RustFS public endpoint<br/>(presigned URLs only)"]
  subgraph PRIV["Private subnet"]
    web1 --> api1["api #1"]
    web1 --> api2["api #2"]
    web2 --> api1
    web2 --> api2
    w1["worker #1 (relay leader)"]
    w2["worker #2"]
    api1 --> pg[("PostgreSQL primary")]
    api2 --> pg
    w1 --> pg
    w2 --> pg
    pg --> pgr[("read replica (later)")]
    api1 --> kv[("Valkey")]
    api2 --> kv
    api1 <--> mq{{"RabbitMQ cluster"}}
    api2 <--> mq
    w1 <--> mq
    w2 <--> mq
    w1 --> s3[("RustFS cluster")]
    api1 --> s3
  end
  s3pub --> s3
```

## Notes

- SSE needs **proxy buffering off** and long idle timeouts (≥ 60 s, with 25 s heartbeats) on every hop.
- `web` → `api` stays on the private network. The API is never exposed publicly.
- No sticky sessions needed. Any API instance can serve any board stream.
- This is a target sketch. No hosting exists yet: services run on Docker first and move to Kubernetes later ([ADR-024](../../11-decisions.md#adr-024)).
