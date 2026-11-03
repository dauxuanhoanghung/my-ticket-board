# Sequence 21 · Cache-aside read and invalidation through the CacheFacade

> Index: [07 · Sequence flows](../../07-sequence-flows.md) · Class: [Cache facade](../class/08-cache-facade.md) · Infrastructure: [10 §4](../../10-infrastructure.md#4-cache-facade)

```mermaid
sequenceDiagram
  autonumber
  participant Q as Query handler
  participant F as CacheFacade
  participant D as CacheDriver (Valkey, Redis or Memcached)
  participant DB as PostgreSQL
  participant H as Command handler

  Q->>F: remember(board snapshot key, 60 s, loader)
  F->>D: get(key)
  alt hit
    D-->>F: json
    F-->>Q: snapshot
  else miss
    F->>F: single-flight: join an in-flight load for the same key if one exists
    F->>DB: loader() runs the snapshot SQL
    DB-->>F: rows
    F->>D: set(key, json, 60 s)
    F-->>Q: snapshot
  else driver error or timeout over 50 ms
    F->>F: log a warning, treat as a miss (fail-open)
    F->>DB: loader()
    F-->>Q: snapshot
  end
  H->>DB: COMMIT the command transaction
  H->>F: afterCommit forget(board snapshot key)
  F->>D: delete(keys)
  H->>F: afterCommit, schedule a second forget in 2 s
  H->>F: afterCommit invalidateTag(board permissions) on membership changes
  F->>D: increment(tag version key)
  Note over F,D: tagged keys embed the tag version, so bumping it orphans all of them at once.<br/>This works on Memcached, which can't delete by pattern.
```

## Notes

- **Stale-set race:** a reader that loaded old rows just before the commit can write them *after* the delete. The delayed second delete and the short TTL bound this window. Realtime events correct open clients regardless.
- **Fail-open everywhere.** The cache is an optimisation. Rate limiting also fails open (configurable per bucket).
- What's cached, and for how long: [10 · Infrastructure §4](../../10-infrastructure.md#4-cache-facade).
