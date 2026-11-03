# ERD · Identity and workspace

> Index: [06 · Database §3](../../06-database.md#3-ddl-draft-postgresql-18) · Classes: [Identity](../class/02-identity.md), [Workspace](../class/03-workspace.md)

```mermaid
erDiagram
  users {
    uuid id PK "UUIDv7, app-generated"
    citext email UK
    timestamptz email_verified_at
    citext username UK
    text full_name
    text initials
    text avatar_key "object key in tb-public"
    text bio
    text locale
    text time_zone
    text status "pending_verification / active / suspended / deleted"
    timestamptz created_at
    timestamptz updated_at
    timestamptz deleted_at
  }
  user_credentials {
    uuid user_id PK, FK
    text password_hash "argon2id"
    timestamptz password_changed_at
    int failed_attempts
    timestamptz locked_until
  }
  oauth_identities {
    uuid id PK
    uuid user_id FK
    text provider "google / github"
    text provider_subject
    citext email
    timestamptz created_at
  }
  sessions {
    uuid id PK "also the JWT sid claim"
    uuid user_id FK
    bytea refresh_token_hash UK "sha256"
    bytea previous_token_hash "grace window reuse"
    timestamptz rotated_at
    text user_agent
    inet ip_address
    timestamptz created_at
    timestamptz last_used_at
    timestamptz expires_at
    timestamptz revoked_at
    text revoke_reason
  }
  verification_tokens {
    uuid id PK
    uuid user_id FK
    text purpose "email_verification / password_reset / email_change"
    bytea token_hash UK
    citext new_email "email_change only"
    timestamptz expires_at
    timestamptz consumed_at
    timestamptz created_at
  }
  workspaces {
    uuid id PK
    text name
    citext slug UK
    text description
    text logo_key
    text board_creation_policy "admins / members"
    uuid created_by FK
    timestamptz created_at
    timestamptz updated_at
    timestamptz deleted_at
  }
  workspace_members {
    uuid workspace_id PK, FK
    uuid user_id PK, FK
    text role "admin / member"
    uuid invited_by FK
    timestamptz joined_at
  }
  invitations {
    uuid id PK
    uuid workspace_id FK
    uuid board_id FK "null = workspace invite"
    text kind "email / link"
    citext email "required when kind = email"
    text role
    bytea token_hash UK "null until issued by the worker"
    text status "pending / accepted / declined / revoked / expired"
    uuid invited_by FK
    uuid accepted_by FK
    timestamptz expires_at
    timestamptz responded_at
    timestamptz created_at
  }
  boards {
    uuid id PK
    uuid workspace_id FK
  }

  users ||--o| user_credentials : "has password"
  users ||--o{ oauth_identities : links
  users ||--o{ sessions : has
  users ||--o{ verification_tokens : has
  users ||--o{ workspaces : "created"
  workspaces ||--|{ workspace_members : has
  users ||--o{ workspace_members : "member of"
  workspaces ||--o{ invitations : issues
  boards |o--o{ invitations : "board-scoped"
  users ||--o{ invitations : "invited by"
```

`boards` is shown as a stub. Its full definition is in [ERD 02](./02-board-core.md).
