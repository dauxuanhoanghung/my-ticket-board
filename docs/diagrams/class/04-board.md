# Class · Board context (core domain)

> Index: [05 · Domain model §3.3](../../05-domain-model.md#33-board-core) · Tables: [ERD 02](../erd/02-board-core.md) · States: [Board](../state/06-board.md), [List](../state/07-list.md), [Ticket](../state/08-ticket.md), [Due status](../state/09-ticket-due-status.md), [Checklist item](../state/11-checklist-item.md)

```mermaid
classDiagram
  direction TB
  class Board {
    <<AggregateRoot>>
    +BoardId id
    +WorkspaceId workspaceId
    +ShortId shortId
    +BoardName name
    +String description
    +Visibility visibility
    +Background background
    +BoardPolicies policies
    +DateTime archivedAt
    +int version
    +create(workspaceId, name, creatorId, template)$ Board
    +rename(name) void
    +changeVisibility(visibility) void
    +changeBackground(background) void
    +updatePolicies(policies) void
    +addMember(userId, role, addedBy) void
    +changeMemberRole(userId, role) void
    +removeMember(userId) void
    +roleOf(userId) BoardRole
    +createLabel(name, color) Label
    +updateLabel(labelId, name, color) void
    +deleteLabel(labelId) void
    +archive(now) void
    +reopen() void
    +markDeleted() void
  }
  class BoardMember {
    <<Entity>>
    +UserId userId
    +BoardRole role
    +DateTime joinedAt
  }
  class Label {
    <<Entity>>
    +LabelId id
    +String name
    +LabelColor color
  }
  class BoardPolicies {
    <<ValueObject>>
    +CommentPolicy comment
    +InvitePolicy invite
    +boolean selfJoin
  }
  class Background {
    <<ValueObject>>
    +BackgroundKind kind
    +String value
  }
  class List {
    <<AggregateRoot>>
    +ListId id
    +BoardId boardId
    +ListName name
    +Position position
    +int wipLimit
    +DateTime archivedAt
    +int version
    +create(id, boardId, name, position)$ List
    +rename(name) void
    +moveTo(position) void
    +transferTo(boardId, position) void
    +setWipLimit(limit) void
    +archive(now) void
    +restore(position) void
  }
  class Ticket {
    <<AggregateRoot>>
    +TicketId id
    +BoardId boardId
    +ListId listId
    +ShortId shortId
    +int number
    +TicketTitle title
    +Markdown description
    +Position position
    +TicketDates dates
    +Cover cover
    +Set~LabelId~ labelIds
    +Set~UserId~ assigneeIds
    +DateTime archivedAt
    +int version
    +create(id, boardId, listId, number, title, position, creatorId)$ Ticket
    +rename(title, expectedVersion) void
    +describe(markdown, expectedVersion) void
    +moveTo(listId, position) void
    +transferTo(target, number, labelMap, allowedAssignees) void
    +addLabel(labelId) void
    +removeLabel(labelId) void
    +assign(userId) void
    +unassign(userId) void
    +setDates(dates) void
    +completeDue(now) void
    +reopenDue() void
    +setCover(cover) void
    +archive(now) void
    +restore(position) void
  }
  class TicketDates {
    <<ValueObject>>
    +DateTime startAt
    +DateTime dueAt
    +int reminderMinutes
    +DateTime completedAt
    +reminderAt() DateTime
    +statusAt(now) DueStatus
  }
  class Cover {
    <<ValueObject>>
    +CoverKind kind
    +String color
    +AttachmentId attachmentId
    +CoverSize size
  }
  class Position {
    <<ValueObject>>
    +String key
    +between(lower, upper)$ Position
    +compare(other) int
  }
  class Checklist {
    <<AggregateRoot>>
    +ChecklistId id
    +TicketId ticketId
    +String title
    +Position position
    +add(ticketId, title, position)$ Checklist
    +rename(title) void
    +addItem(id, content, position) ChecklistItem
    +updateItem(itemId, content) void
    +toggleItem(itemId, by, now) void
    +moveItem(itemId, position) void
    +removeItem(itemId) void
  }
  class ChecklistItem {
    <<Entity>>
    +ChecklistItemId id
    +String content
    +Position position
    +DateTime completedAt
    +UserId completedBy
    +UserId assigneeId
    +DateTime dueAt
  }
  class TicketTransferService {
    <<DomainService>>
    +plan(ticket, sourceBoard, targetBoard) TransferPlan
  }
  class TicketNumberAllocator {
    <<port>>
    +next(boardId) int
  }
  class WorkspaceMembershipReader {
    <<port>>
    +roleOf(workspaceId, userId) WorkspaceRole
  }
  class BoardRole {
    <<enumeration>>
    ADMIN
    MEMBER
    OBSERVER
  }
  class Visibility {
    <<enumeration>>
    PRIVATE
    WORKSPACE
  }

  Board "1" *-- "1..*" BoardMember : at least one ADMIN
  Board "1" *-- "0..*" Label
  Board *-- BoardPolicies
  Board *-- Background
  Board --> Visibility
  BoardMember --> BoardRole
  List ..> Board : boardId
  Ticket ..> List : listId
  Ticket ..> Board : boardId
  Ticket *-- TicketDates
  Ticket *-- "0..1" Cover
  Ticket *-- Position
  List *-- Position
  Checklist ..> Ticket : ticketId
  Checklist "1" *-- "0..*" ChecklistItem
  TicketTransferService ..> Ticket
  TicketTransferService ..> Board
  Ticket ..> TicketNumberAllocator : on create / transfer
```

## Why the aggregates are split this way

| Decision | Reason |
|---|---|
| **Tickets aren't inside Board** | A board can have thousands of tickets. Loading them all to move one would be slow and would serialise every write on the board row |
| **List is its own aggregate** | Reordering lists shouldn't conflict with editing tickets. The list row doubles as the **lock** that serialises position changes inside that list |
| **Checklist is its own aggregate** | Toggling items (frequent, concurrent) shouldn't bump the ticket's version and cause conflicts with description edits |
| **Labels and members inside Board** | Small bounded sets with invariants (last admin, label belongs to board) |
| **Ticket numbers via a port** | `UPDATE boards SET ticket_seq = ticket_seq + 1 RETURNING ticket_seq` is atomic and doesn't load or version the Board aggregate |

## Invariants

| Invariant | Enforced by |
|---|---|
| ≥ 1 board `ADMIN` | `Board.changeMemberRole/removeMember` → `LastBoardAdminError` |
| A ticket's labels belong to the ticket's board | `AddLabelHandler` checks `board.hasLabel(labelId)`. Cross-board transfer remaps |
| Assignees are board members | `AssignHandler` checks `board.roleOf(userId) ∈ {ADMIN, MEMBER, OBSERVER}` |
| No content mutation on an archived board | handlers check `board.isArchived()` (read-only except reopen/delete) |
| Board delete requires archived | `Board.markDeleted` |
| Unique active position per list | list row lock + `Position.between` with real neighbours + partial unique index |
| `startAt ≤ dueAt` when both set | `TicketDates` VO |
