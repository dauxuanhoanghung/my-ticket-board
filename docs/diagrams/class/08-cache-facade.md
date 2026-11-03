# Class · Cache facade (Redis / Valkey / Memcached)

> Index: [10 · Infrastructure §4](../../10-infrastructure.md#4-cache-facade) · Decision: [ADR-008](../../11-decisions.md#adr-008) · Flow: [Sequence 21](../sequence/21-cache-aside-and-invalidation.md)

```mermaid
classDiagram
  direction LR
  class CacheFacade {
    <<Facade>>
    -CacheDriver driver
    -Serializer serializer
    -String prefix
    -InflightMap inflight
    +get(key) T
    +getMany(keys) List~T~
    +set(key, value, ttlSeconds) void
    +remember(key, ttlSeconds, loader) T
    +forget(keys) void
    +invalidateTag(tag) void
    +taggedKey(tag, key) String
    +rateLimit(bucket, limit, windowSeconds) RateLimitResult
    +tryLock(name, ttlSeconds) Lease
  }
  class CacheDriver {
    <<interface>>
    +String name
    +get(key) String
    +getMany(keys) List~String~
    +set(key, value, ttlSeconds) void
    +add(key, value, ttlSeconds) boolean
    +delete(keys) void
    +increment(key, by, ttlSeconds) int
    +ping() void
    +close() void
  }
  class RespCacheDriver {
    <<adapter>>
    -Redis client
  }
  note for RespCacheDriver "Serves both Redis and Valkey (RESP-compatible)"
  class MemcachedCacheDriver {
    <<adapter>>
    -MemcachedClient client
  }
  class MemoryCacheDriver {
    <<adapter>>
    -LruMap store
  }
  class Serializer {
    <<interface>>
    +serialize(value) String
    +deserialize(raw) Object
  }
  class CacheKeys {
    <<utility>>
    +boardSnapshot(boardId)$ String
    +boardPermission(boardId, userId)$ String
    +userProfile(userId)$ String
    +viewer(userId)$ String
    +rateLimit(scope, id)$ String
  }
  class CacheDriverFactory {
    +create(config) CacheDriver
  }

  CacheFacade o-- CacheDriver
  CacheFacade o-- Serializer
  CacheFacade ..> CacheKeys
  RespCacheDriver ..|> CacheDriver
  MemcachedCacheDriver ..|> CacheDriver
  MemoryCacheDriver ..|> CacheDriver
  CacheDriverFactory ..> CacheDriver : CACHE_DRIVER
```

## Pattern roles

- **Facade:** `CacheFacade` is the **only** cache API that application code sees. It offers higher-level operations (`remember`, tags, rate limit, lock) built from a minimal driver contract.
- **Adapter / Strategy:** each `CacheDriver` adapts one client library to the contract. `CacheDriverFactory` picks one from `CACHE_DRIVER=redis|valkey|memcached|memory`.
- The driver contract is the **lowest common denominator** of Redis, Valkey and Memcached: no pub/sub, no key scans, no Lua. Anything needing those (realtime fan-out) goes through RabbitMQ instead.
