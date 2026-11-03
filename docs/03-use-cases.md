# 03 · Use cases and activity diagrams (index)

> Each diagram lives in its own file under [`docs/diagrams/`](./diagrams/README.md). This page indexes them and traces use cases to features and bounded contexts.
>
> **Notation:** Mermaid has no native use case diagram, so these use a flowchart convention. **Actors** are bold text nodes, **use cases** are stadium shapes `([ ])` inside a **system boundary** subgraph, and `«include»` / `«extend»` are dotted arrows.

---

## 1. Use case diagrams

| # | Diagram | Scope | Detailed specs inside |
|---|---|---|---|
| 00 | [Actor generalisation](./diagrams/use-case/00-actors.md) | Who inherits whose capabilities | — |
| 01 | [Account and identity](./diagrams/use-case/01-account.md) | ACC-01…12 | UC-ACC-01 Sign up · UC-ACC-03/04 Log in and refresh |
| 02 | [Workspace and membership](./diagrams/use-case/02-workspace.md) | WSP-01…12 | UC-WSP-04/05 Invite and accept · UC-WSP-07/08 Roles and removal |
| 03 | [Board management](./diagrams/use-case/03-board.md) | BRD-01…18 | UC-BRD-01 Create board · UC-BRD-09/10 Archive and delete |
| 04 | [List and ticket management](./diagrams/use-case/04-list-and-ticket.md) | LST-*, TKT-01…09, 11, 14, 15 | UC-TKT-04 Move ticket · UC-TKT-05 Cross-board move · UC-TKT-03 Edit with conflict |
| 05 | [Collaboration](./diagrams/use-case/05-collaboration.md) | TKT-10, 12, 13, NTF-* | UC-TKT-12 Comment with mention · UC-TKT-10 Upload attachment |
| 06 | [Background processing](./diagrams/use-case/06-background.md) | Scheduler / worker / API | Job schedule table |

## 2. Activity diagrams

| # | Diagram | Purpose |
|---|---|---|
| 01 | [First-run onboarding](./diagrams/activity/01-onboarding.md) | Sign-up → verify → first workspace/board or join via invitation |
| 02 | [Accept invitation](./diagrams/activity/02-accept-invitation.md) | Token validation, login redirect, workspace vs board scope, guest creation |
| 03 | [Authorization resolution](./diagrams/activity/03-authorization-resolution.md) | How the effective board role is computed before every board-scoped operation |
| 04 | [Move ticket: position resolution](./diagrams/activity/04-move-ticket-position.md) | Locking, neighbour re-resolution, fractional key, cross-board branch |
| 05 | [Notification fan-out](./diagrams/activity/05-notification-fanout.md) | Recipient computation per event type, idempotency, email branch |

---

## 3. Traceability: use case group → features → bounded context

| Use case group | Features | Bounded context(s) | Sequences |
|---|---|---|---|
| Account | ACC-01…12 | Identity | [01](./diagrams/sequence/01-sign-up-and-verify-email.md)–[05](./diagrams/sequence/05-password-reset.md) |
| Workspace | WSP-01…12 | Workspace | [06](./diagrams/sequence/06-create-workspace.md), [07](./diagrams/sequence/07-invite-and-accept-invitation.md) |
| Board | BRD-01…18 | Board | [08](./diagrams/sequence/08-create-board.md), [09](./diagrams/sequence/09-open-board.md) |
| Lists and tickets | LST-*, TKT-01…09, 11, 14, 15 | Board | [10](./diagrams/sequence/10-create-ticket.md)–[14](./diagrams/sequence/14-edit-description-conflict.md) |
| Comments, watch, activity | TKT-12, 13, BRD-11 | Collaboration | [15](./diagrams/sequence/15-comment-mention-notification.md) |
| Attachments | TKT-10 | Storage (+ Board for covers) | [16](./diagrams/sequence/16-attachment-upload.md), [17](./diagrams/sequence/17-attachment-download.md) |
| Notifications | NTF-* | Notification | [15](./diagrams/sequence/15-comment-mention-notification.md), [20](./diagrams/sequence/20-due-date-reminder.md) |
| Realtime | RT-* | Realtime (infrastructure) | [11](./diagrams/sequence/11-move-ticket-realtime.md), [19](./diagrams/sequence/19-sse-connection-lifecycle.md) |
| Background | — | all | [18](./diagrams/sequence/18-outbox-relay-and-consumers.md), [20](./diagrams/sequence/20-due-date-reminder.md) |
