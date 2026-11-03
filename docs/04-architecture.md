# 04 · Architecture

> System context, containers, monorepo layout, backend DDD layering, frontend BFF and the cross-cutting concerns. Decisions are justified in [11-decisions.md](./11-decisions.md).

---

## 1. System context (C4 level 1)

**Diagram →** [System context](./diagrams/architecture/01-system-context.md)

---

## 2. Containers (C4 level 2)

**Diagram →** [Containers](./diagrams/architecture/02-containers.md)

| Container | Tech | Responsibility | Scales |
|---|---|---|---|
| **web** | Next.js (latest, App Router), React 19, TypeScript | SSR/RSC pages, BFF: holds session cookies, proxies GraphQL and SSE, Server Actions for forms | Horizontally, stateless |
| **api** | NestJS, GraphQL (code-first, Apollo driver), REST | Commands and queries, authorization, SSE gateway | Horizontally. Each instance has its own realtime queue |
| **worker** | Same NestJS codebase, `worker.ts` entrypoint | Outbox relay (single leader), RabbitMQ consumers, scheduled jobs | Horizontally for consumers. Relay uses an advisory-lock leader |
| **PostgreSQL** | 18 | System of record, outbox, idempotency inbox | Vertical + read replicas later |
| **Cache** | Valkey 8 / Redis 8 / Memcached 1.6 | Read-through caches, permission cache, rate limits | Managed / cluster |
| **RabbitMQ** | 4.x (quorum queues) | Async integration events, realtime backplane, retries/DLQ | Cluster of 3 in prod |
| **RustFS** | S3-compatible | Attachments, avatars, previews | Distributed mode in prod |

### Request paths at a glance

| Path | Route |
|---|---|
| Initial page load | Browser → Next.js Server Component → GraphQL query → API → (cache) → PostgreSQL |
| Interactive mutation | Browser (TanStack Query) → `POST /api/graphql` (BFF proxy adds Bearer) → API |
| Form mutation | Browser → Server Action → GraphQL mutation → API |
| Realtime | Browser `EventSource('/api/realtime?boardId=…')` → BFF route handler streams → API `GET /realtime/stream` → events from RabbitMQ |
| File upload | Browser → (BFF → API: presign) → **PUT directly to RustFS** → BFF → API confirm ([13 · File uploads](./13-file-uploads.md)) |
| File download | Browser → `GET /api/files/:id` (BFF → API authorise + presign) → 302 → RustFS |

---

## 3. Monorepo layout (Turborepo + pnpm workspaces)

```text
my-ticket-board/
├─ apps/
│  ├─ api/                         # NestJS: api.ts (HTTP+GraphQL) and worker.ts (consumers, relay, cron)
│  │  ├─ src/
│  │  │  ├─ main.ts                # api entrypoint
│  │  │  ├─ worker.ts              # worker entrypoint
│  │  │  ├─ app.module.ts / worker.module.ts
│  │  │  ├─ modules/               # one folder per bounded context (see §4.3)
│  │  │  │  ├─ identity/
│  │  │  │  ├─ workspace/
│  │  │  │  ├─ board/
│  │  │  │  ├─ collaboration/
│  │  │  │  ├─ storage/
│  │  │  │  ├─ notification/
│  │  │  │  └─ realtime/
│  │  │  └─ shared/
│  │  │     ├─ kernel/             # Entity, AggregateRoot, ValueObject, DomainEvent, Result, ids
│  │  │     ├─ application/        # UnitOfWork port, command/query bus helpers, policies base
│  │  │     └─ infrastructure/     # database, cache and delivery facades, messaging, storage, config, i18n, logging, graphql
│  │  ├─ db/migrations/            # TypeORM migrations running raw SQL (forward-only)
│  │  ├─ schema.gql                # generated (code-first), committed
│  │  └─ test/                     # integration + e2e (Testcontainers)
│  └─ web/                         # Next.js BFF
│     ├─ src/app/                  # App Router (see §5.1)
│     ├─ src/features/             # board, ticket, workspace, auth … (UI + hooks per feature)
│     ├─ src/lib/                  # graphql clients (server + browser), session, realtime client, query client
│     ├─ src/proxy.ts              # Next.js 16 proxy (formerly middleware): session refresh, auth redirects
│     ├─ src/gql/                  # generated typed documents (graphql-codegen client preset)
│     └─ messages/                 # next-intl catalogues, one file per locale
├─ packages/
│  ├─ contracts/                   # realtime event types, shared enums, zod schemas, supported locales
│  ├─ ui/                          # shadcn/ui components, Tailwind theme, global CSS (@tb/ui)
│  ├─ ordering/                    # fractional-index helpers (same algorithm on client and server)
│  ├─ tsconfig/                    # base tsconfig presets
│  └─ eslint-config/               # shared lint rules (incl. import boundaries)
├─ infra/
│  ├─ postgres/init/               # extensions bootstrap
│  ├─ rustfs/                      # bucket + CORS bootstrap script
│  └─ rabbitmq/                    # definitions.json (optional, topology is also declared in code)
├─ docs/                           # this documentation
├─ compose.yml
├─ turbo.json
├─ pnpm-workspace.yaml
├─ package.json
└─ CLAUDE.md
```

### Turbo task graph

**Diagram →** [Turborepo task graph](./diagrams/architecture/03-turbo-task-graph.md)

`turbo.json` sketch:

```jsonc
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build":     { "dependsOn": ["^build", "codegen"], "outputs": ["dist/**", ".next/**", "!.next/cache/**"] },
    "codegen":   { "dependsOn": ["^schema"], "outputs": ["src/gql/**"] },
    "schema":    { "outputs": ["schema.gql"] },
    "dev":       { "cache": false, "persistent": true },
    "lint":      { "dependsOn": ["^build"] },
    "typecheck": { "dependsOn": ["^build", "codegen"] },
    "test":      { "dependsOn": ["^build"] }
  }
}
```

---

## 4. Backend (NestJS + DDD)

### 4.1 Architectural style

- **Modular monolith** with **bounded contexts** as NestJS modules. Two entrypoints, `api` and `worker`, share one codebase.
- **Hexagonal layering** inside each context: domain ← application ← interface / infrastructure.
- **CQRS-lite**: commands go through aggregates and repositories. Queries may bypass the domain and read optimised SQL / cache directly.
- **Domain events → transactional outbox → RabbitMQ** for everything asynchronous ([ADR-007](./11-decisions.md#adr-007)).

### 4.2 Layering and dependency rule

**Diagram →** [Backend layering](./diagrams/architecture/04-backend-layering.md)

**Rules (enforced by ESLint import boundaries):**

1. `domain/` imports nothing from Nest, the ORM, `application/`, `infrastructure/` or another context.
2. `application/` depends on `domain/` and on **ports** (interfaces). Never on concrete infrastructure.
3. A context never imports another context's `domain/` or `infrastructure/`. Cross-context interaction goes through:
   - **integration events** (async, via outbox), or
   - an **ACL query port** declared by the consumer and implemented in infrastructure (sync reads, e.g. `WorkspaceMembershipReader` used by Board).
4. `shared/kernel` is the only shared domain code. Keep it tiny.

### 4.3 Bounded context folder template

```text
modules/board/
├─ domain/
│  ├─ board/            board.aggregate.ts, board-member.entity.ts, label.entity.ts, board-policies.vo.ts
│  ├─ list/             list.aggregate.ts
│  ├─ ticket/           ticket.aggregate.ts, ticket-dates.vo.ts, cover.vo.ts
│  ├─ checklist/        checklist.aggregate.ts, checklist-item.entity.ts
│  ├─ shared/           position.vo.ts, board-role.vo.ts
│  ├─ events/           ticket-moved.event.ts …
│  ├─ services/         ticket-transfer.service.ts (cross-board move rules)
│  ├─ errors/           board.errors.ts
│  └─ repositories/     *.repository.ts (interfaces)
├─ application/
│  ├─ commands/         move-ticket/ { move-ticket.command.ts, move-ticket.handler.ts }
│  ├─ queries/          get-board-snapshot/ { query, handler, read-model }
│  ├─ policies/         board.policy.ts
│  └─ ports/            workspace-membership.reader.ts, ticket-number.allocator.ts
├─ infrastructure/
│  ├─ persistence/      entities/*.orm-entity.ts, mappers/, board.repository.typeorm.ts, board.read-repository.ts
│  └─ acl/              workspace-membership.reader.typeorm.ts
├─ interface/
│  ├─ graphql/          board.resolver.ts, ticket.resolver.ts, types/, inputs/, loaders/
│  └─ http/             (rare: board export, etc.)
└─ board.module.ts
```

### 4.4 Command pipeline (component view)

**Diagram →** [Command pipeline](./diagrams/architecture/05-command-pipeline.md)

- **Domain events are collected** on the aggregate and drained by the UnitOfWork before commit. They're written to `activities` (synchronously, same transaction) and `outbox_events` (relayed later).
- **Optimistic concurrency:** every aggregate row has `version`. `UPDATE … WHERE id = $1 AND version = $2`, 0 rows → `ConcurrencyError`. For commutative commands (add label, toggle item) the handler retries up to 3 times. For text edits the client sends `expectedVersion` and a mismatch surfaces as `VERSION_CONFLICT`.
- **Queries** use read repositories with hand-tuned SQL plus DataLoader batching, wrapped in `CacheFacade.remember` for hot reads (board snapshot, permissions).

### 4.5 Bounded contexts (summary)

| Context | Type | Aggregates | Publishes | Consumes |
|---|---|---|---|---|
| **Identity** | Generic | User, Session | `identity.user.*`, `identity.session.revoked` | — |
| **Workspace** | Supporting | Workspace, Invitation | `workspace.*` | `identity.user.deleted` |
| **Board** | **Core** | Board, List, Ticket, Checklist | `board.*` | `workspace.member.removed`, `workspace.workspace.deleted`, `identity.user.deleted` |
| **Collaboration** | Supporting | Comment, Watch (Activity is a projection) | `collab.*` | `board.*` (activity is written in-process) |
| **Storage** | Generic | Attachment | `storage.attachment.*` | `board.ticket.deleted` (cleanup) |
| **Notification** | Supporting | Notification, Preference | `notification.*` | `collab.comment.created`, `board.ticket.*`, `workspace.invitation.*`, `board.member.*` |
| **Realtime** | Infrastructure | — (connection registry) | — | almost everything (projects to client events) |

Context map and class diagrams: [05-domain-model.md](./05-domain-model.md) · [Context map](./diagrams/architecture/08-context-map.md).

### 4.6 Realtime design (summary)

**Diagram →** [Realtime fan-out](./diagrams/architecture/06-realtime-fanout.md) · Lifecycle: [Sequence 19](./diagrams/sequence/19-sse-connection-lifecycle.md) · Client states: [State 15](./diagrams/state/15-sse-client-connection.md)

- **SSE, one stream per browser tab**: `GET /api/realtime?boardId=…` subscribes the tab to its **user channel** (notifications) and, when on a board, the **board channel**. Navigating to another board reconnects with a new `boardId`.
- Each API instance declares an **exclusive, auto-delete** queue bound to the event exchange ([RabbitMQ topology](./diagrams/architecture/09-rabbitmq-topology.md)). It receives every relevant event and filters in memory by `boardId` / `recipientId`. Scale path: per-board routing keys with dynamic bindings.
- Events carry `id` (event UUIDv7), `boardId`, `actorId`, `clientMutationId`, entity `version`. Clients drop events whose version ≤ their cached version and ignore their own echoes.
- On reconnect the client refetches the board snapshot (simple and always correct). `Last-Event-ID` is used only for de-duplication. A replay buffer is P2.
- The stream closes when the access token expires (EventSource auto-reconnects through the BFF, which refreshes the session) or immediately when the user loses access (`board.member.removed`, `identity.session.revoked`).

- **Scale path:** SSE stays in `api`, behind the BFF, for the MVP. If streams start to drive scaling, the `realtime` module moves to its own process. A later step can route `/api/realtime` past Next.js at the edge. The browser never connects to the API directly ([Realtime scale path](./diagrams/architecture/12-realtime-scale-path.md)).

Why SSE instead of WebSocket: [ADR-005](./11-decisions.md#adr-005). Why streams stay behind the BFF: [ADR-026](./11-decisions.md#adr-026).

---

## 5. Frontend (Next.js BFF)

### 5.1 Route map (App Router)

```text
src/app/
├─ layout.tsx                         # html, providers (QueryClientProvider, theme)
├─ (auth)/
│  ├─ login/page.tsx
│  ├─ signup/page.tsx
│  ├─ verify-email/page.tsx
│  ├─ forgot-password/page.tsx
│  ├─ reset-password/page.tsx
│  └─ invite/[token]/page.tsx
├─ (app)/
│  ├─ layout.tsx                      # AppHeader, NotificationBell, realtime user channel
│  ├─ page.tsx                        # Home: starred, recent, workspaces
│  ├─ w/[slug]/page.tsx               # workspace boards
│  ├─ w/[slug]/members/page.tsx
│  ├─ w/[slug]/settings/page.tsx
│  ├─ b/[shortId]/[[...slug]]/page.tsx   # Board (RSC loads snapshot, client BoardCanvas)
│  ├─ c/[shortId]/[[...slug]]/page.tsx   # Ticket full page (hard navigation / share link)
│  ├─ @modal/(...)c/[shortId]/[[...slug]]/page.tsx  # intercepted: ticket modal over the board
│  ├─ u/[username]/page.tsx
│  └─ settings/{profile,security,notifications}/page.tsx
└─ api/
   ├─ graphql/route.ts                # BFF GraphQL proxy (POST only, persisted-ops allowlist in prod)
   ├─ realtime/route.ts               # SSE proxy (GET, text/event-stream)
   ├─ files/[attachmentId]/route.ts   # authorise + 302 to presigned GET
   └─ auth/oauth/[provider]/…         # (later) OAuth start/callback
```

### 5.2 Data and state strategy

| Concern | Choice |
|---|---|
| GraphQL clients | One set of typed documents, two clients ([ADR-019](./11-decisions.md#adr-019)). `src/lib/graphql/server.ts` is `server-only`, calls `API_GRAPHQL_URL` directly and takes the token from cookies. Server Components, Server Actions and route handlers use it. `src/lib/graphql/browser.ts` posts to `/api/graphql` for client components |
| Initial data | Server Components call the API through the **server client** and pass a **snapshot** to client components |
| Client cache | TanStack Query. Board snapshot is hydrated into the key `['board', boardId]` |
| Mutations (interactive) | TanStack Query mutations → `/api/graphql` with optimistic updates (drag and drop, toggles, inline edits). Server Actions run sequentially per client, so they don't suit rapid drags |
| Mutations (forms) | Server Actions (sign-up, create workspace, settings) with `zod` validation and `revalidatePath` where needed |
| Typed GraphQL | `graphql-codegen` client preset against `apps/api/schema.gql` → typed `DocumentNode`s |
| Realtime | `useBoardRealtime(boardId)` hook: one `EventSource`, applies events to the query cache through reducers from `packages/contracts` |
| Ordering | `packages/ordering` (same fractional-index algorithm as the server) for optimistic positions |
| Drag and drop | dnd-kit: one `DndContext` per board, one `SortableContext` per list, `DragOverlay` for the dragged ticket ([ADR-018](./11-decisions.md#adr-018)) |
| UI kit | Tailwind CSS + shadcn/ui in `packages/ui` (`@tb/ui`). Domain components built on it stay in `apps/web/src/features` ([ADR-017](./11-decisions.md#adr-017)) |
| i18n | `next-intl` with the `tb_locale` cookie and no locale in the URL ([12 · Internationalisation](./12-internationalisation.md)) |

### 5.3 BFF session handling

- Tokens are **never readable by browser JS**. Cookies: `tb_at` (access JWT, httpOnly, Secure, SameSite=Lax, 15 min) and `tb_rt` (opaque refresh token, httpOnly, Secure, SameSite=Lax, 30 days).
- `src/proxy.ts` runs before routes. If `tb_at` is missing or expires within 60 s and `tb_rt` exists, it calls `refreshSession`, sets the new cookies on the response **and** on the forwarded request (so Server Components in the same request see the new token). Without a valid session, protected routes redirect to `/login?next=…`.
- `/api/graphql` and `/api/realtime` read `tb_at` and send `Authorization: Bearer …` upstream. They also forward `x-correlation-id`, `x-forwarded-for` and the resolved locale in `Accept-Language`.
- **CSRF:** SameSite=Lax cookies, plus `/api/graphql` requires `Content-Type: application/json` and an `Origin` matching the app origin. Server Actions have built-in origin checks.

---

## 6. Cross-cutting concerns

| Concern | Approach |
|---|---|
| **Authentication** | API issues access JWT (EdDSA or HS256, 15 min, claims `sub`, `sid`, `ver`) and opaque refresh token (rotated, hashed at rest). See [ADR-004](./11-decisions.md#adr-004) |
| **Authorization** | Application-layer **policies** per context (`BoardPolicy.can(actor, 'ticket.move', board)`), effective role resolved as in [Activity · Authorization resolution](./diagrams/activity/03-authorization-resolution.md), cached 60 s |
| **Validation** | GraphQL input DTOs (`class-validator`) for shape. Value objects for domain rules. `zod` on the BFF for forms |
| **Errors** | Domain errors (`TicketNotFound`, `VersionConflict`…) → mapped by an exception filter to GraphQL errors with `extensions.code` ([09 §3](./09-api-contract.md#3-error-model)) |
| **IDs** | UUIDv7, generated by the application (client may supply for creates → idempotent retries) |
| **Time** | `timestamptz` in DB, ISO-8601 UTC in API, `Clock` port for testability |
| **Logging** | `nestjs-pino` JSON logs. `correlationId` from BFF header → request context → outbox metadata → AMQP `correlation_id` → consumer logs |
| **Tracing** | OpenTelemetry SDK (P2), OTLP exporter |
| **Config** | `@nestjs/config` with a zod-validated schema. Fails fast on boot |
| **Health** | `GET /health/live`, `GET /health/ready` (DB, cache, RabbitMQ, RustFS) |
| **Rate limiting** | `CacheFacade.increment` fixed-window counters on auth mutations and uploads |
| **GraphQL hardening** | Depth/complexity limits, introspection off in prod, persisted operations allowlist on the BFF proxy |
| **i18n** | `nestjs-i18n` on the API, locale taken from `Accept-Language`. Domain errors carry codes, and translation happens in the exception filter ([12 · Internationalisation](./12-internationalisation.md)) |
| **Testing** | Jest (NestJS default) for the API and packages. Domain: pure unit tests. Application: in-memory repos. Infrastructure: Testcontainers (Postgres, RabbitMQ). HTTP and GraphQL: Supertest. Web: Playwright ([ADR-020](./11-decisions.md#adr-020)) |

---

## 7. Deployment view (production sketch)

**Diagram →** [Deployment view](./diagrams/architecture/07-deployment.md)

Key constraints: SSE needs proxy buffering off on every hop. The API is never public. No sticky sessions needed.
