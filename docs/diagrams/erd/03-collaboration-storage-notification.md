# ERD · Collaboration, storage, notification

> Index: [06 · Database §3](../../06-database.md#3-ddl-draft-postgresql-18) · Classes: [Collaboration](../class/05-collaboration.md), [Storage](../class/06-storage.md), [Notification](../class/07-notification.md)

```mermaid
erDiagram
  comments {
    uuid id PK
    uuid ticket_id FK
    uuid board_id FK "denormalised for feed queries"
    uuid author_id FK
    text body "markdown"
    timestamptz edited_at
    timestamptz created_at
  }
  comment_mentions {
    uuid comment_id PK, FK
    uuid user_id PK, FK
  }
  comment_reactions {
    uuid comment_id PK, FK
    uuid user_id PK, FK
    text emoji PK "P2"
    timestamptz created_at
  }
  ticket_watchers {
    uuid ticket_id PK, FK
    uuid user_id PK, FK
    timestamptz created_at
  }
  activities {
    uuid id PK "UUIDv7 = time order"
    uuid board_id FK
    uuid list_id "no FK, survives deletion"
    uuid ticket_id "no FK, survives deletion"
    uuid actor_id FK
    text type "ticket.moved, comment.created ..."
    jsonb data "snapshot of names at the time"
    timestamptz created_at
  }
  attachments {
    uuid id PK
    uuid board_id FK
    uuid ticket_id FK
    uuid uploaded_by FK
    text kind "file / link"
    text status "pending / ready / failed"
    text file_name
    text mime_type
    bigint size_bytes
    text checksum_sha256
    text bucket
    text object_key UK
    text preview_key
    int width
    int height
    text link_url
    timestamptz created_at
    timestamptz updated_at
  }
  notifications {
    uuid id PK
    uuid recipient_id FK
    text type
    uuid actor_id FK
    uuid board_id "no FK"
    uuid ticket_id "no FK"
    uuid source_event_id "dedupe key"
    jsonb data
    timestamptz read_at
    timestamptz created_at
  }
  notification_preferences {
    uuid user_id PK, FK
    text type PK
    text channel PK "in_app / email"
    bool enabled
  }
  tickets {
    uuid id PK
  }
  boards {
    uuid id PK
  }
  users {
    uuid id PK
  }

  tickets ||--o{ comments : has
  users ||--o{ comments : writes
  comments ||--o{ comment_mentions : mentions
  users ||--o{ comment_mentions : "mentioned"
  comments ||--o{ comment_reactions : "reacted (P2)"
  tickets ||--o{ ticket_watchers : "watched by"
  users ||--o{ ticket_watchers : watches
  boards ||--o{ activities : logs
  users ||--o{ activities : performs
  tickets ||--o{ attachments : has
  boards ||--o{ attachments : "board_id (denormalised)"
  users ||--o{ notifications : receives
  users ||--o{ notification_preferences : configures
```

## Notes

- `activities.list_id` / `ticket_id` and `notifications.board_id` / `ticket_id` intentionally have **no FK**. History and notifications must survive deletion ("X deleted ticket #42"). The `data` snapshot holds the display names.
- `notifications (recipient_id, source_event_id)` is **unique**. A redelivered RabbitMQ message can't create duplicates, even without the inbox table.
