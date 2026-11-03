# Class · Collaboration context (comments, activity, watching)

> Index: [05 · Domain model §3.4](../../05-domain-model.md#34-collaboration) · Tables: [ERD 03](../erd/03-collaboration-storage-notification.md) · Sequence: [15](../sequence/15-comment-mention-notification.md)

```mermaid
classDiagram
  direction LR
  class Comment {
    <<AggregateRoot>>
    +CommentId id
    +TicketId ticketId
    +BoardId boardId
    +UserId authorId
    +Markdown body
    +Set~UserId~ mentions
    +DateTime editedAt
    +post(ticket, author, body, mentionable)$ Comment
    +edit(by, body, mentionable) void
    +delete(by, byRole) void
  }
  class Mention {
    <<ValueObject>>
    +parse(body, usernameDirectory)$ Set~UserId~
  }
  class Activity {
    <<ReadModel>>
    +ActivityId id
    +BoardId boardId
    +ListId listId
    +TicketId ticketId
    +UserId actorId
    +ActivityType type
    +Object data
    +DateTime createdAt
  }
  class ActivityRecorder {
    <<in-process handler>>
    +record(events, tx) void
  }
  class TicketWatch {
    <<AggregateRoot>>
    +TicketId ticketId
    +UserId userId
    +DateTime createdAt
    +watch(ticketId, userId)$ TicketWatch
  }
  class CommentPolicy {
    <<enumeration>>
    DISABLED
    MEMBERS
    OBSERVERS
    WORKSPACE
  }
  class BoardAccessReader {
    <<port>>
    +effectiveRole(boardId, userId) EffectiveRole
    +commentPolicy(boardId) CommentPolicy
    +canView(boardId, userId) boolean
  }
  class UserDirectory {
    <<port>>
    +findByUsernames(names) List~UserRef~
  }

  Comment ..> Mention : uses
  Mention ..> UserDirectory
  Comment ..> BoardAccessReader : authorise and filter mentions
  ActivityRecorder ..> Activity : appends
  ActivityRecorder ..> Comment : records comment.created
  TicketWatch ..> BoardAccessReader : canView
  BoardAccessReader ..> CommentPolicy
```

## Rules

- **Activity is a projection**, not an aggregate. Domain events from any context are mapped to `Activity` rows by `ActivityRecorder` **in the same transaction** ([ADR-011](../../11-decisions.md#adr-011)). Its `data` holds a **snapshot** of names at the time ("moved from *To Do* to *Doing*"), so history stays readable after renames and deletes.
- Only mentions of users who can view the board are stored. Mentioning someone doesn't grant access.
- Editing is author-only. Deleting is author or board `ADMIN`. Comments are hard-deleted and leave a `comment.deleted` activity.
- Watching is implicit for the ticket creator, assignees and commenters (P2 setting). For the MVP it's explicit plus the creator.
