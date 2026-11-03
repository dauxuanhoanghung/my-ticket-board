# CLAUDE.md

Guidance for Claude Code and contributors working in this repository.

## Project status

**Pre-init.** The repo contains design docs only (`docs/`). There is no `package.json`, no code, and no `compose.yml` yet.
When scaffolding, follow [docs/04-architecture.md](docs/04-architecture.md) and [docs/10-infrastructure.md](docs/10-infrastructure.md), and run the checks in [Verify at init](docs/11-decisions.md#verify-at-init) first.
Update the **Commands** section below as soon as real scripts exist.

## Product

**Ticket Board**, a Trello-style Kanban app. Workspaces contain Boards. Boards contain Lists. Lists contain Tickets (Trello "cards").
Every board change is pushed live to all viewers. Ticket drag-and-drop movement is the core realtime flow ([Sequence 11](docs/diagrams/sequence/11-move-ticket-realtime.md)).
Scope grows step by step: boards are private or workspace-visible, and login is email and password. Public boards and OAuth aren't in the MVP ([ADR-022](docs/11-decisions.md#adr-022)).

## Tech stack

| Concern | Choice |
|---|---|
| Monorepo | Turborepo + pnpm workspaces, packages scoped `@tb/*` |
| Backend | NestJS + TypeScript, DDD modular monolith, GraphQL (code-first) + HTTP. Two entrypoints: `api` and `worker` |
| Frontend | Next.js (latest, App Router) + React 19 + TypeScript, acting as **BFF**. Talks to the API only via GraphQL |
| UI | Tailwind CSS + shadcn/ui in the shared `@tb/ui` package. Drag and drop with dnd-kit |
| GraphQL client | `graphql-codegen` typed documents, used by a server client (Server Components, Server Actions, route handlers) and a browser client (`/api/graphql`, TanStack Query) |
| Database | PostgreSQL 18 with TypeORM. ORM entities stay in `infrastructure/`, migrations run raw SQL |
| Cache | Valkey (default), Redis or Memcached, **only** through `CacheFacade` |
| Queue | RabbitMQ 4 (transactional outbox → `tb.events` topic exchange) |
| Storage | RustFS (S3-compatible), presigned URLs |
| Realtime | SSE, proxied by the BFF. RabbitMQ is the cross-instance backplane |
| Outbound messages | Email **only** through `DeliveryFacade`. Mailpit in development |
| i18n | `en` and `vi`. `next-intl` (cookie `tb_locale`) and `nestjs-i18n` (`Accept-Language` set by the BFF) |
| Tests | Jest (NestJS default) for the API and packages, Playwright for the web app |
| Dev env | Docker Compose (`compose.yml`), profiles for cache backend and apps |

## Repository layout (planned)

```text
apps/api/        NestJS: src/main.ts (api), src/worker.ts (worker), src/modules/<context>/, src/shared/
apps/web/        Next.js BFF: src/app/, src/features/, src/lib/, src/proxy.ts
packages/contracts/   realtime event types + reducers, shared enums/zod schemas, supported locales
packages/ui/          shadcn/ui components and Tailwind theme, no data fetching or hard-coded strings
packages/ordering/    fractional-index helpers (same keys on client and server)
packages/tsconfig/, packages/eslint-config/
infra/           postgres init SQL, rustfs bucket script, rabbitmq definitions
docs/            design docs; diagrams in docs/diagrams/<type>/
```

## Commands (planned, verify after init)

```bash
pnpm install
docker compose up -d                 # infra (+ apps when COMPOSE_PROFILES includes "app")
docker compose watch                 # hot-sync app containers
pnpm dev                             # turbo: api + worker + web on the host
pnpm db:migrate                      # apply SQL migrations
pnpm --filter @tb/api schema         # regenerate apps/api/schema.gql
pnpm --filter @tb/web codegen        # regenerate typed GraphQL documents
pnpm lint && pnpm typecheck && pnpm test
pnpm test:e2e
```

## Architecture rules (must follow)

1. **Browser → Next.js only.** The browser never calls the NestJS API directly. The only bypass is presigned RustFS URLs. The API lives on the private network.
2. **DDD layering per bounded context** (`identity`, `workspace`, `board`, `collaboration`, `storage`, `notification`, `realtime`):
   `domain/` is pure TypeScript (no Nest, no ORM, no imports from other layers or contexts) ← `application/` (commands, queries, policies, ports) ← `infrastructure/` and `interface/`.
3. **No cross-context imports** of `domain/` or `infrastructure/`. Use integration events (async) or an ACL reader port declared by the consumer (sync reads).
4. **Writes go through command handlers → aggregates → repositories** inside `UnitOfWork`. Reads may use read repositories and raw SQL.
5. **Never publish to RabbitMQ from a request.** Raise domain events. The UnitOfWork writes them to `outbox_events` (and `activities`) in the same transaction, and the worker relay publishes them.
6. **Consumers are idempotent**: record `(consumer, message_id)` in `processed_messages` in the same transaction as the side effects.
7. **Cache only via `CacheFacade`.** No Redis-only features (pub/sub, Lua, SCAN). The cache is fail-open and never needed for correctness.
8. **Ordering uses fractional keys** (`position text COLLATE "C"`, `@tb/ordering`). Move/create APIs take `prevId` / `nextId`, never positions. The server locks the list row(s) `ORDER BY id FOR UPDATE` and re-resolves neighbours.
9. **Concurrency:** aggregates carry `version`. Title/description edits require `expectedVersion` (→ `VERSION_CONFLICT`). Realtime events carry `version`, and clients ignore stale ones.
10. **IDs are UUIDv7 generated by the app.** Clients send the id on create (idempotent). URLs use `short_id`. Tickets also have a per-board `number`.
11. **Authorization lives in application-layer policies**, using the effective board role ([activity diagram](docs/diagrams/activity/03-authorization-resolution.md)). Return `NOT_FOUND` rather than leaking the existence of private boards.
12. **Secrets never travel in events.** Verification, reset and invitation tokens are minted by the worker that emails them. Only hashes are stored.
13. **Files:** private bucket + presigned URLs, signed with the *public* endpoint. Object keys are built from ids only. File bytes never pass through GraphQL, Server Actions or Next.js: the browser PUTs to RustFS between a request and a confirm mutation ([docs/13](docs/13-file-uploads.md)).
14. **Outbound messages only via `DeliveryFacade`, and only from the worker.** Never import an SMTP client outside its driver.
15. **No user-facing text in the domain.** Errors, activities and notifications carry codes and data. Text is translated at the edge: API errors from `Accept-Language`, emails in the recipient's locale, everything else in `apps/web`.
16. **TypeORM stays in `infrastructure/`.** Repositories map `*.orm-entity.ts` rows to aggregates. `synchronize` stays off. Version checks are explicit `UPDATE … WHERE version = :v`, because `save()` doesn't compare versions.
17. **One set of GraphQL documents, two clients.** `src/lib/graphql/server.ts` on the server, `src/lib/graphql/browser.ts` in the browser. Never import the server client into a client component.

## Ubiquitous language

| Term | Meaning |
|---|---|
| Workspace | Group of boards and people (Trello "Organization") |
| Board / List / **Ticket** | Kanban hierarchy. Ticket = Trello "card" |
| Board role | `ADMIN` · `MEMBER` · `OBSERVER`. **Guest** = board member outside the workspace (derived, not stored) |
| Effective role | Board role, or `WORKSPACE_VIEWER` derived from visibility |
| Archived | Reversible removal (Trello "closed"). Delete is permanent |
| Position | Fractional-index string key |
| Activity | Append-only history entry. Notification = per-user inbox item derived from events |
| Watch | Subscription to a ticket's changes |

## Conventions

- **Naming:** files `kebab-case.ts`. Classes `PascalCase`. DB `snake_case` plural tables. GraphQL types `PascalCase`, fields `camelCase`, enums `SCREAMING_SNAKE`.
- **Domain events:** `<context>.<aggregate>.<past_tense>` (e.g. `board.ticket.moved`), versioned, envelope per [docs/05 §6](docs/05-domain-model.md#6-integration-event-envelope).
- **GraphQL mutations:** `verbNoun(input: VerbNounInput!): VerbNounPayload!`, optional `clientMutationId`. Errors use the codes in [docs/09 §3](docs/09-api-contract.md#3-error-model).
- **DB:** `text + CHECK` instead of PG enums. `timestamptz`. Forward-only migrations. Advanced constraints in handwritten SQL.
- **Time:** UTC everywhere. Inject a `Clock` port in domain/application code.
- **Tests:** Jest for the API and packages: domain = pure unit tests, application = in-memory repos, infrastructure = Testcontainers, HTTP and GraphQL = Supertest. Web = Playwright.
- **Commits:** Conventional Commits (`feat(board): …`, `fix(api): …`).

## Documentation rules

- Docs index: [docs/README.md](docs/README.md). Diagram catalogue: [docs/diagrams/README.md](docs/diagrams/README.md).
- **Diagrams live only in `docs/diagrams/<type>/NN-name.md`**, one Mermaid diagram per file. Types: `use-case`, `activity`, `sequence`, `state`, `class`, `erd`, `architecture`, `ui`. Numbered docs link to them and never embed diagrams.
- When code changes a documented flow, schema, event or contract, update the matching diagram/doc in the same change.
- New architectural decisions → append an ADR to [docs/11-decisions.md](docs/11-decisions.md). Never rewrite accepted ADRs, supersede them.

## Adding a feature (checklist)

1. Find or add the feature ID in [docs/02-product-scope.md](docs/02-product-scope.md) and its use case.
2. Domain: aggregate method + invariant + domain event (+ add the event to the catalog in docs/05).
3. Application: command/query + handler + policy check.
4. Infrastructure: repository/SQL changes + migration.
5. Interface: GraphQL input/payload, then regenerate `schema.gql` and the web codegen.
6. Realtime: projection in `packages/contracts` + client reducer.
7. Tests at each layer. Update the sequence/state diagram if the flow changed.
