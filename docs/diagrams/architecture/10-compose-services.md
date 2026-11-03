# Architecture · Docker Compose services (development)

> Index: [10 · Infrastructure §2](../../10-infrastructure.md#2-docker-compose-development)

```mermaid
flowchart LR
  browser(["Browser on the host"])

  subgraph NET["compose project: ticket-board"]
    direction LR
    subgraph APP["profile: app"]
      web["web :3000"]
      api["api :4000"]
      worker["worker"]
    end
    subgraph CACHE["one cache profile"]
      valkey[("valkey :6379<br/>profile valkey")]
      redis[("redis :6379<br/>profile redis")]
      memc[("memcached :11211<br/>profile memcached")]
    end
    pg[("postgres :5432")]
    mq{{"rabbitmq :5672<br/>management :15672"}}
    rustfs[("rustfs :9000<br/>console :9001")]
    perms["rustfs-perms<br/>one-shot: chown 10001"]
    init["storage-init<br/>one-shot: buckets, CORS, policy"]
    mail["mailpit<br/>smtp :1025 · ui :8025"]
  end

  browser --> web
  browser -- "presigned PUT / GET" --> rustfs
  browser -- "dev consoles" --> mq
  browser -- "dev inbox" --> mail
  web --> api
  api --> pg
  api --> mq
  api --> rustfs
  api -.-> CACHE
  worker --> pg
  worker --> mq
  worker --> rustfs
  worker --> mail
  worker -.-> CACHE
  perms --> rustfs
  init --> rustfs
```

Dashed = whichever cache profile is active. Infra services have no profile, so they always start. App services are in the `app` profile, which lets you run them on the host instead.
