# 09 · API contract (GraphQL, HTTP, SSE)

> Draft contract between `apps/web` (BFF) and `apps/api`. The real schema is generated code-first by NestJS into `apps/api/schema.gql`. This document defines the **shape and conventions** it must follow.

---

## 1. Conventions

| Topic | Convention |
|---|---|
| Style | Code-first NestJS GraphQL (Apollo driver). `schema.gql` committed and diffed in CI |
| Naming | Types `PascalCase`, fields `camelCase`, enums `SCREAMING_SNAKE`. Mutations are `verbNoun` (`moveTicket`) |
| Mutations | One `input: XInput!` argument, returns `XPayload!` |
| IDs | `UUID` scalar (UUIDv7). Creates accept a **client-generated** `id` (idempotent) |
| Optimistic UI | Every mutation input accepts an optional `clientMutationId`. It's echoed into realtime events |
| Concurrency | Text edits take `expectedVersion: Int!`. Every aggregate type exposes `version: Int!` |
| Pagination | Relay-style connections (`first`, `after`, `pageInfo { hasNextPage endCursor }`). The cursor is an opaque, encoded UUIDv7 |
| Ordering | `position: String!` (fractional key). Clients sort with byte comparison (`a < b`), **not** `localeCompare` |
| Time | `DateTime` scalar, ISO-8601 UTC |
| N+1 | DataLoader per request for users, labels, lists, members |
| Limits | Max depth 8. Complexity budget 1 000 per operation. Introspection off in production |
| Callers | Only the BFF. Auth mutations additionally require an `x-internal-key` header shared between BFF and API |
| Locale | The BFF sends one locale in `Accept-Language`. Error `message` text is translated. `extensions.code` and data never are ([12](./12-internationalisation.md)) |

---

## 2. Schema draft (SDL)

```graphql
scalar DateTime
scalar UUID
scalar JSON

# ---------- enums ----------
enum WorkspaceRole { ADMIN MEMBER }
enum BoardRole { ADMIN MEMBER OBSERVER }
enum EffectiveBoardRole { ADMIN MEMBER OBSERVER WORKSPACE_VIEWER }
enum BoardVisibility { PRIVATE WORKSPACE }
enum CommentPolicy { DISABLED MEMBERS OBSERVERS WORKSPACE }
enum InvitePolicy { ADMINS MEMBERS }
enum BoardCreationPolicy { ADMINS MEMBERS }
enum BackgroundKind { COLOR GRADIENT IMAGE }
enum CoverKind { COLOR ATTACHMENT }
enum CoverSize { NORMAL FULL }
enum AttachmentKind { FILE LINK }
enum AttachmentStatus { PENDING READY FAILED }
enum AttachmentVariant { ORIGINAL PREVIEW }
enum ImageUploadPurpose { AVATAR WORKSPACE_LOGO }
enum InvitationStatus { PENDING ACCEPTED DECLINED REVOKED EXPIRED }
enum NotificationType {
  COMMENT_MENTION COMMENT_ON_WATCHED ASSIGNED_TO_TICKET TICKET_MOVED
  DUE_DATE_CHANGED DUE_SOON ADDED_TO_BOARD INVITATION_RECEIVED INVITATION_ACCEPTED
}

# ---------- shared ----------
type PageInfo { hasNextPage: Boolean!  endCursor: String }

type User {
  id: UUID!
  username: String!
  fullName: String!
  initials: String!
  avatarUrl: String
}

type Viewer {
  user: User!
  email: String!
  emailVerified: Boolean!
  locale: String!
  workspaces: [Workspace!]!
  starredBoards: [Board!]!
  recentBoards: [Board!]!                # P2
  pendingInvitations: [InvitationPreview!]!
  unreadNotificationCount: Int!
}

# ---------- workspace ----------
type Workspace {
  id: UUID!
  name: String!
  slug: String!
  description: String
  logoUrl: String
  boardCreationPolicy: BoardCreationPolicy!
  myRole: WorkspaceRole
  boards(includeArchived: Boolean = false): [Board!]!
  members(first: Int = 50, after: String): WorkspaceMemberConnection!
  invitations(status: InvitationStatus = PENDING): [Invitation!]!   # admins only
}
type WorkspaceMember { user: User!  role: WorkspaceRole!  joinedAt: DateTime! }
type WorkspaceMemberEdge { cursor: String!  node: WorkspaceMember! }
type WorkspaceMemberConnection { edges: [WorkspaceMemberEdge!]!  pageInfo: PageInfo! }

type Invitation {
  id: UUID!
  email: String
  role: String!
  boardId: UUID
  status: InvitationStatus!
  invitedBy: User!
  expiresAt: DateTime!
  createdAt: DateTime!
}
type InvitationPreview {
  workspaceName: String!
  boardName: String
  invitedBy: User!
  role: String!
  status: InvitationStatus!
  expiresAt: DateTime!
}

# ---------- board ----------
type Board {
  id: UUID!
  shortId: String!
  slug: String!
  name: String!
  description: String!
  workspace: Workspace!
  visibility: BoardVisibility!
  background: BoardBackground!
  policies: BoardPolicies!
  myRole: EffectiveBoardRole
  isStarred: Boolean!
  archivedAt: DateTime
  version: Int!
  members: [BoardMember!]!
  labels: [Label!]!
  lists: [List!]!                         # active, ordered by position
  tickets: [Ticket!]!                     # active, flat: client groups by listId
  watchedTicketIds: [UUID!]!
  archivedLists: [List!]!
  archivedTickets(first: Int = 30, after: String): TicketConnection!
  activities(first: Int = 30, after: String): ActivityConnection!
}
type BoardBackground { kind: BackgroundKind!  value: String! }
type BoardPolicies { comment: CommentPolicy!  invite: InvitePolicy!  selfJoin: Boolean! }
type BoardMember { user: User!  role: BoardRole!  isGuest: Boolean!  joinedAt: DateTime! }
type Label { id: UUID!  name: String!  color: String }

type List {
  id: UUID!
  boardId: UUID!
  name: String!
  position: String!
  wipLimit: Int
  archivedAt: DateTime
  version: Int!
}

# ---------- ticket ----------
type Ticket {
  id: UUID!
  shortId: String!
  number: Int!
  boardId: UUID!
  listId: UUID!
  title: String!
  position: String!
  labelIds: [UUID!]!
  assigneeIds: [UUID!]!
  startAt: DateTime
  dueAt: DateTime
  dueReminderMinutes: Int
  dueCompletedAt: DateTime
  cover: TicketCover
  badges: TicketBadges!
  archivedAt: DateTime
  version: Int!
  createdAt: DateTime!
  updatedAt: DateTime!
  # detail fields: resolved lazily, used by the ticket modal
  description: String!
  isWatching: Boolean!
  checklists: [Checklist!]!
  attachments: [Attachment!]!
  timeline(first: Int = 30, after: String): TimelineConnection!
}
type TicketCover { kind: CoverKind!  color: String  attachmentId: UUID  size: CoverSize! }
type TicketBadges {
  hasDescription: Boolean!
  commentCount: Int!
  attachmentCount: Int!
  checklistTotal: Int!
  checklistDone: Int!
}
type TicketEdge { cursor: String!  node: Ticket! }
type TicketConnection { edges: [TicketEdge!]!  pageInfo: PageInfo! }

type Checklist { id: UUID!  title: String!  position: String!  items: [ChecklistItem!]!  version: Int! }
type ChecklistItem {
  id: UUID!
  content: String!
  position: String!
  completedAt: DateTime
  completedBy: User
  assignee: User          # P2
  dueAt: DateTime         # P2
}

type Attachment {
  id: UUID!
  kind: AttachmentKind!
  status: AttachmentStatus!
  fileName: String!
  mimeType: String
  sizeBytes: Float
  hasPreview: Boolean!
  width: Int
  height: Int
  linkUrl: String          # kind = LINK only. Files are fetched through /api/files/:id
  uploadedBy: User!
  createdAt: DateTime!
}

# ---------- collaboration ----------
type Comment { id: UUID!  author: User!  body: String!  mentions: [User!]!  editedAt: DateTime  createdAt: DateTime! }
type Activity { id: UUID!  actor: User!  type: String!  data: JSON!  ticketId: UUID  createdAt: DateTime! }
union TimelineItem = Comment | Activity
type TimelineEdge { cursor: String!  node: TimelineItem! }
type TimelineConnection { edges: [TimelineEdge!]!  pageInfo: PageInfo! }
type ActivityEdge { cursor: String!  node: Activity! }
type ActivityConnection { edges: [ActivityEdge!]!  pageInfo: PageInfo! }

# ---------- notification ----------
type Notification {
  id: UUID!
  type: NotificationType!
  actor: User
  boardId: UUID
  ticketId: UUID
  data: JSON!              # display snapshot: board name, ticket title, excerpt
  readAt: DateTime
  createdAt: DateTime!
}
type NotificationEdge { cursor: String!  node: Notification! }
type NotificationConnection { edges: [NotificationEdge!]!  pageInfo: PageInfo!  unreadCount: Int! }

# ---------- queries ----------
type Query {
  viewer: Viewer!
  workspace(slug: String!): Workspace
  board(shortId: String!): Board
  ticket(shortId: String!): Ticket
  invitationByToken(token: String!): InvitationPreview
  notifications(first: Int = 20, after: String, unreadOnly: Boolean = false): NotificationConnection!
  attachmentUrl(id: UUID!, variant: AttachmentVariant = ORIGINAL, download: Boolean = false): String!
  searchTickets(query: String!, first: Int = 20, after: String): TicketConnection!   # P2
}

# ---------- key inputs ----------
input CreateTicketInput {
  id: UUID!                       # client-generated UUIDv7
  listId: UUID!
  title: String!
  prevTicketId: UUID              # place right after this ticket (null = top when nextTicketId is set, else bottom)
  nextTicketId: UUID
  clientMutationId: String
}
input MoveTicketInput {
  ticketId: UUID!
  toListId: UUID!                 # may be on another board → transfer
  prevTicketId: UUID
  nextTicketId: UUID
  clientMutationId: String
}
input UpdateTicketInput {
  ticketId: UUID!
  expectedVersion: Int!
  title: String
  description: String
  clientMutationId: String
}
input SetTicketDatesInput {
  ticketId: UUID!
  startAt: DateTime
  dueAt: DateTime
  dueReminderMinutes: Int
  clientMutationId: String
}
input RequestAttachmentUploadInput {
  id: UUID!
  ticketId: UUID!
  fileName: String!
  mimeType: String!
  sizeBytes: Float!
}
type MoveTicketPayload { ticket: Ticket!  clientMutationId: String }
input RequestImageUploadInput {
  id: UUID!
  purpose: ImageUploadPurpose!
  workspaceId: UUID               # required for WORKSPACE_LOGO
  mimeType: String!
  sizeBytes: Float!
}
input ConfirmImageUploadInput {
  id: UUID!
  purpose: ImageUploadPurpose!
  workspaceId: UUID
}
type HttpHeader { name: String!  value: String! }
type PresignedUpload {
  url: String!
  headers: [HttpHeader!]!         # send exactly these. The browser sets Content-Length itself
  expiresAt: DateTime!
}
type RequestAttachmentUploadPayload {
  attachment: Attachment!
  upload: PresignedUpload         # null when the attachment is already ready
}
type RequestImageUploadPayload { upload: PresignedUpload! }
type AuthPayload {
  accessToken: String!
  accessTokenExpiresAt: DateTime!
  refreshToken: String
  refreshTokenExpiresAt: DateTime
  locale: String                  # saved user locale, copied into the tb_locale cookie
}

# ---------- mutations (inputs/payloads omitted where they follow the pattern) ----------
type Mutation {
  # identity (BFF only, x-internal-key required)
  register(input: RegisterInput!): RegisterPayload!
  verifyEmail(input: VerifyEmailInput!): AuthPayload!
  resendVerification(input: ResendVerificationInput!): OkPayload!
  login(input: LoginInput!): AuthPayload!
  refreshSession(input: RefreshSessionInput!): AuthPayload!
  logout: OkPayload!
  requestPasswordReset(input: RequestPasswordResetInput!): OkPayload!
  resetPassword(input: ResetPasswordInput!): OkPayload!
  changePassword(input: ChangePasswordInput!): OkPayload!
  updateProfile(input: UpdateProfileInput!): UpdateProfilePayload!

  # workspace
  createWorkspace(input: CreateWorkspaceInput!): WorkspacePayload!
  updateWorkspace(input: UpdateWorkspaceInput!): WorkspacePayload!
  deleteWorkspace(input: DeleteWorkspaceInput!): OkPayload!
  inviteToWorkspace(input: InviteToWorkspaceInput!): InvitationsPayload!
  inviteToBoard(input: InviteToBoardInput!): InvitationsPayload!
  revokeInvitation(input: RevokeInvitationInput!): OkPayload!
  acceptInvitation(input: AcceptInvitationInput!): AcceptInvitationPayload!
  declineInvitation(input: DeclineInvitationInput!): OkPayload!
  changeWorkspaceMemberRole(input: ChangeWorkspaceMemberRoleInput!): WorkspacePayload!
  removeWorkspaceMember(input: RemoveWorkspaceMemberInput!): OkPayload!
  leaveWorkspace(input: LeaveWorkspaceInput!): OkPayload!

  # board
  createBoard(input: CreateBoardInput!): BoardPayload!
  updateBoard(input: UpdateBoardInput!): BoardPayload!              # name, description, background
  changeBoardVisibility(input: ChangeBoardVisibilityInput!): BoardPayload!
  updateBoardPolicies(input: UpdateBoardPoliciesInput!): BoardPayload!
  starBoard(input: StarBoardInput!): OkPayload!
  unstarBoard(input: StarBoardInput!): OkPayload!
  joinBoard(input: JoinBoardInput!): BoardPayload!
  addBoardMember(input: AddBoardMemberInput!): BoardPayload!
  changeBoardMemberRole(input: ChangeBoardMemberRoleInput!): BoardPayload!
  removeBoardMember(input: RemoveBoardMemberInput!): OkPayload!
  leaveBoard(input: LeaveBoardInput!): OkPayload!
  createLabel(input: CreateLabelInput!): LabelPayload!
  updateLabel(input: UpdateLabelInput!): LabelPayload!
  deleteLabel(input: DeleteLabelInput!): OkPayload!
  archiveBoard(input: ArchiveBoardInput!): BoardPayload!
  reopenBoard(input: ReopenBoardInput!): BoardPayload!
  deleteBoard(input: DeleteBoardInput!): OkPayload!

  # list
  createList(input: CreateListInput!): ListPayload!
  renameList(input: RenameListInput!): ListPayload!
  moveList(input: MoveListInput!): ListPayload!
  archiveList(input: ArchiveListInput!): ListPayload!
  restoreList(input: RestoreListInput!): ListPayload!

  # ticket
  createTicket(input: CreateTicketInput!): TicketPayload!
  updateTicket(input: UpdateTicketInput!): TicketPayload!
  moveTicket(input: MoveTicketInput!): MoveTicketPayload!
  addTicketLabel(input: TicketLabelInput!): TicketPayload!
  removeTicketLabel(input: TicketLabelInput!): TicketPayload!
  assignTicketMember(input: TicketMemberInput!): TicketPayload!
  unassignTicketMember(input: TicketMemberInput!): TicketPayload!
  setTicketDates(input: SetTicketDatesInput!): TicketPayload!
  completeTicketDue(input: TicketRefInput!): TicketPayload!
  reopenTicketDue(input: TicketRefInput!): TicketPayload!
  setTicketCover(input: SetTicketCoverInput!): TicketPayload!
  archiveTicket(input: TicketRefInput!): TicketPayload!
  restoreTicket(input: TicketRefInput!): TicketPayload!
  deleteTicket(input: TicketRefInput!): OkPayload!
  watchTicket(input: TicketRefInput!): TicketPayload!
  unwatchTicket(input: TicketRefInput!): TicketPayload!

  # checklist
  addChecklist(input: AddChecklistInput!): ChecklistPayload!
  renameChecklist(input: RenameChecklistInput!): ChecklistPayload!
  deleteChecklist(input: DeleteChecklistInput!): OkPayload!
  addChecklistItem(input: AddChecklistItemInput!): ChecklistPayload!
  updateChecklistItem(input: UpdateChecklistItemInput!): ChecklistPayload!
  toggleChecklistItem(input: ToggleChecklistItemInput!): ChecklistPayload!
  moveChecklistItem(input: MoveChecklistItemInput!): ChecklistPayload!
  deleteChecklistItem(input: DeleteChecklistItemInput!): ChecklistPayload!

  # comments
  addComment(input: AddCommentInput!): CommentPayload!
  editComment(input: EditCommentInput!): CommentPayload!
  deleteComment(input: DeleteCommentInput!): OkPayload!

  # attachments
  requestAttachmentUpload(input: RequestAttachmentUploadInput!): RequestAttachmentUploadPayload!
  confirmAttachmentUpload(input: ConfirmAttachmentUploadInput!): AttachmentPayload!
  addLinkAttachment(input: AddLinkAttachmentInput!): AttachmentPayload!
  deleteAttachment(input: DeleteAttachmentInput!): OkPayload!

  # avatars and workspace logos
  requestImageUpload(input: RequestImageUploadInput!): RequestImageUploadPayload!
  confirmImageUpload(input: ConfirmImageUploadInput!): OkPayload!

  # notifications
  markNotificationRead(input: MarkNotificationReadInput!): OkPayload!
  markAllNotificationsRead: OkPayload!
}
```

---

## 3. Error model

Errors are GraphQL errors with a stable `extensions.code`. Domain errors are mapped by a global exception filter. Unknown errors become `INTERNAL` (details logged, never returned). `message` is translated from `Accept-Language`, so clients must branch on `code`, never on `message`.

```json
{
  "errors": [{
    "message": "The ticket was changed by someone else.",
    "path": ["updateTicket"],
    "extensions": {
      "code": "VERSION_CONFLICT",
      "correlationId": "req_01JBX8M6Q2…",
      "details": { "currentVersion": 8, "updatedBy": "0192f000-…" }
    }
  }],
  "data": null
}
```

| Code | Meaning | Client handling |
|---|---|---|
| `UNAUTHENTICATED` | Missing, invalid or expired access token | BFF refreshes once, else redirect to login |
| `SESSION_REVOKED` | Session revoked (logout elsewhere, reuse detected) | Clear session, redirect to login |
| `FORBIDDEN` | Authenticated but not allowed | Roll back optimistic change, toast |
| `NOT_FOUND` | Doesn't exist **or** caller can't see it | 404 page |
| `VALIDATION_FAILED` | Input invalid. `details.fields` maps field → message | Inline form errors |
| `VERSION_CONFLICT` | `expectedVersion` stale | Conflict dialog ([Sequence 14](./diagrams/sequence/14-edit-description-conflict.md)) |
| `RATE_LIMITED` | Too many requests. `details.retryAfter` (s) | Disable button, countdown |
| `INVALID_CREDENTIALS` | Login failed (generic) | Form error |
| `EMAIL_NOT_VERIFIED` | Login before verification | Show resend |
| `ACCOUNT_SUSPENDED` | Suspended user | Static page |
| `TOKEN_INVALID` | Verification/reset token invalid or expired | Offer resend |
| `INVITATION_INVALID` | Invitation not pending or expired | Explanation page |
| `SLUG_TAKEN` | Workspace slug in use. `details.suggestion` | Field error |
| `LAST_ADMIN` | Would leave a workspace/board without an admin | Toast with explanation |
| `BOARD_ARCHIVED` | Mutation on an archived board | Read-only banner |
| `TARGET_LIST_UNAVAILABLE` | Move/create into an archived or deleted list | Roll back + refetch |
| `LIMIT_EXCEEDED` | A product limit was reached ([02 §4](./02-product-scope.md#4-limits-initial-configurable)) | Toast |
| `UPLOAD_INVALID` | Uploaded object missing, or its size or type doesn't match | Retry upload with a new id |
| `PAYLOAD_TOO_LARGE` | File over the size limit | Toast before upload |
| `FILE_TYPE_NOT_ALLOWED` | File type blocked, or not PNG, JPEG or WebP for an image upload | Toast before upload |
| `INTERNAL` | Unexpected | Generic toast with `correlationId` |

---

## 4. HTTP endpoints

### 4.1 API (`apps/api`, private network)

| Method | Path | Purpose | Auth |
|---|---|---|---|
| `POST` | `/graphql` | GraphQL endpoint | Bearer (not needed for auth mutations) |
| `GET` | `/realtime/stream?boardId=` | SSE stream (user channel + optional board channel) | Bearer |
| `GET` | `/health/live` | Process alive | none |
| `GET` | `/health/ready` | DB, cache, RabbitMQ, RustFS reachable | none |
| `GET` | `/auth/oauth/:provider/callback` | OAuth callback (later) | state param |
| `GET` | `/metrics` | Prometheus metrics (P2) | internal network only |

### 4.2 BFF (`apps/web`, public)

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/graphql` | GraphQL proxy for client components. Adds Bearer from `tb_at` and `Accept-Language` from `tb_locale`, persisted-operation allowlist in production, origin check. JSON only: file bytes never pass through it ([13](./13-file-uploads.md)) |
| `GET` | `/api/realtime?boardId=` | SSE proxy (streams the upstream body) |
| `GET` | `/api/files/:attachmentId?variant=&download=` | Permission check via `attachmentUrl`, then `302` to the presigned RustFS URL |
| `GET` | `/api/auth/oauth/:provider` | OAuth start (later) |
| — | Server Actions | Forms: sign-up, login, logout, workspace and board settings, invitations |

---

## 5. Realtime (SSE) contract

### 5.1 Wire format

```text
retry: 3000

event: ready
data: {"serverTime":"2026-10-28T09:15:00.000Z","userId":"0192f000-…","boardId":"0192f000-…"}

id: 0192f5a3-7c1e-7b8a-9f00-3c2d1e4b5a69
event: ticket.moved
data: {"channel":"board","boardId":"0192f000-…","actorId":"0192f000-…","clientMutationId":"cm_7f3a…","occurredAt":"2026-10-28T09:15:02.481Z","entity":{"type":"Ticket","id":"0192f5a3-…","version":13},"data":{"fromListId":"0192f000-…","toListId":"0192f000-…","position":"a0V"}}

: keep-alive
```

- `id` = domain event id (UUIDv7). Used for de-duplication only.
- Every event carries `entity.version`. The client applies it only when `version > cached.version`. That makes delivery order and duplicates harmless.
- Types and reducers are defined once in `packages/contracts` and used by both the API (projection) and the web (reducers).

### 5.2 Event types

| Channel | Event | `data` | Client reducer |
|---|---|---|---|
| control | `ready` | serverTime, userId, boardId | trigger snapshot refetch |
| control | `access.revoked` | boardId, reason | close stream, leave the board |
| control | `session.revoked` | — | close, redirect to login |
| control | `sync.required` | reason | refetch snapshot (e.g. after list rebalance) |
| board | `board.updated` | changed fields | patch board |
| board | `board.archived` / `board.reopened` / `board.deleted` | — | read-only banner / enable / redirect |
| board | `member.added` / `member.updated` / `member.removed` | user, role | patch members |
| board | `label.created` / `label.updated` / `label.deleted` | label | patch labels (deleted → strip from tickets) |
| board | `list.created` / `list.updated` / `list.moved` / `list.archived` / `list.restored` | list | upsert / re-sort / remove |
| board | `ticket.created` | full ticket card (with badges) | insert |
| board | `ticket.updated` | changed fields | patch (with editor-dirty guard) |
| board | `ticket.moved` | fromListId, toListId, position | move + re-sort |
| board | `ticket.removed` | ticketId, reason (archived, deleted, transferred) | remove |
| board | `ticket.restored` | full ticket card | insert |
| board | `checklist.changed` | ticketId, checklist, badges | patch detail + badges |
| board | `comment.created` / `comment.updated` / `comment.deleted` | comment, ticketId, badges | timeline + badge |
| board | `attachment.updated` / `attachment.deleted` | attachment, ticketId, badges | list + badge + cover |
| user | `notification.created` | notification | prepend, unread +1 |
| user | `notification.read` | ids or `all` | mark read |
| user | `watch.changed` | ticketId, watching | patch `watchedTicketIds` |
| user | `image.ready` | uploadId, purpose, url | replace the local preview |
| user | `image.rejected` | uploadId, purpose, code | restore the old image, show an error |
