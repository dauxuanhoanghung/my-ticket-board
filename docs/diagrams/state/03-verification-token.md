# State · Verification token (email verification, password reset, email change)

> Index: [08 · State machines](../../08-state-machines.md) · Table: `verification_tokens` · Sequences: [01](../sequence/01-sign-up-and-verify-email.md), [05](../sequence/05-password-reset.md)

```mermaid
stateDiagram-v2
  [*] --> Issued : worker issues (only the sha256 hash is stored)
  Issued --> Consumed : valid use before expiry
  Issued --> Expired : TTL passed
  Issued --> Superseded : newer token issued for the same user and purpose
  Consumed --> [*] : purged after 7 days
  Expired --> [*] : purged after 7 days
  Superseded --> [*] : deleted immediately
```

| Purpose | TTL | On consume |
|---|---|---|
| `email_verification` | 24 h | user → `active`, session created |
| `password_reset` | 1 h | password replaced, all sessions revoked |
| `email_change` (P2) | 24 h | `users.email` = `new_email`, notice sent to the old address |
