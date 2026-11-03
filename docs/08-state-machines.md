# 08 · State machines (index)

> Every state diagram lives in its own file under [`diagrams/state/`](./diagrams/README.md#state-diagrams). State columns are `text + CHECK` ([06 §1](./06-database.md#1-conventions)), and transitions are enforced by aggregate methods. A transition that isn't drawn is rejected with a domain error.

## Domain entities

| # | Machine | Persisted in | Owner |
|---|---|---|---|
| 01 | [User account](./diagrams/state/01-user-account.md) | `users.status` | Identity |
| 02 | [Session](./diagrams/state/02-session.md) | `sessions.revoked_at`, `expires_at` | Identity |
| 03 | [Verification token](./diagrams/state/03-verification-token.md) | `verification_tokens.consumed_at`, `expires_at` | Identity |
| 04 | [Invitation](./diagrams/state/04-invitation.md) | `invitations.status` | Workspace |
| 05 | [Workspace membership](./diagrams/state/05-workspace-membership.md) | `workspace_members.role` | Workspace |
| 06 | [Board](./diagrams/state/06-board.md) | `boards.archived_at`, `visibility` | Board |
| 07 | [List](./diagrams/state/07-list.md) | `lists.archived_at` | Board |
| 08 | [Ticket](./diagrams/state/08-ticket.md) | `tickets.archived_at` | Board |
| 09 | [Ticket due status](./diagrams/state/09-ticket-due-status.md) | derived from `due_at`, `due_completed_at` | Board |
| 10 | [Attachment](./diagrams/state/10-attachment.md) | `attachments.status` | Storage |
| 11 | [Checklist item](./diagrams/state/11-checklist-item.md) | `checklist_items.completed_at` | Board |
| 12 | [Notification](./diagrams/state/12-notification.md) | `notifications.read_at` + email delivery | Notification |

## Infrastructure and client

| # | Machine | Where |
|---|---|---|
| 13 | [Outbox event](./diagrams/state/13-outbox-event.md) | `outbox_events.published_at`, `attempts` |
| 14 | [Ticket drag (client UI)](./diagrams/state/14-ticket-drag-ui.md) | `apps/web` board feature |
| 15 | [SSE client connection](./diagrams/state/15-sse-client-connection.md) | `apps/web` realtime hook |
| 16 | [RabbitMQ message consumption](./diagrams/state/16-message-consumption.md) | worker consumers |
