# Architecture · Backend layering (hexagonal, per bounded context)

> Index: [04 · Architecture §4.2](../../04-architecture.md#42-layering-and-dependency-rule)

```mermaid
flowchart TB
  subgraph IF["interface (adapters in)"]
    res["GraphQL resolvers"]
    ctl["REST controllers / SSE"]
    con["RabbitMQ consumers"]
    cron["Scheduled jobs"]
  end
  subgraph APP["application"]
    cmd["Command handlers"]
    qry["Query handlers"]
    pol["Policies (authorization)"]
    ports["Ports: repositories, UoW,<br/>ACL queries, clock, id gen"]
  end
  subgraph DOM["domain (pure TypeScript, no framework)"]
    agg["Aggregates / entities"]
    vo["Value objects"]
    ev["Domain events"]
    ds["Domain services"]
    rep["Repository interfaces"]
  end
  subgraph INF["infrastructure (adapters out)"]
    repo["TypeORM entities, repositories, mappers"]
    outbox["Outbox writer"]
    cachei["CacheFacade drivers"]
    s3i["S3 client (RustFS)"]
    mail["DeliveryFacade drivers"]
  end

  IF --> APP
  APP --> DOM
  INF -. "implements" .-> ports
  INF -. "implements" .-> rep
  INF --> DOM
```

Solid arrow = "depends on". Dotted = "implements". Nothing points *out of* `domain`.
