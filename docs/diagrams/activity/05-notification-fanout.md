# Activity · Notification fan-out (worker)

> Index: [03 · Use cases](../../03-use-cases.md) · Use case: [UC-TKT-12](../use-case/05-collaboration.md#uc-tkt-12--comment-with-mention) · Sequence: [15](../sequence/15-comment-mention-notification.md) · State: [Notification](../state/12-notification.md)

```mermaid
flowchart TD
  S((event received)) --> A{"Already processed?<br/>(processed_messages)"}
  A -- yes --> ACK["ack"] --> Z((end))
  A -- no --> B["Resolve candidate recipients by event type"]
  B --> C["mentioned ∪ assignees ∪ watchers ∪ explicit target"]
  C --> D["Remove actor"]
  D --> E["Remove users who can no longer view the board"]
  E --> F{"Any recipients left?"}
  F -- no --> G["Mark processed"] --> ACK
  F -- yes --> H["INSERT notifications (one per recipient)"]
  H --> I["Outbox: notification.notification.created per recipient"]
  I --> J{"Email enabled for user and type? (P2)"}
  J -- yes --> K["Publish email.send command"]
  J -- no --> G
  K --> G
```

## Recipient rules per event

| Event | Notification type | Recipients |
|---|---|---|
| `collab.comment.created` | `COMMENT_MENTION` / `COMMENT_ON_WATCHED` | mentioned users (mention wins) · watchers · assignees |
| `board.ticket.assignee_added` | `ASSIGNED_TO_TICKET` | the added assignee |
| `board.ticket.moved` | `TICKET_MOVED` | watchers |
| `board.ticket.dates_changed` | `DUE_DATE_CHANGED` | watchers · assignees |
| `board.ticket.due_soon` (P2) | `DUE_SOON` | assignees · watchers |
| `board.member.added` | `ADDED_TO_BOARD` | the added member |
| `workspace.invitation.created` | `INVITATION_RECEIVED` | existing user with that email |
| `workspace.member.joined` | `INVITATION_ACCEPTED` | inviter |

Every type always excludes the actor. A user gets **one** notification per event, even when several rules match. The highest-priority type wins.
