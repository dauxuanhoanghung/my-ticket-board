# Architecture · Containers (C4 level 2)

> Index: [04 · Architecture §2](../../04-architecture.md#2-containers-c4-level-2) · Runtime services: [10-compose-services](./10-compose-services.md)

```mermaid
flowchart LR
  browser(["Browser<br/>React 19 client components<br/>EventSource"])

  subgraph EDGE["Public edge"]
    web["apps/web<br/>Next.js App Router (BFF)<br/>:3000"]
  end

  subgraph PRIVATE["Private network"]
    api["apps/api · api entrypoint<br/>NestJS: GraphQL /graphql,<br/>REST /health /realtime /files<br/>:4000"]
    worker["apps/api · worker entrypoint<br/>NestJS standalone: outbox relay,<br/>consumers, scheduler"]
    pg[("PostgreSQL<br/>source of truth + outbox")]
    cache[("Cache<br/>Valkey / Redis / Memcached<br/>via CacheFacade")]
    mq{{"RabbitMQ<br/>tb.events topic exchange"}}
  end

  s3[("RustFS<br/>S3-compatible object storage<br/>:9000")]
  smtp["SMTP"]

  browser -- "HTML/RSC, Server Actions,<br/>POST /api/graphql, GET /api/realtime (SSE)" --> web
  browser -- "presigned PUT / GET only" --> s3
  web -- "GraphQL + Bearer JWT,<br/>SSE upstream" --> api
  api -- "SQL (tx + outbox)" --> pg
  api -- "get/set/del" --> cache
  api -- "consume tb.realtime.instance" --> mq
  api -- "presign, HEAD" --> s3
  worker -- "poll outbox, LISTEN" --> pg
  worker -- "publish / consume" --> mq
  worker -- "thumbnails" --> s3
  worker -- "send" --> smtp
  worker -- "invalidate" --> cache
```

Container responsibilities and the request-path table: [04 · Architecture §2](../../04-architecture.md#2-containers-c4-level-2).

The browser never talks to the API directly. The only bypass of the BFF is presigned object-storage URLs.
