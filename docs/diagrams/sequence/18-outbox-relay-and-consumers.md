# Sequence 18 · Outbox relay, consumers, retry and dead-letter

> Index: [07 · Sequence flows](../../07-sequence-flows.md) · ERD: [Infrastructure tables](../erd/04-infrastructure-tables.md) · States: [Outbox event](../state/13-outbox-event.md), [Message consumption](../state/16-message-consumption.md) · Topology: [RabbitMQ](../architecture/09-rabbitmq-topology.md)

```mermaid
sequenceDiagram
  autonumber
  participant API as API (command handler)
  participant DB as PostgreSQL
  participant R as Relay (worker, leader)
  participant MQ as RabbitMQ
  participant Q as Consumer (e.g. notification)
  participant RQ as Retry queue (TTL)
  participant DLQ as Dead-letter queue

  R->>DB: pg_try_advisory_lock(outbox-relay) on a dedicated connection
  Note over R: only the lock holder relays, other workers stay standby and retry every 10 s
  R->>DB: LISTEN outbox_new
  API->>DB: COMMIT a transaction that inserted outbox_events
  DB-->>R: NOTIFY outbox_new (delivered on commit)
  loop until the batch is empty (plus a 1 s polling fallback)
    R->>DB: BEGIN, SELECT pending WHERE available_at ≤ now ORDER BY id LIMIT 200 FOR UPDATE SKIP LOCKED
    R->>MQ: publish each (persistent, message_id = event id, publisher confirms)
    alt all confirms received
      R->>DB: UPDATE published_at = now(), COMMIT
    else broker unavailable or nack
      R->>DB: attempts + 1, available_at = now + backoff, last_error, COMMIT
    end
  end
  MQ->>Q: deliver (prefetch 20, manual ack)
  Q->>DB: BEGIN, INSERT processed_messages (consumer, message_id)
  alt duplicate (already processed)
    Q->>DB: ROLLBACK
    Q->>MQ: ack
  else first delivery
    Q->>Q: handle (side effects in the same transaction)
    alt success
      Q->>DB: COMMIT
      Q->>MQ: ack
    else transient failure and attempt n ≤ 5
      Q->>DB: ROLLBACK
      Q->>RQ: publish to tb.retry with x-retry-count n (TTL 5 s, 30 s, 2 min, 10 min, 30 min)
      Q->>MQ: ack the original
      RQ-->>MQ: TTL expires, dead-lettered back to the original queue
    else permanent failure or n over 5
      Q->>DB: ROLLBACK
      Q->>DLQ: publish to tb.dlx with the original headers + error
      Q->>MQ: ack the original
    end
  end
```

## Guarantees

| Property | How |
|---|---|
| **No lost events** | Event row commits atomically with the state change. Relay retries until confirmed |
| **At-least-once delivery** | A crash between publish and `published_at` update causes a republish |
| **Exactly-once effects** | Consumers dedupe on `(consumer, message_id)` inside their own transaction |
| **Order** | Single relay leader publishes in `id` (UUIDv7) order. Consumers with prefetch > 1 may reorder, so consumers that care (realtime) use entity `version` |
| **Poison messages** | Go to `tb.dlq.<queue>` after 5 retries. Alert on DLQ depth > 0. Replay via an admin script |
