# Class · Shared kernel (`apps/api/src/shared/kernel`)

> Index: [05 · Domain model §2](../../05-domain-model.md#2-tactical-building-blocks)

```mermaid
classDiagram
  direction TB
  class Entity~TId~ {
    <<abstract>>
    #TId id
    +equals(other) boolean
  }
  class AggregateRoot~TId~ {
    <<abstract>>
    -List~DomainEvent~ pendingEvents
    #int version
    #raise(event) void
    +pullEvents() List~DomainEvent~
    +getVersion() int
  }
  class ValueObject~TProps~ {
    <<abstract>>
    #TProps props
    +equals(other) boolean
  }
  class DomainEvent {
    <<interface>>
    +String eventId
    +String eventType
    +int eventVersion
    +String aggregateType
    +String aggregateId
    +DateTime occurredAt
    +Object payload
  }
  class DomainError {
    <<abstract>>
    +String code
    +String message
    +Object details
  }
  class Result~T~ {
    +ok(value)$ Result
    +fail(error)$ Result
    +isOk() boolean
    +unwrap() T
  }
  class Repository~TAggregate~ {
    <<interface>>
    +findById(id) TAggregate
    +save(aggregate) void
  }
  class UnitOfWork {
    <<interface>>
    +run(work) Promise
    +afterCommit(hook) void
  }
  class Clock {
    <<interface>>
    +now() DateTime
  }
  class IdGenerator {
    <<interface>>
    +uuidv7() String
    +shortId() String
  }
  class Actor {
    <<ValueObject>>
    +UserId userId
    +SessionId sessionId
    +String correlationId
    +String clientMutationId
  }

  Entity <|-- AggregateRoot
  AggregateRoot o-- "0..*" DomainEvent : pendingEvents
  Repository ..> AggregateRoot : loads / saves
  UnitOfWork ..> Repository : provides tx-bound
  DomainError <.. Result : error type
```

## Conventions

- **Pure TypeScript.** No decorators, no ORM types, no Nest imports in anything shown here.
- Aggregates **raise** events. The `UnitOfWork` **pulls** them after `save()` and hands them to the activity recorder and the outbox writer inside the same transaction.
- `Actor` travels from the resolver into every command. Its `correlationId` and `clientMutationId` end up in outbox metadata and realtime events.
- `DomainError.message` is a developer-facing English fallback. Users see text translated from `code` at the interface layer ([12 · Internationalisation](../../12-internationalisation.md)).
- IDs are branded string types (`type TicketId = string & { __brand: 'TicketId' }`) to stop mixing ids of different aggregates.
