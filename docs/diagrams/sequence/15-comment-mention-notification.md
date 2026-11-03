# Sequence 15 · Comment with @mention → realtime + notification (+ email)

> Index: [07 · Sequence flows](../../07-sequence-flows.md) · Use case: [UC-TKT-12](../use-case/05-collaboration.md#uc-tkt-12--comment-with-mention) · Activity: [Fan-out](../activity/05-notification-fanout.md) · State: [Notification](../state/12-notification.md)

```mermaid
sequenceDiagram
  autonumber
  actor U as Author
  participant B as Author browser
  participant N as BFF
  participant A as API (Collaboration)
  participant DB as PostgreSQL
  participant MQ as RabbitMQ
  participant WN as Worker (notification)
  participant RT as API realtime gateways
  participant BR as Recipient browser
  participant WE as Worker (email, P2)

  U->>B: "Can you review @carol?"
  B->>B: optimistic comment in the timeline
  B->>N: mutation addComment(id, ticketId, body, cmid)
  N->>A: forward
  A->>A: comment policy vs effective role
  A->>DB: resolve @carol to a user id, keep only users who can view the board
  A->>DB: BEGIN, INSERT comments and comment_mentions
  A->>DB: INSERT activities comment.created + outbox collab.comment.created (with mentions)
  A->>DB: COMMIT
  A-->>N: Comment
  N-->>B: reconcile
  par realtime on the board stream
    MQ->>RT: collab.comment.created
    RT-->>BR: comment.created (only when Carol has the board open)
  and notifications
    MQ->>WN: collab.comment.created (queue tb.notification)
    WN->>DB: BEGIN, INSERT processed_messages (dedupe)
    WN->>DB: recipients = mentions ∪ watchers ∪ assignees − author, keep canView
    WN->>DB: INSERT notifications ON CONFLICT (recipient_id, source_event_id) DO NOTHING
    WN->>DB: INSERT outbox notification.notification.created per recipient, COMMIT
    WN->>MQ: ack
    MQ->>RT: notification.notification.created
    RT-->>BR: user stream: notification.created, bell +1
    opt email preference on (P2)
      WN->>DB: outbox email.send command (same transaction as the notifications)
      MQ->>WE: email.send (queue tb.email)
      WE->>WE: render in the recipient's locale, send via DeliveryFacade, ack
    end
  end
```

## Notes

- Carol's bell updates on **any** page, because every tab holds one SSE stream that always includes the user channel ([Sequence 19](./19-sse-connection-lifecycle.md)).
- Commands such as `email.send` also go through the outbox. The relay routes `*.send` types to the `tb.commands` exchange.
