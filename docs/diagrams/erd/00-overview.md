# ERD · Overview (relationships only)

> Index: [06 · Database](../../06-database.md) · Detailed ERDs: [01 Identity and workspace](./01-identity-workspace.md) · [02 Board core](./02-board-core.md) · [03 Collaboration, storage, notification](./03-collaboration-storage-notification.md) · [04 Infrastructure](./04-infrastructure-tables.md)

```mermaid
erDiagram
  users ||--o| user_credentials : "has password"
  users ||--o{ sessions : "signs in with"
  users ||--o{ verification_tokens : "verifies with"
  users ||--o{ oauth_identities : "links (later)"

  workspaces ||--|{ workspace_members : has
  users ||--o{ workspace_members : "is"
  workspaces ||--o{ invitations : issues
  boards |o--o{ invitations : "scopes board invites"

  workspaces ||--o{ boards : contains
  boards ||--|{ board_members : has
  users ||--o{ board_members : "is"
  users ||--o{ board_stars : stars
  boards ||--o{ board_stars : "starred as"
  boards ||--o{ labels : defines
  boards ||--o{ lists : contains
  lists ||--o{ tickets : contains
  boards ||--o{ tickets : "denormalised board_id"
  tickets ||--o{ ticket_labels : tagged
  labels ||--o{ ticket_labels : "applied as"
  tickets ||--o{ ticket_assignees : "assigned to"
  users ||--o{ ticket_assignees : "works on"
  tickets ||--o{ checklists : has
  checklists ||--o{ checklist_items : has

  tickets ||--o{ ticket_watchers : "watched by"
  users ||--o{ ticket_watchers : watches
  tickets ||--o{ comments : has
  comments ||--o{ comment_mentions : mentions
  users ||--o{ comments : writes
  boards ||--o{ activities : logs

  tickets ||--o{ attachments : has
  tickets }o--o| attachments : "cover image"

  users ||--o{ notifications : receives
  users ||--o{ notification_preferences : "configures (P2)"
```

## Table groups

| Group | Tables | Context |
|---|---|---|
| Identity | `users`, `user_credentials`, `sessions`, `verification_tokens`, `oauth_identities` (later) | Identity |
| Workspace | `workspaces`, `workspace_members`, `invitations` | Workspace |
| Board | `boards`, `board_members`, `board_stars`, `labels`, `lists`, `tickets`, `ticket_labels`, `ticket_assignees`, `checklists`, `checklist_items` | Board |
| Collaboration | `comments`, `comment_mentions`, `comment_reactions` (P2), `ticket_watchers`, `activities` | Collaboration |
| Storage | `attachments` | Storage |
| Notification | `notifications`, `notification_preferences` (P2) | Notification |
| Infrastructure | `outbox_events`, `processed_messages` | shared |

Each context **owns** its tables: only that context's repositories write them. Other contexts read them only through ACL readers ([context map](../architecture/08-context-map.md)).
