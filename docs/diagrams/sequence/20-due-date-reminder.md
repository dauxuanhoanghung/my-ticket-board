# Sequence 20 · Due-date reminder (P2)

> Index: [07 · Sequence flows](../../07-sequence-flows.md) · State: [Due status](../state/09-ticket-due-status.md) · Use case: [Collaboration](../use-case/05-collaboration.md)

```mermaid
sequenceDiagram
  autonumber
  participant S as Scheduler (worker, every minute)
  participant DB as PostgreSQL
  participant MQ as RabbitMQ
  participant WN as Worker (notification)
  participant RT as Realtime gateways
  participant BR as Recipient browsers
  participant WE as Worker (email)

  S->>DB: BEGIN
  S->>DB: SELECT tickets WHERE due_reminder_at ≤ now AND due_reminded_at IS NULL AND not completed AND not archived LIMIT 500 FOR UPDATE SKIP LOCKED
  S->>DB: UPDATE due_reminded_at = now
  S->>DB: INSERT outbox board.ticket.due_soon per ticket
  S->>DB: COMMIT
  MQ->>WN: board.ticket.due_soon
  WN->>DB: recipients = assignees ∪ watchers, INSERT notifications DUE_SOON
  WN->>DB: outbox notification.created (+ email.send when the preference is on)
  MQ->>RT: notification.notification.created
  RT-->>BR: user stream: notification.created
  MQ->>WE: email.send
  WE->>WE: send "Ticket #42 is due in 1 hour"
  Note over S,DB: changing the due date or the reminder offset resets due_reminded_at to null
```

## Notes

- `SKIP LOCKED` lets several workers run the job safely. Each row is claimed once.
- Reminders are evaluated in UTC. The email renders times in the recipient's `time_zone`.
