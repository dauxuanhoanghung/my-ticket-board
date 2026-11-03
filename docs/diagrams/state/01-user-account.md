# State · User account

> Index: [08 · State machines](../../08-state-machines.md) · Column: `users.status` · Class: [Identity](../class/02-identity.md) · Sequences: [01](../sequence/01-sign-up-and-verify-email.md), [02](../sequence/02-login.md)

```mermaid
stateDiagram-v2
  [*] --> PendingVerification : register
  PendingVerification --> Active : verifyEmail
  PendingVerification --> [*] : purged when unverified after 30 days
  Active --> Active : updateProfile, changePassword
  Active --> Suspended : operator suspends
  Suspended --> Active : operator reinstates
  Active --> Deleted : deleteAccount (anonymise PII)
  Suspended --> Deleted : deleteAccount
  Deleted --> [*]

  note right of PendingVerification
    cannot log in
    resend verification, max 3 per hour
  end note
  note right of Deleted
    row kept for FK integrity
    email becomes deleted+id@invalid
    name becomes "Deleted user"
    all sessions revoked, memberships removed
  end note
```

| State | Can log in | Visible to others |
|---|---|---|
| `pending_verification` | ❌ (`EMAIL_NOT_VERIFIED`) | ❌ |
| `active` | ✅ | ✅ |
| `suspended` | ❌ (`ACCOUNT_SUSPENDED`) | ✅ (greyed out) |
| `deleted` | ❌ | as "Deleted user" in history |
