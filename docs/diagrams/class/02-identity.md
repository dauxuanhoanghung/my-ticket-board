# Class · Identity context

> Index: [05 · Domain model §3.1](../../05-domain-model.md#31-identity) · Tables: [ERD 01](../erd/01-identity-workspace.md) · States: [User](../state/01-user-account.md), [Session](../state/02-session.md), [Token](../state/03-verification-token.md)

```mermaid
classDiagram
  direction LR
  class User {
    <<AggregateRoot>>
    +UserId id
    +Email email
    +Username username
    +FullName fullName
    +Initials initials
    +UserStatus status
    +DateTime emailVerifiedAt
    +String avatarKey
    +register(email, username, fullName, passwordHash)$ User
    +verifyEmail(now) void
    +changePassword(newHash) void
    +updateProfile(profile) void
    +changeEmail(newEmail) void
    +suspend(reason) void
    +delete(now) void
  }
  class Credential {
    <<Entity>>
    +PasswordHash hash
    +DateTime changedAt
    +int failedAttempts
    +DateTime lockedUntil
    +recordFailure(now) void
    +resetFailures() void
  }
  class Session {
    <<AggregateRoot>>
    +SessionId id
    +UserId userId
    +TokenHash currentTokenHash
    +TokenHash previousTokenHash
    +DateTime rotatedAt
    +DateTime expiresAt
    +DateTime revokedAt
    +start(userId, tokenHash, ttl)$ Session
    +rotate(presentedHash, newHash, now) RotationResult
    +revoke(reason) void
  }
  class VerificationToken {
    <<AggregateRoot>>
    +TokenId id
    +UserId userId
    +TokenPurpose purpose
    +TokenHash hash
    +DateTime expiresAt
    +DateTime consumedAt
    +issue(userId, purpose, ttl)$ VerificationToken
    +consume(now) void
  }
  class Email {
    <<ValueObject>>
    +String value
    +create(raw)$ Email
  }
  class Username {
    <<ValueObject>>
    +String value
    +fromFullName(name)$ Username
  }
  class PasswordHash {
    <<ValueObject>>
    +String argon2id
  }
  class TokenHash {
    <<ValueObject>>
    +Bytes sha256
    +of(rawToken)$ TokenHash
  }
  class UserStatus {
    <<enumeration>>
    PENDING_VERIFICATION
    ACTIVE
    SUSPENDED
    DELETED
  }
  class TokenPurpose {
    <<enumeration>>
    EMAIL_VERIFICATION
    PASSWORD_RESET
    EMAIL_CHANGE
  }
  class RotationResult {
    <<enumeration>>
    ROTATED
    GRACE_REUSE
    REUSE_DETECTED
  }
  class PasswordHasher {
    <<port>>
    +hash(plain) PasswordHash
    +verify(plain, hash) boolean
  }
  class AccessTokenSigner {
    <<port>>
    +sign(userId, sessionId, ttl) String
    +verify(jwt) Claims
  }

  User "1" *-- "0..1" Credential : OAuth-only users have none
  User --> UserStatus
  User --> Email
  User --> Username
  Credential --> PasswordHash
  Session "0..*" --> "1" User : userId
  Session --> TokenHash
  Session ..> RotationResult
  VerificationToken "0..*" --> "1" User : userId
  VerificationToken --> TokenPurpose
```

## Invariants

| Invariant | Enforced by |
|---|---|
| Email unique (case-insensitive) | `citext UNIQUE` + `EmailTaken` domain error |
| Username: `^[a-z0-9_]{3,30}$`, unique | `Username` VO + DB constraint |
| Only `ACTIVE` users can log in | `LoginHandler` |
| A raw token is never persisted. Only its SHA-256 | `TokenHash` VO |
| Issuing a new token of the same purpose invalidates older unconsumed ones | `VerificationToken.issue` + repository |
| Refresh reuse outside the 10 s grace window revokes the session | `Session.rotate` |
| Password change revokes every other session | `ChangePasswordHandler` |
