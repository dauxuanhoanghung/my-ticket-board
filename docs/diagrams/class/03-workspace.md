# Class · Workspace context

> Index: [05 · Domain model §3.2](../../05-domain-model.md#32-workspace) · Tables: [ERD 01](../erd/01-identity-workspace.md) · States: [Invitation](../state/04-invitation.md), [Membership](../state/05-workspace-membership.md)

```mermaid
classDiagram
  direction LR
  class Workspace {
    <<AggregateRoot>>
    +WorkspaceId id
    +WorkspaceName name
    +Slug slug
    +String description
    +String logoKey
    +BoardCreationPolicy boardCreationPolicy
    +DateTime deletedAt
    +create(name, slug, creatorId)$ Workspace
    +rename(name) void
    +changeSlug(slug) void
    +addMember(userId, role, invitedBy) void
    +changeRole(userId, role) void
    +removeMember(userId) void
    +leave(userId) void
    +setBoardCreationPolicy(policy) void
    +canCreateBoard(userId) boolean
    +delete(now) void
  }
  class WorkspaceMember {
    <<Entity>>
    +UserId userId
    +WorkspaceRole role
    +DateTime joinedAt
    +UserId invitedBy
  }
  class Invitation {
    <<AggregateRoot>>
    +InvitationId id
    +InvitationScope scope
    +InvitationKind kind
    +Email email
    +String role
    +TokenHash tokenHash
    +InvitationStatus status
    +UserId invitedBy
    +DateTime expiresAt
    +UserId acceptedBy
    +issue(scope, email, role, invitedBy, ttl)$ Invitation
    +accept(userId, now) void
    +decline(userId, now) void
    +revoke(by, now) void
    +expire(now) void
  }
  class InvitationScope {
    <<ValueObject>>
    +WorkspaceId workspaceId
    +BoardId boardId
    +isBoardScoped() boolean
  }
  class Slug {
    <<ValueObject>>
    +String value
    +fromName(name)$ Slug
  }
  class WorkspaceRole {
    <<enumeration>>
    ADMIN
    MEMBER
  }
  class BoardCreationPolicy {
    <<enumeration>>
    ADMINS
    MEMBERS
  }
  class InvitationStatus {
    <<enumeration>>
    PENDING
    ACCEPTED
    DECLINED
    REVOKED
    EXPIRED
  }
  class InvitationKind {
    <<enumeration>>
    EMAIL
    LINK
  }
  class BoardMembershipWriter {
    <<port>>
    +addBoardMember(boardId, userId, role) void
  }

  Workspace "1" *-- "1..*" WorkspaceMember : at least one ADMIN
  WorkspaceMember --> WorkspaceRole
  Workspace --> Slug
  Workspace --> BoardCreationPolicy
  Invitation --> InvitationScope
  Invitation --> InvitationStatus
  Invitation --> InvitationKind
  Invitation ..> Workspace : scope.workspaceId
  Invitation ..> BoardMembershipWriter : board-scoped accept
```

## Invariants

| Invariant | Enforced by |
|---|---|
| ≥ 1 `ADMIN` at all times | `Workspace.changeRole/removeMember/leave` → `LastAdminError` |
| Slug `^[a-z0-9-]{3,50}$`, globally unique | `Slug` VO + `citext UNIQUE` |
| One pending email invitation per (scope, email) | partial unique index |
| Accept only when `PENDING` and not expired | `Invitation.accept` |
| Board-scoped invite role ∈ {ADMIN, MEMBER, OBSERVER}. Workspace-scoped ∈ {ADMIN, MEMBER} | `Invitation.issue` |

**Accepting a board-scoped invitation** crosses into the Board context. The `AcceptInvitationHandler` calls the `BoardMembershipWriter` port inside the same transaction. It's implemented by the Board module's application service, not by direct table writes, so Board invariants still apply.
