# State · Notification (in-app read state and email delivery)

> Index: [08 · State machines](../../08-state-machines.md) · Table: `notifications` · Sequence: [15](../sequence/15-comment-mention-notification.md) · Class: [Notification](../class/07-notification.md)

```mermaid
stateDiagram-v2
  [*] --> Notification : worker creates (dedupe on recipient + source event)
  state Notification {
    [*] --> Unread
    Unread --> Read : open, markRead, markAllRead
    Read --> Unread : mark unread
    --
    [*] --> NoEmail
    NoEmail --> EmailQueued : email preference on (P2)
    EmailQueued --> EmailSent : provider accepted
    EmailQueued --> EmailRetrying : transient provider error
    EmailRetrying --> EmailSent : retry succeeds
    EmailRetrying --> EmailDeadLettered : 5 attempts failed
  }
  Notification --> Purged : read and older than 90 days (P2)
  Purged --> [*]
```

The two regions are independent. Reading a notification doesn't cancel a queued email. Only one email is sent per notification (idempotent on `notification.id`).
