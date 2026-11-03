# 05 · Domain model (DDD)

> Strategic design (bounded contexts), tactical building blocks, aggregates per context, and the domain-event catalog. Class diagrams live in [`diagrams/class/`](./diagrams/README.md#class-diagrams).

---

## 1. Strategic design

**Diagram →** [Context map](./diagrams/architecture/08-context-map.md)

| Context | Type | Responsibility | Ubiquitous language |
|---|---|---|---|
| **Identity** | Generic | Accounts, credentials, sessions, email verification, password reset | User, Session, Credential, Verification token |
| **Workspace** | Supporting | Workspaces, workspace membership, invitations | Workspace, Member, Admin, Invitation, Guest |
| **Board** | **Core** | Boards, board membership, labels, lists, tickets, checklists, ordering, policies | Board, List, Ticket, Label, Assignee, Checklist, Position, Archive |
| **Collaboration** | Supporting | Comments, mentions, watching, activity feed | Comment, Mention, Watch, Activity |
| **Storage** | Generic | Attachment lifecycle, object storage, previews | Attachment, Object key, Preview |
| **Notification** | Supporting | Who gets told what, via which channel | Notification, Recipient, Preference, Channel |
| **Realtime** | Infrastructure | Pushing state changes to connected clients | Stream, Channel, Client event |

Trello's own model, for reference: [Trello object model](./diagrams/class/00-trello-object-model.md).

---

## 2. Tactical building blocks

**Diagram →** [Shared kernel](./diagrams/class/01-shared-kernel.md)

| Building block | Rule of thumb in this codebase |
|---|---|
| **Aggregate root** | Consistency boundary = one transaction. Reference other aggregates **by id only** |
| **Entity** | Lives inside an aggregate (e.g. `BoardMember`, `ChecklistItem`). Never loaded on its own |
| **Value object** | Immutable, validated on construction (`Email`, `Position`, `TicketDates`). Equality by value |
| **Domain event** | Past-tense fact raised by an aggregate method. Becomes an activity row and an outbox row |
| **Domain service** | Logic spanning aggregates without a natural home (`TicketTransferService`, `RecipientResolver`) |
| **Repository** | One per aggregate. Interface in `domain/`, SQL implementation in `infrastructure/` |
| **Port** | Interface for anything external or cross-context (ACL readers, storage, mailer, clock) |
| **Policy** | Application-layer authorization (`BoardPolicy`), fed by the effective role ([activity](./diagrams/activity/03-authorization-resolution.md)) |
| **Read model** | Query-side DTOs built by read repositories (board snapshot, activity feed). They skip aggregates |

---

## 3. Bounded contexts

### 3.1 Identity

**Diagram →** [Identity class diagram](./diagrams/class/02-identity.md)

| Aggregate | Commands |
|---|---|
| `User` | `RegisterUser`, `VerifyEmail`, `ResendVerification`, `UpdateProfile`, `SetAvatar` (worker), `ChangePassword`, `RequestPasswordReset`, `ResetPassword`, `ChangeEmail` (P2), `DeleteAccount` (P2) |
| `Session` | `Login`, `RefreshSession`, `Logout`, `RevokeSession` (P2 UI) |
| `VerificationToken` | `IssueVerificationToken` (worker), `ConsumeToken` |

### 3.2 Workspace

**Diagram →** [Workspace class diagram](./diagrams/class/03-workspace.md)

| Aggregate | Commands |
|---|---|
| `Workspace` | `CreateWorkspace`, `UpdateWorkspace`, `SetWorkspaceLogo` (worker), `ChangeWorkspaceMemberRole`, `RemoveWorkspaceMember`, `LeaveWorkspace`, `SetBoardCreationPolicy`, `DeleteWorkspace` |
| `Invitation` | `InviteToWorkspace`, `InviteToBoard`, `AcceptInvitation`, `DeclineInvitation`, `RevokeInvitation`, `ExpireInvitations` (scheduler) |

### 3.3 Board (core)

**Diagram →** [Board class diagram](./diagrams/class/04-board.md)

| Aggregate | Commands |
|---|---|
| `Board` | `CreateBoard`, `UpdateBoard` (name, description, background), `ChangeBoardVisibility`, `UpdateBoardPolicies`, `AddBoardMember`, `JoinBoard`, `ChangeBoardMemberRole`, `RemoveBoardMember`, `LeaveBoard`, `CreateLabel`, `UpdateLabel`, `DeleteLabel`, `ArchiveBoard`, `ReopenBoard`, `DeleteBoard`, `StarBoard` / `UnstarBoard` (user preference, no aggregate version) |
| `List` | `CreateList`, `RenameList`, `MoveList`, `ArchiveList`, `RestoreList`, `TransferList` (P2), `SetWipLimit` (P2) |
| `Ticket` | `CreateTicket`, `UpdateTicket` (title/description + `expectedVersion`), `MoveTicket`, `TransferTicket`, `AddTicketLabel`, `RemoveTicketLabel`, `AssignTicketMember`, `UnassignTicketMember`, `SetTicketDates`, `CompleteTicketDue`, `ReopenTicketDue`, `SetTicketCover`, `ArchiveTicket`, `RestoreTicket`, `DeleteTicket` |
| `Checklist` | `AddChecklist`, `RenameChecklist`, `MoveChecklist`, `DeleteChecklist`, `AddChecklistItem`, `UpdateChecklistItem`, `ToggleChecklistItem`, `MoveChecklistItem`, `DeleteChecklistItem` |

### 3.4 Collaboration

**Diagram →** [Collaboration class diagram](./diagrams/class/05-collaboration.md)

| Aggregate | Commands |
|---|---|
| `Comment` | `AddComment`, `EditComment`, `DeleteComment`, `ReactToComment` (P2) |
| `TicketWatch` | `WatchTicket`, `UnwatchTicket` |
| `Activity` (projection) | — written by `ActivityRecorder` from domain events |

### 3.5 Storage

**Diagram →** [Storage class diagram](./diagrams/class/06-storage.md)

| Aggregate | Commands |
|---|---|
| `Attachment` | `RequestAttachmentUpload`, `ConfirmAttachmentUpload`, `AddLinkAttachment`, `DeleteAttachment`, `GenerateAttachmentPreview` (worker), `CollectAbandonedUploads` (scheduler) |
| — (no aggregate) | `RequestImageUpload`, `ConfirmImageUpload`, `ProcessImageUpload` (worker), `CollectIncomingImages` (scheduler) |

### 3.6 Notification

**Diagram →** [Notification class diagram](./diagrams/class/07-notification.md)

| Aggregate | Commands |
|---|---|
| `Notification` | `CreateNotificationsForEvent` (worker), `MarkNotificationRead`, `MarkAllNotificationsRead` |
| `NotificationPreference` | `UpdateNotificationPreferences` (P2) |

---

## 4. Consistency rules (summary)

| Rule | Mechanism |
|---|---|
| One aggregate per transaction **is the default**. Exceptions: activity rows, outbox rows, and cross-board transfer (Ticket + labels created on the target Board) | UnitOfWork |
| Concurrent edits of the same aggregate | `version` column. `VERSION_CONFLICT` for text edits, automatic retry (×3) for commutative commands |
| Concurrent position changes in one list | `SELECT … FROM lists WHERE id = ANY($1) ORDER BY id FOR UPDATE` |
| Cross-context side effects | Outbox → RabbitMQ → idempotent consumers (at-least-once) |
| Read-your-writes for the actor | Mutation payload returns the authoritative state. The client doesn't wait for SSE |

---

## 5. Domain events catalog

Naming: `<context>.<aggregate>.<past_tense>`. All events carry the [envelope](#6-integration-event-envelope). ✅ = consumed.

| Event | Producer | Key payload | Activity | Realtime | Notification | Other consumers |
|---|---|---|---|---|---|---|
| `identity.user.registered` | User | userId, email, fullName | — | — | — | worker: issue token + verification email |
| `identity.user.signup_attempted` | — (handler) | email | — | — | — | worker: "someone tried to sign up with your email" notice (anti-enumeration) |
| `identity.user.verification_requested` | User | userId | — | — | — | worker: issue token + email |
| `identity.user.email_verified` | User | userId | — | — | — | — |
| `identity.user.password_reset_requested` | User | userId | — | — | — | worker: issue token + email |
| `identity.user.password_changed` | User | userId | — | — | — | worker: security notice email |
| `identity.user.profile_updated` | User | userId, changed fields | — | ✅ member avatars | — | cache: invalidate user profile |
| `identity.user.deleted` | User | userId | — | — | — | Workspace/Board: remove memberships |
| `identity.session.revoked` | Session | sessionId, userId, reason | — | ✅ close streams | — | — |
| `workspace.workspace.created` / `updated` / `deleted` | Workspace | workspaceId, fields | — | ✅ (workspace pages) | — | Board: cascade delete boards |
| `workspace.member.joined` / `role_changed` / `removed` | Workspace | workspaceId, userId, role | — | ✅ | ✅ inviter | Board: remove from boards on removal |
| `workspace.invitation.created` / `accepted` / `declined` / `revoked` / `expired` | Invitation | invitationId, scope, email | — | — | ✅ | worker: issue token + invitation email (on `created`) |
| `board.board.created` / `updated` / `archived` / `reopened` / `deleted` | Board | boardId, changed fields | ✅ | ✅ | — | Storage: delete objects on `deleted` |
| `board.member.added` / `role_changed` / `removed` | Board | boardId, userId, role | ✅ | ✅ (+ close streams on removed) | ✅ added | cache: invalidate permission |
| `board.label.created` / `updated` / `deleted` | Board | boardId, label | — | ✅ | — | — |
| `board.list.created` / `renamed` / `moved` / `archived` / `restored` | List | listId, boardId, name, position | ✅ | ✅ | — | — |
| `board.ticket.created` | Ticket | ticket summary | ✅ | ✅ | — | — |
| `board.ticket.updated` | Ticket | ticketId, changed fields, version | ✅ | ✅ | — | — |
| `board.ticket.moved` | Ticket | ticketId, from/to listId, position, version | ✅ | ✅ | ✅ watchers | — |
| `board.ticket.transferred` | Ticket | ticketId, from/to board+list, new number | ✅ both boards | ✅ both boards | ✅ watchers | — |
| `board.ticket.label_added` / `label_removed` | Ticket | ticketId, labelId | ✅ | ✅ | — | — |
| `board.ticket.assignee_added` / `assignee_removed` | Ticket | ticketId, userId | ✅ | ✅ | ✅ assignee | — |
| `board.ticket.dates_changed` / `due_completed` / `due_reopened` | Ticket | ticketId, dates | ✅ | ✅ | ✅ watchers | — |
| `board.ticket.cover_changed` | Ticket | ticketId, cover | — | ✅ | — | — |
| `board.ticket.archived` / `restored` / `deleted` | Ticket | ticketId | ✅ | ✅ | — | Storage: delete objects on `deleted` |
| `board.ticket.due_soon` (P2) | scheduler | ticketId, dueAt | — | — | ✅ | email |
| `board.checklist.*`, `board.checklist_item.*` | Checklist | checklistId, item | ✅ (toggle, add) | ✅ | — | — |
| `collab.comment.created` / `edited` / `deleted` | Comment | commentId, ticketId, mentions | ✅ | ✅ | ✅ mentions/watchers | — |
| `collab.ticket.watched` / `unwatched` | TicketWatch | ticketId, userId | — | ✅ (own user channel) | — | — |
| `storage.attachment.uploaded` | Attachment | attachmentId, ticketId, meta | ✅ | ✅ | — | worker: preview generation |
| `storage.attachment.preview_ready` | Attachment | attachmentId, previewKey | — | ✅ | — | — |
| `storage.attachment.deleted` | Attachment | attachmentId, objectKey | ✅ | ✅ | — | worker: delete object |
| `storage.image.uploaded` | — | uploadId, purpose, ownerId, uploadedBy, objectKey | — | — | — | worker: re-encode into `tb-public` |
| `storage.image.ready` | — | uploadId, purpose, ownerId, uploadedBy, publicKey | — | ✅ (uploader's user channel) | — | worker: `SetAvatar` or `SetWorkspaceLogo` |
| `storage.image.rejected` | — | uploadId, purpose, uploadedBy, code | — | ✅ (uploader's user channel) | — | — |
| `notification.notification.created` | Notification | notificationId, recipientId, type | — | ✅ (recipient's user channel) | — | — |

Wire format of the realtime projections: [09 · API contract §5](./09-api-contract.md#5-realtime-sse-contract).

---

## 6. Integration event envelope

Persisted in `outbox_events`, published to RabbitMQ (`tb.events`, routing key = `type`), with AMQP `message_id = id` and `correlation_id = metadata.correlationId`.

```json
{
  "id": "0192f5a3-7c1e-7b8a-9f00-3c2d1e4b5a69",
  "type": "board.ticket.moved",
  "version": 1,
  "occurredAt": "2026-10-28T09:15:02.481Z",
  "aggregate": { "type": "Ticket", "id": "0192f5a3-1111-7000-8000-000000000042", "version": 13 },
  "metadata": {
    "actorId": "0192f000-aaaa-7000-8000-000000000001",
    "sessionId": "0192f000-bbbb-7000-8000-000000000009",
    "boardId": "0192f000-cccc-7000-8000-000000000007",
    "workspaceId": "0192f000-dddd-7000-8000-000000000003",
    "correlationId": "req_01JBX8M6Q2…",
    "causationId": null,
    "clientMutationId": "cm_7f3a…"
  },
  "payload": {
    "ticketId": "0192f5a3-1111-7000-8000-000000000042",
    "fromListId": "0192f000-eeee-7000-8000-000000000011",
    "toListId": "0192f000-eeee-7000-8000-000000000012",
    "position": "a0V",
    "fromListName": "To Do",
    "toListName": "Doing"
  }
}
```

Versioning: additive changes keep `version`. Breaking changes publish `version: 2` **alongside** v1 until all consumers migrate.
