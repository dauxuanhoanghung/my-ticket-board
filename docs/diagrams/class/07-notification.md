# Class · Notification context

> Index: [05 · Domain model §3.6](../../05-domain-model.md#36-notification) · Tables: [ERD 03](../erd/03-collaboration-storage-notification.md) · State: [Notification](../state/12-notification.md) · Activity: [Fan-out](../activity/05-notification-fanout.md)

```mermaid
classDiagram
  direction LR
  class Notification {
    <<AggregateRoot>>
    +NotificationId id
    +UserId recipientId
    +NotificationType type
    +UserId actorId
    +BoardId boardId
    +TicketId ticketId
    +Object data
    +DateTime readAt
    +DateTime createdAt
    +create(recipient, type, actor, context, data)$ Notification
    +markRead(now) void
    +markUnread() void
  }
  class NotificationPreference {
    <<Entity>>
    +UserId userId
    +NotificationType type
    +Channel channel
    +boolean enabled
  }
  class RecipientResolver {
    <<DomainService>>
    +resolve(event, context) List~Recipient~
  }
  class Recipient {
    <<ValueObject>>
    +UserId userId
    +NotificationType type
    +int priority
  }
  class NotificationType {
    <<enumeration>>
    COMMENT_MENTION
    COMMENT_ON_WATCHED
    ASSIGNED_TO_TICKET
    TICKET_MOVED
    DUE_DATE_CHANGED
    DUE_SOON
    ADDED_TO_BOARD
    INVITATION_RECEIVED
    INVITATION_ACCEPTED
  }
  class Channel {
    <<enumeration>>
    IN_APP
    EMAIL
  }
  class TicketAudienceReader {
    <<port>>
    +watchers(ticketId) Set~UserId~
    +assignees(ticketId) Set~UserId~
    +canView(boardId, userId) boolean
  }
  class EmailCommandPublisher {
    <<port>>
    +sendEmail(template, to, data) void
  }

  RecipientResolver ..> TicketAudienceReader
  RecipientResolver ..> Recipient : produces
  Notification --> NotificationType
  NotificationPreference --> Channel
  NotificationPreference --> NotificationType
  Notification ..> EmailCommandPublisher : when preference allows (P2)
```

## Rules

- **One notification per (event, recipient).** When several rules match, the highest-priority type wins (mention > assigned > watched).
- **Idempotent.** The consumer records `(consumer, messageId)` in `processed_messages` in the same transaction as the inserts.
- Notifications older than 90 days and read are purged (P2 job).
