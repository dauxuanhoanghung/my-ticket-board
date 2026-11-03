# Sequence 01 · Sign up and verify email

> Index: [07 · Sequence flows](../../07-sequence-flows.md) · Use case: [UC-ACC-01](../use-case/01-account.md#uc-acc-01--sign-up) · States: [User](../state/01-user-account.md), [Verification token](../state/03-verification-token.md)

```mermaid
sequenceDiagram
  autonumber
  actor U as User
  participant B as Browser
  participant N as Next.js BFF
  participant A as API (Identity)
  participant DB as PostgreSQL
  participant R as Outbox relay (worker)
  participant MQ as RabbitMQ
  participant W as Worker (identity mailer)
  participant M as SMTP / Mailpit

  U->>B: Fill sign-up form
  B->>N: Server Action signUp(email, fullName, password)
  N->>N: zod validation
  N->>A: mutation register(input)
  A->>A: Email VO, password policy, derive username and initials
  A->>DB: BEGIN
  A->>DB: SELECT id FROM users WHERE email = $1
  alt email already registered
    A->>DB: INSERT outbox identity.user.signup_attempted
    A->>DB: COMMIT
    A-->>N: ok (same response, prevents enumeration)
  else new email
    A->>A: argon2id hash
    A->>DB: INSERT users (pending_verification) and user_credentials
    A->>DB: INSERT outbox identity.user.registered
    A->>DB: COMMIT
    A-->>N: ok
  end
  N-->>B: redirect /verify-email?sent=1
  Note over DB,R: outbox trigger fires pg_notify on commit
  R->>DB: SELECT pending outbox FOR UPDATE SKIP LOCKED
  R->>MQ: publish identity.user.registered
  R->>DB: UPDATE published_at
  MQ->>W: deliver (queue tb.identity.mailer)
  W->>DB: invalidate older tokens, INSERT verification_tokens (sha256 of raw token, 24 h)
  W->>M: send "Verify your email" with a link containing the raw token
  W->>MQ: ack
  U->>B: Click the link in the email
  B->>N: GET /verify-email?token=raw
  N->>A: mutation verifyEmail(token)
  A->>DB: BEGIN, SELECT token by sha256 FOR UPDATE
  alt invalid, consumed or expired
    A-->>N: TOKEN_INVALID
    N-->>B: page with a "Resend email" button
  else valid
    A->>DB: UPDATE users SET status active, email_verified_at
    A->>DB: consume token, INSERT sessions, outbox identity.user.email_verified, COMMIT
    A-->>N: AuthPayload (accessToken, refreshToken, expiresAt)
    N-->>B: Set-Cookie tb_at and tb_rt, redirect /onboarding
  end
```

## Notes

- **The raw token never leaves the worker except inside the email.** The API emits an event, and the worker creates the token, stores only its hash, and sends the link. Nothing secret sits in the outbox or in RabbitMQ.
- Verification signs the user in directly. The link proves control of the inbox.
- "Resend email" → `resendVerification(email)` → `identity.user.verification_requested` → same worker path, rate-limited to 3 per hour.
