# 10 · Infrastructure

> Development environment (Docker Compose), configuration, cache facade, RabbitMQ topology, RustFS storage, images and CI.
> Image tags below use **major versions**. Pin exact versions at init time and let Renovate/Dependabot bump them.

---

## 1. Environments

| Env | Runs on | Notes |
|---|---|---|
| **local** | `docker compose` (all services), or infra in Docker + apps on the host | Mailpit catches all email. RustFS single node |
| **ci** | GitHub Actions + Testcontainers + compose for e2e | Ephemeral |
| **staging** (later) | Same images as prod, smaller | Migrations run automatically before rollout |
| **production** (later) | Docker first, Kubernetes after ([ADR-024](./11-decisions.md#adr-024)) | Managed PostgreSQL, RabbitMQ cluster (3 nodes, quorum queues), Valkey, RustFS distributed |

No hosting is set up yet. These rules keep the services ready for Kubernetes from the start:

- `web`, `api` and `worker` are stateless and configured only through env vars.
- `/health/live` and `/health/ready` map directly to liveness and readiness probes.
- On `SIGTERM`, a process stops consuming, closes SSE streams so clients reconnect elsewhere, finishes in-flight work and releases the relay lock.
- Migrations run as a one-shot job before rollout, never on app boot.

---

## 2. Docker Compose (development)

**Diagram →** [Compose services](./diagrams/architecture/10-compose-services.md)

### 2.1 Services and ports

| Service | Image | Host ports | Profile | Purpose |
|---|---|---|---|---|
| `postgres` | `postgres:18-alpine` | 5432 | — | Database |
| `valkey` | `valkey/valkey:8-alpine` | 6379 | `valkey` | Cache (default) |
| `redis` | `redis:8-alpine` | 6379 | `redis` | Cache (alternative) |
| `memcached` | `memcached:1.6-alpine` | 11211 | `memcached` | Cache (alternative) |
| `rabbitmq` | `rabbitmq:4-management-alpine` | 5672, 15672 | — | Broker + management UI |
| `rustfs-perms` | `alpine` | — | — | One-shot: `chown 10001:10001` on the data volume |
| `rustfs` | `rustfs/rustfs` | 9000, 9001 | — | S3 API + console |
| `storage-init` | `amazon/aws-cli` | — | — | One-shot: buckets, CORS, public-read policy |
| `mailpit` | `axllent/mailpit` | 1025, 8025 | — | SMTP sink + web inbox |
| `api` | built from `apps/api/Dockerfile` (`dev` target) | 4000 | `app` | NestJS API |
| `worker` | same image as `api` | — | `app` | NestJS worker |
| `web` | built from `apps/web/Dockerfile` (`dev` target) | 3000 | `app` | Next.js BFF |

Dev URLs: app `http://localhost:3000` · GraphQL (dev only) `http://localhost:4000/graphql` · RabbitMQ `http://localhost:15672` (tb/tb) · RustFS console `http://localhost:9001` · Mailpit `http://localhost:8025`.

### 2.2 Choosing the cache backend

Exactly one cache profile runs at a time. `valkey` and `redis` share host port 6379.

| Backend | `.env` |
|---|---|
| Valkey (default) | `COMPOSE_PROFILES=valkey,app` · `CACHE_DRIVER=valkey` · `CACHE_URL=redis://valkey:6379` |
| Redis | `COMPOSE_PROFILES=redis,app` · `CACHE_DRIVER=redis` · `CACHE_URL=redis://redis:6379` |
| Memcached | `COMPOSE_PROFILES=memcached,app` · `CACHE_DRIVER=memcached` · `CACHE_URL=memcached:11211` |
| None (in-process) | `CACHE_DRIVER=memory` |

To run apps on the host: drop `app` from `COMPOSE_PROFILES` and point URLs at `localhost`.

### 2.3 `compose.yml` draft

```yaml
name: ticket-board

x-app-env: &app-env
  NODE_ENV: development
  DATABASE_URL: postgres://tb:tb@postgres:5432/ticket_board
  CACHE_DRIVER: ${CACHE_DRIVER:-valkey}
  CACHE_URL: ${CACHE_URL:-redis://valkey:6379}
  AMQP_URL: amqp://tb:tb@rabbitmq:5672/tb
  S3_ENDPOINT: http://rustfs:9000
  S3_PUBLIC_ENDPOINT: ${S3_PUBLIC_ENDPOINT:-http://localhost:9000}
  S3_REGION: us-east-1
  S3_ACCESS_KEY: ${S3_ACCESS_KEY:-rustfsadmin}
  S3_SECRET_KEY: ${S3_SECRET_KEY:-rustfsadmin}
  S3_FORCE_PATH_STYLE: "true"
  S3_BUCKET_ATTACHMENTS: tb-attachments
  S3_BUCKET_PUBLIC: tb-public
  EMAIL_DRIVER: ${EMAIL_DRIVER:-smtp}
  SMTP_URL: smtp://mailpit:1025
  MAIL_FROM: "Ticket Board <no-reply@ticketboard.local>"
  JWT_SECRET: ${JWT_SECRET:-dev-only-change-me}
  INTERNAL_API_KEY: ${INTERNAL_API_KEY:-dev-only-change-me}
  WEB_ORIGIN: http://localhost:3000

x-app-deps: &app-deps
  postgres:  { condition: service_healthy }
  rabbitmq:  { condition: service_healthy }
  rustfs:    { condition: service_healthy }
  valkey:    { condition: service_healthy, required: false }
  redis:     { condition: service_healthy, required: false }
  memcached: { condition: service_started, required: false }

services:
  postgres:
    image: postgres:18-alpine
    environment:
      POSTGRES_USER: tb
      POSTGRES_PASSWORD: tb
      POSTGRES_DB: ticket_board
    ports: ["5432:5432"]
    volumes:
      - pg_data:/var/lib/postgresql            # PG 18+ images keep PGDATA under /var/lib/postgresql/18/docker
      - ./infra/postgres/init:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U tb -d ticket_board"]
      interval: 5s
      timeout: 3s
      retries: 20

  valkey:
    image: valkey/valkey:8-alpine
    profiles: [valkey]
    ports: ["6379:6379"]
    healthcheck:
      test: ["CMD", "valkey-cli", "ping"]
      interval: 5s
      retries: 20

  redis:
    image: redis:8-alpine
    profiles: [redis]
    ports: ["6379:6379"]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      retries: 20

  memcached:
    image: memcached:1.6-alpine
    profiles: [memcached]
    command: ["memcached", "-m", "128"]
    ports: ["11211:11211"]

  rabbitmq:
    image: rabbitmq:4-management-alpine
    hostname: rabbitmq                          # node name follows the hostname, so the volume stays valid
    environment:
      RABBITMQ_DEFAULT_USER: tb
      RABBITMQ_DEFAULT_PASS: tb
      RABBITMQ_DEFAULT_VHOST: tb
    ports: ["5672:5672", "15672:15672"]
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "-q", "ping"]
      interval: 10s
      retries: 20

  rustfs-perms:
    image: alpine:3
    command: ["sh", "-c", "chown -R 10001:10001 /data"]
    volumes:
      - rustfs_data:/data
    restart: "no"

  rustfs:
    image: rustfs/rustfs:latest                 # pin a release tag at init
    depends_on:
      rustfs-perms: { condition: service_completed_successfully }
    environment:
      RUSTFS_VOLUMES: /data
      RUSTFS_ADDRESS: 0.0.0.0:9000
      RUSTFS_CONSOLE_ADDRESS: 0.0.0.0:9001
      RUSTFS_CONSOLE_ENABLE: "true"
      RUSTFS_ACCESS_KEY: ${S3_ACCESS_KEY:-rustfsadmin}
      RUSTFS_SECRET_KEY: ${S3_SECRET_KEY:-rustfsadmin}
      RUSTFS_CORS_ALLOWED_ORIGINS: http://localhost:3000
    ports: ["9000:9000", "9001:9001"]
    volumes:
      - rustfs_data:/data
    healthcheck:
      test: ["CMD", "curl", "-fsS", "http://localhost:9000/health"]
      interval: 10s
      timeout: 5s
      retries: 20
      start_period: 20s

  storage-init:
    image: amazon/aws-cli:latest                # pin at init
    depends_on:
      rustfs: { condition: service_healthy }
    environment:
      AWS_ACCESS_KEY_ID: ${S3_ACCESS_KEY:-rustfsadmin}
      AWS_SECRET_ACCESS_KEY: ${S3_SECRET_KEY:-rustfsadmin}
      AWS_DEFAULT_REGION: us-east-1
      S3_ENDPOINT: http://rustfs:9000
    volumes:
      - ./infra/rustfs:/init:ro
    entrypoint: ["sh", "/init/create-buckets.sh"]
    restart: "no"

  mailpit:
    image: axllent/mailpit:latest               # pin at init
    ports: ["1025:1025", "8025:8025"]

  api:
    profiles: [app]
    build: { context: ., dockerfile: apps/api/Dockerfile, target: dev }
    command: ["pnpm", "--filter", "@tb/api", "dev"]
    environment:
      <<: *app-env
      APP_ROLE: api
      PORT: "4000"
    ports: ["4000:4000"]
    depends_on: *app-deps
    develop:
      watch:
        - { action: sync, path: ./apps/api/src, target: /repo/apps/api/src }
        - { action: sync, path: ./packages, target: /repo/packages }
        - { action: rebuild, path: ./pnpm-lock.yaml }

  worker:
    profiles: [app]
    build: { context: ., dockerfile: apps/api/Dockerfile, target: dev }
    command: ["pnpm", "--filter", "@tb/api", "dev:worker"]
    environment:
      <<: *app-env
      APP_ROLE: worker
    depends_on: *app-deps
    develop:
      watch:
        - { action: sync, path: ./apps/api/src, target: /repo/apps/api/src }
        - { action: sync, path: ./packages, target: /repo/packages }
        - { action: rebuild, path: ./pnpm-lock.yaml }

  web:
    profiles: [app]
    build: { context: ., dockerfile: apps/web/Dockerfile, target: dev }
    command: ["pnpm", "--filter", "@tb/web", "dev"]
    environment:
      API_GRAPHQL_URL: http://api:4000/graphql
      API_INTERNAL_URL: http://api:4000
      INTERNAL_API_KEY: ${INTERNAL_API_KEY:-dev-only-change-me}
      APP_ORIGIN: http://localhost:3000
      COOKIE_SECURE: "false"
    ports: ["3000:3000"]
    depends_on:
      api: { condition: service_started }
    develop:
      watch:
        - { action: sync, path: ./apps/web/src, target: /repo/apps/web/src }
        - { action: sync, path: ./packages, target: /repo/packages }
        - { action: rebuild, path: ./pnpm-lock.yaml }

volumes:
  pg_data:
  rabbitmq_data:
  rustfs_data:
```

Run: `docker compose up -d` (infra + apps per `COMPOSE_PROFILES`) or `docker compose watch` for hot sync.

---

## 3. Configuration

All config comes from env vars, validated with a zod schema at boot. The process exits on invalid config.

| Variable | Used by | Example | Notes |
|---|---|---|---|
| `APP_ROLE` | api image | `api` / `worker` | selects the Nest entrypoint module |
| `DATABASE_URL` | api, worker | `postgres://tb:tb@postgres:5432/ticket_board` | |
| `DATABASE_DIRECT_URL` | worker (relay) | same as above in dev | must bypass transaction-mode PgBouncer (LISTEN, advisory locks) |
| `CACHE_DRIVER` | api, worker | `valkey` / `redis` / `memcached` / `memory` | |
| `CACHE_URL` | api, worker | `redis://valkey:6379` · `memcached:11211` | |
| `CACHE_PREFIX` | api, worker | `tb:v1:` | bump to invalidate everything after a breaking cache-shape change |
| `AMQP_URL` | api, worker | `amqp://tb:tb@rabbitmq:5672/tb` | |
| `S3_ENDPOINT` | api, worker | `http://rustfs:9000` | internal operations |
| `S3_PUBLIC_ENDPOINT` | api | `http://localhost:9000` | **signing** presigned URLs for browsers |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | api, worker, rustfs | — | change from defaults outside local |
| `S3_REGION`, `S3_FORCE_PATH_STYLE` | api, worker | `us-east-1`, `true` | RustFS needs path-style |
| `S3_BUCKET_ATTACHMENTS` / `S3_BUCKET_PUBLIC` | api, worker | `tb-attachments` / `tb-public` | |
| `ATTACHMENT_MAX_BYTES` | api | `26214400` | 25 MB |
| `IMAGE_MAX_BYTES` | api | `5242880` | 5 MB, avatars and logos |
| `RUSTFS_CORS_ALLOWED_ORIGINS` | rustfs | `http://localhost:3000` | must match `WEB_ORIGIN` |
| `EMAIL_DRIVER` | worker | `smtp` / `memory` | selects the email driver ([§11](#11-delivery-facade)) |
| `SMTP_URL`, `MAIL_FROM` | worker | `smtp://mailpit:1025` | |
| `JWT_SECRET` (or `JWT_PRIVATE_KEY`) | api | — | rotate with `kid` |
| `ACCESS_TOKEN_TTL` / `REFRESH_TOKEN_TTL` | api | `15m` / `30d` | |
| `INTERNAL_API_KEY` | api, web | — | required on auth mutations from the BFF |
| `WEB_ORIGIN` / `APP_ORIGIN` | api, web | `http://localhost:3000` | links in emails, CORS, origin checks |
| `API_GRAPHQL_URL`, `API_INTERNAL_URL` | web | `http://api:4000/graphql` | server-side only, never exposed to the browser |
| `COOKIE_SECURE` | web | `false` in local | `true` everywhere else |
| `LOG_LEVEL` | all | `info` | |

---

## 4. Cache facade

**Diagrams →** [Cache facade class diagram](./diagrams/class/08-cache-facade.md) · [Cache-aside sequence](./diagrams/sequence/21-cache-aside-and-invalidation.md) · Decision: [ADR-008](./11-decisions.md#adr-008)

### 4.1 Contract (sketch)

```ts
// apps/api/src/shared/infrastructure/cache/cache-driver.ts
export interface CacheDriver {
  readonly name: 'redis' | 'valkey' | 'memcached' | 'memory';
  get(key: string): Promise<string | null>;
  getMany(keys: string[]): Promise<(string | null)[]>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  add(key: string, value: string, ttlSeconds: number): Promise<boolean>; // set-if-absent
  delete(keys: string[]): Promise<void>;
  increment(key: string, by: number, ttlSeconds: number): Promise<number>;
  ping(): Promise<void>;
  close(): Promise<void>;
}

// apps/api/src/shared/infrastructure/cache/cache.facade.ts
export class CacheFacade {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  remember<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T>; // single-flight
  forget(...keys: string[]): Promise<void>;
  taggedKey(tag: string, key: string): Promise<string>;   // embeds the tag's current version
  invalidateTag(tag: string): Promise<void>;              // increments the tag version
  rateLimit(bucket: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; retryAfter: number }>;
  tryLock(name: string, ttlSeconds: number): Promise<{ release(): Promise<void> } | null>; // best-effort only
}
```

### 4.2 Rules

- Application code depends on `CacheFacade` only. **Never import `ioredis` / `memjs` outside the drivers.**
- Redis and Valkey share one RESP driver. Valkey is protocol-compatible with Redis OSS 7.2. Memcached gets its own driver.
- **Lowest common denominator:** no pub/sub, no `KEYS`/`SCAN`, no Lua, no data structures. Pattern invalidation uses **tag versions**.
- **Fail-open:** driver errors and timeouts (> 50 ms) are logged and treated as misses.
- Keys are prefixed with `CACHE_PREFIX`. Keys longer than 200 bytes are hashed (Memcached limit is 250, no spaces).
- Values are JSON. Dates are serialised as ISO strings and revived by the read model, not by the cache.

### 4.3 What is cached

| Key | TTL | Invalidated by |
|---|---|---|
| `board:<id>:snapshot` | 60 s | any board-scoped command, after commit + a second delete 2 s later |
| `perm:board:<boardId>:user:<userId>` (tag `board:<id>:perm`) | 60 s | board membership, visibility, policies, workspace membership events |
| `viewer:<userId>` | 60 s | workspace/board membership, stars, profile |
| `user:<id>:profile` | 10 min | `identity.user.profile_updated` |
| `notif:unread:<userId>` | 5 min | notification created/read |
| `revoked-sid:<sid>` | 15 min | — (written on revoke) |
| `rl:<scope>:<id>` | window | — (fixed-window counters) |

---

## 5. Messaging (RabbitMQ)

**Diagram →** [RabbitMQ topology](./diagrams/architecture/09-rabbitmq-topology.md) · Flow: [Sequence 18](./diagrams/sequence/18-outbox-relay-and-consumers.md)

| Exchange | Type | Purpose |
|---|---|---|
| `tb.events` | topic | Domain/integration events. Routing key = event type (`board.ticket.moved`) |
| `tb.commands` | direct | Point-to-point commands (`email.send`) |
| `tb.retry` | direct | Delayed retries via per-delay TTL queues |
| `tb.dlx` | direct | Dead-letter: routes to `tb.dlq.<queue>` |

Conventions:

- **Topology is declared in code** at boot (`assertExchange` / `assertQueue` / `bindQueue` are idempotent), so a fresh broker self-configures.
- Durable queues are **quorum** queues. Per-instance realtime queues are **classic, exclusive, auto-delete** (quorum queues can't be exclusive).
- Publishing: persistent messages, **publisher confirms**, `message_id` = event id, `correlation_id`, `type` = event type, headers `x-event-version`, `x-board-id`, `x-actor-id`.
- Consuming: manual ack, per-queue prefetch, idempotency via `processed_messages`, retry ladder 5 s → 30 s → 2 min → 10 min → 30 min, then DLQ.
- Connection names: `tb-<role>-<hostname>` for visibility in the management UI.

---

## 6. Object storage (RustFS)

**Diagrams →** [Upload sequence](./diagrams/sequence/16-attachment-upload.md) · [Image upload sequence](./diagrams/sequence/23-image-upload.md) · [Download sequence](./diagrams/sequence/17-attachment-download.md) · [Storage class diagram](./diagrams/class/06-storage.md) · Design: [13 · File uploads](./13-file-uploads.md)

| Bucket | Access | Content | Key layout |
|---|---|---|---|
| `tb-attachments` | **private**, presigned URLs only | ticket attachments, previews, images waiting for the worker | `boards/{boardId}/tickets/{ticketId}/{attachmentId}` · `previews/{attachmentId}.webp` · `incoming/avatars/{userId}/{id}` · `incoming/logos/{workspaceId}/{id}` |
| `tb-public` | anonymous read, written only by the worker | avatars, workspace logos, uploaded board backgrounds (P2) | `avatars/{userId}/{id}.webp` · `logos/{workspaceId}/{id}.webp` |

| Setting | Value |
|---|---|
| Client | AWS SDK v3 `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`, `forcePathStyle: true`. The signing client sets `requestChecksumCalculation` and `responseChecksumValidation` to `WHEN_REQUIRED` ([13 §4.5](./13-file-uploads.md#45-rustfs-adapter)) |
| Presigned PUT TTL | 5 min, `Content-Type` and `Content-Length` signed |
| Presigned GET TTL | until the next full hour (stable URLs → browser cache) |
| CORS | `RUSTFS_CORS_ALLOWED_ORIGINS` on the server, set to `WEB_ORIGIN` |
| Lifecycle | app-level GC (`pending` or `failed` attachments and `incoming/` objects older than 1 h). Object deletion is async via `tb.storage.cleanup` |

`infra/rustfs/create-buckets.sh` (run by `storage-init`):

```sh
#!/bin/sh
set -eu
s3api() { aws --endpoint-url "$S3_ENDPOINT" s3api "$@"; }

for bucket in tb-attachments tb-public; do
  s3api head-bucket --bucket "$bucket" 2>/dev/null || s3api create-bucket --bucket "$bucket"
done

s3api put-bucket-policy --bucket tb-public --policy '{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow", "Principal": "*",
    "Action": ["s3:GetObject"], "Resource": ["arn:aws:s3:::tb-public/*"]
  }]
}'
```

> ⚠️ **Verify at init:** run the RustFS checks in [13 §10](./13-file-uploads.md#10-tests) against the pinned image. The server CORS setting is used instead of `PutBucketCors` because a failed call would stop `storage-init` under `set -eu`, and that API's support has varied between releases.

---

## 7. PostgreSQL

- `infra/postgres/init/01-extensions.sql` → `CREATE EXTENSION citext; CREATE EXTENSION pg_trgm;`
- Pools: api 20 connections per instance, worker 10, plus **one dedicated session** for the relay (LISTEN + advisory lock).
- Production: PgBouncer in **transaction** mode for api/worker pools. The relay connects **directly** (`DATABASE_DIRECT_URL`), because LISTEN/NOTIFY and session advisory locks don't work through transaction pooling.
- Backups: daily base backup + WAL archiving (PITR 7 days) on the managed service.

---

## 8. Container images

`apps/api/Dockerfile` sketch (the web image follows the same pattern, with `next build` and `output: 'standalone'`):

```dockerfile
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@2 prune @tb/api --docker

FROM base AS deps
COPY --from=pruner /repo/out/json/ .
RUN pnpm install --frozen-lockfile

FROM deps AS dev
COPY --from=pruner /repo/out/full/ .
CMD ["pnpm", "--filter", "@tb/api", "dev"]

FROM deps AS build
COPY --from=pruner /repo/out/full/ .
RUN pnpm turbo run build --filter=@tb/api... \
 && pnpm --filter @tb/api deploy --prod /out

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
USER node
WORKDIR /app
COPY --from=build --chown=node:node /out .
# APP_ROLE=api → node dist/api.js · APP_ROLE=worker → node dist/worker.js
CMD ["sh", "-c", "node dist/${APP_ROLE:-api}.js"]
```

The API build emits two entrypoints: `src/main.ts` → `dist/api.js` and `src/worker.ts` → `dist/worker.js`.

---

## 9. CI/CD

**Diagram →** [CI/CD pipeline](./diagrams/architecture/11-ci-pipeline.md)

---

## 10. Observability

| Signal | Tool |
|---|---|
| Logs | `nestjs-pino` / `pino` JSON. Fields `correlationId`, `userId`, `boardId`, `eventId` |
| Metrics (P2) | Prometheus `/metrics`: HTTP latency, GraphQL resolver timings, outbox lag (`now - min(occurred_at) where published_at is null`), queue depth, SSE connection count |
| Traces (P2) | OpenTelemetry. Context propagated BFF → API → AMQP headers → consumers |
| Alerts | outbox lag > 30 s · any DLQ depth > 0 · SSE error rate · DB pool saturation |
| Dev tools | RabbitMQ management, RustFS console, Mailpit UI |

---

## 11. Delivery facade

**Diagram →** [Delivery facade class diagram](./diagrams/class/09-delivery-facade.md) · Decisions: [ADR-021](./11-decisions.md#adr-021), [ADR-025](./11-decisions.md#adr-025)

All outbound email goes through `DeliveryFacade`, in the worker only. It follows the same pattern as the cache: a small driver contract, chosen by env var. Email is the only channel for now.

```ts
// apps/api/src/shared/infrastructure/delivery/delivery.facade.ts
export interface OutboundMessage {
  to: string;                       // email address
  template: string;                 // e.g. 'identity.verify-email'
  locale: string;                   // recipient's locale
  data: Record<string, unknown>;
}

export class DeliveryFacade {
  sendEmail(message: OutboundMessage): Promise<DeliveryReceipt>;
}
```

| Driver | Use | Status |
|---|---|---|
| `smtp` | Mailpit locally, any SMTP relay in production | MVP |
| `memory` | Vitest tests | MVP |
| `ses` | Amazon SES | Later |

**Testing in Docker:** Mailpit catches all email. Its web inbox is at `http://localhost:8025`, and Playwright can read verification and invitation links through Mailpit's REST API.
