# 07 · Sequence flows (index)

> Every sequence diagram lives in its own file under [`diagrams/sequence/`](./diagrams/README.md#sequence-diagrams).

## Participants legend

| Alias | Participant |
|---|---|
| `U` / actor | Human user |
| `B` | Browser (React client components, EventSource) |
| `N` / `P` | Next.js BFF: Server Actions, route handlers (`/api/graphql`, `/api/realtime`, `/api/files`), `proxy.ts` |
| `A` / `API` | NestJS API instance (GraphQL + REST + SSE gateway) |
| `RT` | Realtime gateway inside an API instance |
| `R` | Outbox relay inside the worker (single leader) |
| `W*` | Worker consumers (identity mailer, notification, email, preview) |
| `DB` | PostgreSQL |
| `C` / `F` / `D` | Cache: CacheFacade and its driver (Valkey / Redis / Memcached) |
| `MQ` | RabbitMQ |
| `S3` | RustFS |
| `M` | SMTP (Mailpit in development) |

## Flows

| # | Flow | Highlights | Features |
|---|---|---|---|
| 01 | [Sign up and verify email](./diagrams/sequence/01-sign-up-and-verify-email.md) | anti-enumeration, worker-issued token, auto sign-in | ACC-01, 02 |
| 02 | [Log in](./diagrams/sequence/02-login.md) | rate limit, constant-time verify, cookie session | ACC-03 |
| 03 | [Silent session refresh](./diagrams/sequence/03-silent-session-refresh.md) | `proxy.ts`, rotation, grace window, reuse detection | ACC-04 |
| 04 | [Log out and session revocation](./diagrams/sequence/04-logout-and-session-revocation.md) | revoked-sid marker, SSE close | ACC-03 |
| 05 | [Forgot / reset password](./diagrams/sequence/05-password-reset.md) | same response always, revoke all sessions | ACC-05 |
| 06 | [Create workspace](./diagrams/sequence/06-create-workspace.md) | slug conflict handling | WSP-01 |
| 07 | [Invite and accept invitation](./diagrams/sequence/07-invite-and-accept-invitation.md) | login redirect, workspace vs board scope, guests | WSP-04, 05 |
| 08 | [Create board](./diagrams/sequence/08-create-board.md) | creation policy, default labels, template | BRD-01 |
| 09 | [Open board](./diagrams/sequence/09-open-board.md) | SSR snapshot, cache-aside, subscribe-then-refetch | BRD, RT-01 |
| 10 | [Create ticket](./diagrams/sequence/10-create-ticket.md) | client UUIDv7, idempotent create, number allocation | TKT-01 |
| 11 | [**Move ticket with realtime fan-out**](./diagrams/sequence/11-move-ticket-realtime.md) | optimistic UI, list lock, outbox, RabbitMQ, SSE | TKT-04, RT-01 |
| 12 | [Concurrent moves into the same slot](./diagrams/sequence/12-concurrent-moves.md) | serialisation, neighbour re-resolution, convergence | TKT-04 |
| 13 | [Move ticket to another board](./diagrams/sequence/13-move-ticket-across-boards.md) | label remap, renumber, two-board realtime | TKT-05 |
| 14 | [Edit description with conflict](./diagrams/sequence/14-edit-description-conflict.md) | `expectedVersion`, conflict dialog | TKT-03 |
| 15 | [Comment with mention → notification](./diagrams/sequence/15-comment-mention-notification.md) | parallel realtime and notification paths | TKT-12, NTF-01, 02 |
| 16 | [Attachment upload](./diagrams/sequence/16-attachment-upload.md) | presigned PUT with retries, HEAD verification, previews | TKT-10 |
| 17 | [Attachment download](./diagrams/sequence/17-attachment-download.md) | permission check + time-bucketed presigned GET | TKT-10 |
| 18 | [Outbox relay and consumers](./diagrams/sequence/18-outbox-relay-and-consumers.md) | LISTEN/NOTIFY, leader lock, retry and DLQ, idempotency | infra |
| 19 | [SSE connection lifecycle](./diagrams/sequence/19-sse-connection-lifecycle.md) | BFF stream proxy, heartbeats, revocation, token expiry | RT-01, 02 |
| 20 | [Due-date reminder](./diagrams/sequence/20-due-date-reminder.md) | scheduler with SKIP LOCKED | TKT-16, NTF-05 |
| 21 | [Cache-aside and invalidation](./diagrams/sequence/21-cache-aside-and-invalidation.md) | facade, single-flight, tag versioning, fail-open | infra |
| 22 | [Locale propagation](./diagrams/sequence/22-locale-propagation.md) | `tb_locale` cookie, `Accept-Language` to the API, recipient locale in the worker | I18N-01…04 |
| 23 | [Avatar and logo upload](./diagrams/sequence/23-image-upload.md) | private `incoming/` key, worker re-encodes into `tb-public`, result by SSE | ACC-06, WSP-02 |

## Reading order for newcomers

1. **11** (the core loop) → **18** (how events travel) → **19** (how they reach browsers)
2. **02 → 03** (how auth works through the BFF)
3. **16** (storage) and **21** (cache)
