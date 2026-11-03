# Diagrams catalogue

All diagrams are **Mermaid in Markdown**, **one diagram per file**, grouped by diagram type. The numbered docs in [`docs/`](../README.md) are indexes and prose that link here.

## Conventions

| Rule | Detail |
|---|---|
| Location | `docs/diagrams/<type>/NN-kebab-name.md` |
| Types | `use-case` · `activity` · `sequence` · `state` · `class` · `erd` · `architecture` · `ui` |
| File layout | `# <Type> · <Title>` → one `>` line with **Index** link + related diagrams → the diagram → short notes/tables |
| One diagram per file | If a second diagram is needed, create a second file and cross-link |
| Numbering | Stable once published. New diagrams take the next number. Don't renumber |
| Use cases | Mermaid has no use case type: flowchart with actors (bold text), stadium use cases `([ ])`, a system-boundary subgraph, dotted `«include»` / `«extend»` |
| Viewing | GitHub renders Mermaid natively. In VS Code, install **Markdown Preview Mermaid Support** (`bierner.markdown-mermaid`) |
| Keep in sync | A change to a flow in code that changes a diagram updates the diagram in the same PR |

---

## Use case diagrams

Index: [03 · Use cases](../03-use-cases.md)

| # | Diagram |
|---|---|
| 00 | [Actor generalisation](./use-case/00-actors.md) |
| 01 | [Account and identity](./use-case/01-account.md) |
| 02 | [Workspace and membership](./use-case/02-workspace.md) |
| 03 | [Board management](./use-case/03-board.md) |
| 04 | [List and ticket management](./use-case/04-list-and-ticket.md) |
| 05 | [Collaboration: comments, attachments, notifications](./use-case/05-collaboration.md) |
| 06 | [Background processing](./use-case/06-background.md) |

## Activity diagrams

Index: [03 · Use cases §2](../03-use-cases.md#2-activity-diagrams)

| # | Diagram |
|---|---|
| 01 | [First-run onboarding](./activity/01-onboarding.md) |
| 02 | [Accept invitation](./activity/02-accept-invitation.md) |
| 03 | [Authorization resolution](./activity/03-authorization-resolution.md) |
| 04 | [Move ticket: position resolution](./activity/04-move-ticket-position.md) |
| 05 | [Notification fan-out](./activity/05-notification-fanout.md) |

## Sequence diagrams

Index: [07 · Sequence flows](../07-sequence-flows.md)

| # | Diagram |
|---|---|
| 01 | [Sign up and verify email](./sequence/01-sign-up-and-verify-email.md) |
| 02 | [Log in](./sequence/02-login.md) |
| 03 | [Silent session refresh](./sequence/03-silent-session-refresh.md) |
| 04 | [Log out and session revocation](./sequence/04-logout-and-session-revocation.md) |
| 05 | [Forgot / reset password](./sequence/05-password-reset.md) |
| 06 | [Create workspace](./sequence/06-create-workspace.md) |
| 07 | [Invite and accept invitation](./sequence/07-invite-and-accept-invitation.md) |
| 08 | [Create board](./sequence/08-create-board.md) |
| 09 | [Open board](./sequence/09-open-board.md) |
| 10 | [Create ticket](./sequence/10-create-ticket.md) |
| 11 | [Move ticket with realtime fan-out](./sequence/11-move-ticket-realtime.md) |
| 12 | [Concurrent moves into the same slot](./sequence/12-concurrent-moves.md) |
| 13 | [Move ticket to another board](./sequence/13-move-ticket-across-boards.md) |
| 14 | [Edit description with conflict](./sequence/14-edit-description-conflict.md) |
| 15 | [Comment with mention → notification](./sequence/15-comment-mention-notification.md) |
| 16 | [Attachment upload](./sequence/16-attachment-upload.md) |
| 17 | [Attachment download](./sequence/17-attachment-download.md) |
| 18 | [Outbox relay and consumers](./sequence/18-outbox-relay-and-consumers.md) |
| 19 | [SSE connection lifecycle](./sequence/19-sse-connection-lifecycle.md) |
| 20 | [Due-date reminder](./sequence/20-due-date-reminder.md) |
| 21 | [Cache-aside and invalidation](./sequence/21-cache-aside-and-invalidation.md) |
| 22 | [Locale propagation](./sequence/22-locale-propagation.md) |
| 23 | [Avatar and logo upload](./sequence/23-image-upload.md) |

## State diagrams

Index: [08 · State machines](../08-state-machines.md)

| # | Diagram |
|---|---|
| 01 | [User account](./state/01-user-account.md) |
| 02 | [Session](./state/02-session.md) |
| 03 | [Verification token](./state/03-verification-token.md) |
| 04 | [Invitation](./state/04-invitation.md) |
| 05 | [Workspace membership](./state/05-workspace-membership.md) |
| 06 | [Board](./state/06-board.md) |
| 07 | [List](./state/07-list.md) |
| 08 | [Ticket](./state/08-ticket.md) |
| 09 | [Ticket due status](./state/09-ticket-due-status.md) |
| 10 | [Attachment](./state/10-attachment.md) |
| 11 | [Checklist item](./state/11-checklist-item.md) |
| 12 | [Notification](./state/12-notification.md) |
| 13 | [Outbox event](./state/13-outbox-event.md) |
| 14 | [Ticket drag (client UI)](./state/14-ticket-drag-ui.md) |
| 15 | [SSE client connection](./state/15-sse-client-connection.md) |
| 16 | [RabbitMQ message consumption](./state/16-message-consumption.md) |

## Class diagrams

Index: [05 · Domain model](../05-domain-model.md)

| # | Diagram |
|---|---|
| 00 | [Trello object model (reference)](./class/00-trello-object-model.md) |
| 01 | [Shared kernel](./class/01-shared-kernel.md) |
| 02 | [Identity](./class/02-identity.md) |
| 03 | [Workspace](./class/03-workspace.md) |
| 04 | [Board (core)](./class/04-board.md) |
| 05 | [Collaboration](./class/05-collaboration.md) |
| 06 | [Storage](./class/06-storage.md) |
| 07 | [Notification](./class/07-notification.md) |
| 08 | [Cache facade](./class/08-cache-facade.md) |
| 09 | [Delivery facade](./class/09-delivery-facade.md) |

## Entity-relationship diagrams

Index: [06 · Database](../06-database.md)

| # | Diagram |
|---|---|
| 00 | [Overview (relationships only)](./erd/00-overview.md) |
| 01 | [Identity and workspace](./erd/01-identity-workspace.md) |
| 02 | [Board core](./erd/02-board-core.md) |
| 03 | [Collaboration, storage, notification](./erd/03-collaboration-storage-notification.md) |
| 04 | [Infrastructure tables](./erd/04-infrastructure-tables.md) |

## Architecture diagrams

Indexes: [04 · Architecture](../04-architecture.md) · [10 · Infrastructure](../10-infrastructure.md)

| # | Diagram |
|---|---|
| 01 | [System context (C4 L1)](./architecture/01-system-context.md) |
| 02 | [Containers (C4 L2)](./architecture/02-containers.md) |
| 03 | [Turborepo task graph](./architecture/03-turbo-task-graph.md) |
| 04 | [Backend layering](./architecture/04-backend-layering.md) |
| 05 | [Command pipeline](./architecture/05-command-pipeline.md) |
| 06 | [Realtime fan-out](./architecture/06-realtime-fanout.md) |
| 07 | [Deployment view](./architecture/07-deployment.md) |
| 08 | [DDD context map](./architecture/08-context-map.md) |
| 09 | [RabbitMQ topology](./architecture/09-rabbitmq-topology.md) |
| 10 | [Docker Compose services](./architecture/10-compose-services.md) |
| 11 | [CI/CD pipeline](./architecture/11-ci-pipeline.md) |
| 12 | [Realtime scale path](./architecture/12-realtime-scale-path.md) |

## UI diagrams

Index: [01 · Trello analysis §4](../01-trello-analysis.md#4-ui-anatomy)

| # | Diagram |
|---|---|
| 01 | [Screen map](./ui/01-screen-map.md) |
| 02 | [Board view wireframe](./ui/02-board-view-wireframe.md) |
| 03 | [Ticket front wireframe](./ui/03-ticket-card-wireframe.md) |
| 04 | [Ticket detail wireframe](./ui/04-ticket-detail-wireframe.md) |
| 05 | [Frontend component tree](./ui/05-component-tree.md) |
