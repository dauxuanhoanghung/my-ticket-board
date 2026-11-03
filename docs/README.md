# Ticket Board · Design documentation

A Trello-style Kanban collaboration app. **Status: pre-implementation.** These docs are the design baseline for scaffolding the monorepo.

## Documents

| # | Document | What's inside |
|---|---|---|
| 01 | [Trello analysis](./01-trello-analysis.md) | Trello's object model, component inventory, permission model, UI anatomy, behaviours worth copying, terminology mapping |
| 02 | [Product scope](./02-product-scope.md) | Actors, feature catalogue with IDs and phases, permission matrix, limits, NFRs, roadmap |
| 03 | [Use cases (index)](./03-use-cases.md) | Use case diagrams, detailed specs, activity diagrams, traceability |
| 04 | [Architecture](./04-architecture.md) | C4 context/containers, monorepo layout, backend DDD layering, frontend BFF, cross-cutting concerns, deployment |
| 05 | [Domain model](./05-domain-model.md) | Bounded contexts, aggregates, commands, **domain events catalog**, event envelope |
| 06 | [Database](./06-database.md) | Conventions, ERDs, **full PostgreSQL DDL**, ordering, locking, key queries, retention |
| 07 | [Sequence flows (index)](./07-sequence-flows.md) | 23 sequence diagrams: auth, workspace, board, realtime, storage, messaging, cache, i18n |
| 08 | [State machines (index)](./08-state-machines.md) | 16 state diagrams: domain entities, outbox, client UI, SSE, consumers |
| 09 | [API contract](./09-api-contract.md) | GraphQL SDL draft, error codes, HTTP endpoints, **SSE wire contract** |
| 10 | [Infrastructure](./10-infrastructure.md) | `compose.yml` draft, env vars, cache and delivery facades, RabbitMQ, RustFS, images, CI, observability |
| 11 | [Decisions](./11-decisions.md) | ADR log, resolved questions, and **what to verify at init** |
| 12 | [Internationalisation](./12-internationalisation.md) | Locale resolution, web and API setup, what gets translated |
| 13 | [File uploads](./13-file-uploads.md) | Presigned PUT flow, NestJS and Next.js design, long uploads, avatars, security, RustFS checks |
| — | [Diagrams catalogue](./diagrams/README.md) | All 83 diagrams by type: use-case · activity · sequence · state · class · erd · architecture · ui |

## Suggested reading order

1. **Product:** 01 → 02 → 03
2. **Engineering:** 04 → 05 → 06 → [Sequence 11 (move ticket)](./diagrams/sequence/11-move-ticket-realtime.md) → 09 → 10
3. **Before scaffolding:** 11 (verify-at-init checks)

## Tech stack (fixed by requirements)

NestJS (TypeScript, DDD, GraphQL + HTTP, TypeORM, Jest) · Next.js App Router as BFF (GraphQL to the API, Playwright) · Tailwind + shadcn/ui in a shared package · dnd-kit · PostgreSQL · Redis / Valkey / Memcached behind a cache Facade · email behind a delivery Facade · RabbitMQ · RustFS (S3-compatible) · SSE for realtime · i18n with next-intl and nestjs-i18n · Docker Compose · Turborepo.
