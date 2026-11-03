# Sequence 05 · Forgot / reset password

> Index: [07 · Sequence flows](../../07-sequence-flows.md) · Use case: [Account](../use-case/01-account.md) · State: [Verification token](../state/03-verification-token.md)

```mermaid
sequenceDiagram
  autonumber
  actor U as User
  participant B as Browser
  participant N as Next.js BFF
  participant A as API (Identity)
  participant DB as PostgreSQL
  participant MQ as RabbitMQ
  participant W as Worker
  participant M as SMTP

  U->>B: "Forgot password", enter email
  B->>N: Server Action requestPasswordReset(email)
  N->>A: mutation requestPasswordReset(email)
  A->>A: rate limit per IP and per email
  opt user exists and is active
    A->>DB: INSERT outbox identity.user.password_reset_requested
  end
  A-->>N: ok (always the same response)
  N-->>B: "If an account exists, we sent a link"
  MQ->>W: identity.user.password_reset_requested (via outbox relay)
  W->>DB: invalidate older reset tokens, INSERT token (TTL 1 h)
  W->>M: send reset link with the raw token
  U->>B: Open the link, enter a new password
  B->>N: Server Action resetPassword(token, newPassword)
  N->>A: mutation resetPassword(token, newPassword)
  A->>DB: BEGIN, SELECT token FOR UPDATE
  alt invalid or expired
    A->>DB: ROLLBACK
    A-->>N: TOKEN_INVALID
    N-->>B: "Link expired, request a new one"
  else valid
    A->>A: password policy, argon2id hash
    A->>DB: UPDATE user_credentials, consume token
    A->>DB: revoke ALL sessions of the user (reason password_changed)
    A->>DB: INSERT outbox identity.user.password_changed + identity.session.revoked
    A->>DB: COMMIT
    A-->>N: ok
    N-->>B: redirect /login with a success message
  end
  MQ->>W: identity.user.password_changed
  W->>M: "Your password was changed" security notice
```
