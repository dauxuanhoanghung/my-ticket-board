# State · RabbitMQ message consumption (per consumer)

> Index: [08 · State machines](../../08-state-machines.md) · Sequence: [18](../sequence/18-outbox-relay-and-consumers.md) · Topology: [RabbitMQ](../architecture/09-rabbitmq-topology.md)

```mermaid
stateDiagram-v2
  [*] --> Delivered : broker delivers (prefetch window)
  Delivered --> Duplicate : processed_messages conflict
  Duplicate --> Acked : ack without side effects
  Delivered --> Processing : first delivery
  Processing --> Acked : success (commit, then ack)
  Processing --> RetryScheduled : transient error, attempt 5 or fewer
  RetryScheduled --> Delivered : TTL expires, dead-lettered back to the queue
  Processing --> DeadLettered : permanent error, or more than 5 attempts
  DeadLettered --> Delivered : manual replay (admin script)
  Acked --> [*]
```

| Error class | Examples | Path |
|---|---|---|
| Transient | DB deadlock, SMTP 4xx, RustFS timeout | `RetryScheduled` |
| Permanent | invalid payload, unknown event version, referenced row gone and not recoverable | `DeadLettered` |
| Expected no-op | ticket already deleted, recipient lost access | `Acked` (log at debug) |
