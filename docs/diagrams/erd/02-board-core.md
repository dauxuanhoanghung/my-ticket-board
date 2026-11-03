# ERD · Board core (boards, lists, tickets, checklists)

> Index: [06 · Database §3](../../06-database.md#3-ddl-draft-postgresql-18) · Class: [Board context](../class/04-board.md)

```mermaid
erDiagram
  boards {
    uuid id PK
    uuid workspace_id FK
    text short_id UK "8-char base62, used in URLs"
    text name
    text description
    text visibility "private / workspace"
    text background_kind "color / gradient / image"
    text background_value
    text comment_policy "disabled / members / observers / workspace"
    text invite_policy "admins / members"
    bool self_join
    jsonb prefs "UI-only prefs"
    int ticket_seq "last issued ticket number"
    int version
    uuid created_by FK
    timestamptz archived_at
    timestamptz created_at
    timestamptz updated_at
  }
  board_members {
    uuid board_id PK, FK
    uuid user_id PK, FK
    text role "admin / member / observer"
    uuid added_by FK
    timestamptz joined_at
  }
  board_stars {
    uuid user_id PK, FK
    uuid board_id PK, FK
    text position "COLLATE C"
    timestamptz created_at
  }
  labels {
    uuid id PK
    uuid board_id FK
    text name "may be empty"
    text color "nullable = no color"
    timestamptz created_at
    timestamptz updated_at
  }
  lists {
    uuid id PK
    uuid board_id FK "UNIQUE (id, board_id)"
    text name
    text position "COLLATE C"
    int wip_limit
    int version
    timestamptz archived_at
    timestamptz created_at
    timestamptz updated_at
  }
  tickets {
    uuid id PK
    uuid board_id FK "composite FK with list_id"
    uuid list_id FK
    text short_id UK
    int number "UNIQUE (board_id, number) deferrable"
    text title
    text description "markdown"
    text position "COLLATE C"
    timestamptz start_at
    timestamptz due_at
    int due_reminder_minutes
    timestamptz due_reminder_at "computed by app"
    timestamptz due_reminded_at
    timestamptz due_completed_at
    text cover_kind "color / attachment"
    text cover_color
    uuid cover_attachment_id FK
    text cover_size "normal / full"
    int version
    uuid created_by FK
    timestamptz archived_at
    timestamptz created_at
    timestamptz updated_at
  }
  ticket_labels {
    uuid ticket_id PK, FK
    uuid label_id PK, FK
    timestamptz created_at
  }
  ticket_assignees {
    uuid ticket_id PK, FK
    uuid user_id PK, FK
    uuid assigned_by FK
    timestamptz assigned_at
  }
  checklists {
    uuid id PK
    uuid ticket_id FK "UNIQUE (id, ticket_id)"
    text title
    text position "COLLATE C"
    int version
    timestamptz created_at
    timestamptz updated_at
  }
  checklist_items {
    uuid id PK
    uuid checklist_id FK
    uuid ticket_id FK "denormalised, composite FK"
    text content
    text position "COLLATE C"
    timestamptz completed_at
    uuid completed_by FK
    uuid assignee_id FK "P2"
    timestamptz due_at "P2"
    timestamptz created_at
    timestamptz updated_at
  }
  users {
    uuid id PK
  }

  boards ||--|{ board_members : has
  users ||--o{ board_members : "member of"
  users ||--o{ board_stars : stars
  boards ||--o{ board_stars : "starred as"
  boards ||--o{ labels : defines
  boards ||--o{ lists : contains
  lists ||--o{ tickets : contains
  boards ||--o{ tickets : "board_id (denormalised)"
  tickets ||--o{ ticket_labels : has
  labels ||--o{ ticket_labels : "applied as"
  tickets ||--o{ ticket_assignees : has
  users ||--o{ ticket_assignees : "assigned"
  tickets ||--o{ checklists : has
  checklists ||--o{ checklist_items : has
  tickets ||--o{ checklist_items : "ticket_id (denormalised)"
```

## Integrity tricks worth noting

- **`tickets (list_id, board_id) → lists (id, board_id)`** composite FK with `ON UPDATE CASCADE`. The denormalised `board_id` can never disagree with the list's board, and moving a list to another board drags its tickets along.
- **`checklist_items (checklist_id, ticket_id) → checklists (id, ticket_id)`**. Same idea, so badge counts can group by `ticket_id` without a join.
- **`UNIQUE (board_id, number) DEFERRABLE INITIALLY DEFERRED`** lets a cross-board transfer renumber inside one transaction.
- **Partial unique `(list_id, position) WHERE archived_at IS NULL`**. Archived rows keep their old key and get a fresh one on restore.
