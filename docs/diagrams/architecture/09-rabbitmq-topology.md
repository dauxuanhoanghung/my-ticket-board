# Architecture · RabbitMQ topology

> Index: [10 · Infrastructure §5](../../10-infrastructure.md#5-messaging-rabbitmq) · Flows: [Sequence 18](../sequence/18-outbox-relay-and-consumers.md) · States: [Message consumption](../state/16-message-consumption.md)

```mermaid
flowchart LR
  relay["Outbox relay<br/>(worker leader)"] -- "rk = event type" --> EV{{"tb.events<br/>topic"}}
  relay -- "rk = email.send" --> CMD{{"tb.commands<br/>direct"}}

  EV -- "board.# · collab.# · storage.#<br/>notification.# · workspace.member.#<br/>identity.session.revoked<br/>identity.user.profile_updated" --> RT["tb.realtime.instanceId<br/>classic · exclusive · auto-delete<br/>consumer: every API instance"]
  EV -- "identity.user.registered<br/>identity.user.verification_requested<br/>identity.user.password_reset_requested<br/>identity.user.password_changed<br/>identity.user.signup_attempted" --> IDM["tb.identity.mailer<br/>quorum"]
  EV -- "workspace.invitation.created" --> INVM["tb.invitation.mailer<br/>quorum"]
  EV -- "collab.comment.created<br/>board.ticket.moved · assignee_added<br/>board.ticket.dates_changed · due_soon<br/>board.member.added<br/>workspace.invitation.created · declined<br/>workspace.member.joined" --> NOTI["tb.notification<br/>quorum"]
  EV -- "storage.attachment.uploaded" --> PREV["tb.attachment.preview<br/>quorum"]
  EV -- "storage.image.uploaded" --> IMGP["tb.image.process<br/>quorum"]
  EV -- "storage.image.ready" --> IMGA["tb.image.apply<br/>quorum"]
  EV -- "board.board.deleted<br/>board.ticket.deleted<br/>storage.attachment.deleted" --> GC["tb.storage.cleanup<br/>quorum"]
  EV -- "workspace.member.removed<br/>workspace.workspace.deleted<br/>identity.user.deleted" --> MSYNC["tb.board.membership-sync<br/>quorum"]
  CMD -- "email.send" --> EMAIL["tb.email<br/>quorum"]

  RETRY{{"tb.retry<br/>direct"}} -- "rk = queue.delay" --> RQ["tb.retry.queue.delay<br/>classic · x-message-ttl<br/>DLX = default exchange<br/>DL routing key = original queue"]
  RQ -. "TTL expires" .-> BACK["original queue"]
  DLX{{"tb.dlx<br/>direct"}} -- "rk = queue" --> DLQ["tb.dlq.queue<br/>quorum · alert when depth > 0"]
```

## Consumers

| Queue | Process | Handler | Prefetch |
|---|---|---|---|
| `tb.realtime.<instanceId>` | api | project to client events, push to the local SSE registry | 200 |
| `tb.identity.mailer` | worker | issue verification/reset token, send identity emails | 10 |
| `tb.invitation.mailer` | worker | issue invitation token, send the invitation email | 10 |
| `tb.notification` | worker | recipient resolution, `notifications` rows, `email.send` commands | 20 |
| `tb.email` | worker | render the localised template, send through `DeliveryFacade` | 5 |
| `tb.attachment.preview` | worker | thumbnails with `sharp` | 2 |
| `tb.image.process` | worker | re-encode avatars and logos into `tb-public` | 2 |
| `tb.image.apply` | worker | run `SetAvatar` or `SetWorkspaceLogo`, delete the previous object | 5 |
| `tb.storage.cleanup` | worker | batch-delete objects in RustFS | 5 |
| `tb.board.membership-sync` | worker | remove board memberships after workspace/user removal | 10 |
