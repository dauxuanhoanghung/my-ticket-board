# Sequence 02 · Log in

> Index: [07 · Sequence flows](../../07-sequence-flows.md) · Use case: [UC-ACC-03/04](../use-case/01-account.md#uc-acc-0304--log-in-and-silent-refresh) · State: [Session](../state/02-session.md)

```mermaid
sequenceDiagram
  autonumber
  actor U as User
  participant B as Browser
  participant N as Next.js BFF
  participant A as API (Identity)
  participant C as Cache
  participant DB as PostgreSQL

  U->>B: Submit email and password
  B->>N: Server Action login(email, password, next)
  N->>A: mutation login(input) + x-forwarded-for, user-agent
  A->>C: increment rl:login:ip and rl:login:email (TTL 15 min)
  alt over limit
    A-->>N: RATE_LIMITED (retryAfter)
    N-->>B: form error
  else under limit
    A->>DB: SELECT user + credentials WHERE email
    A->>A: argon2 verify (dummy hash when the user is missing, equal timing)
    alt wrong password or unknown user
      A->>DB: UPDATE failed_attempts (when the user exists)
      A-->>N: INVALID_CREDENTIALS
      N-->>B: generic error
    else status pending_verification
      A-->>N: EMAIL_NOT_VERIFIED
      N-->>B: show "resend verification email"
    else active
      A->>DB: reset failed_attempts, INSERT sessions (hash of new refresh token, expires in 30 d)
      A->>A: sign access JWT (sub, sid, exp 15 min)
      A->>C: delete rl:login:email
      A-->>N: AuthPayload (accessToken, refreshToken, accessExpiresAt)
      N->>N: Set-Cookie tb_at (15 min) and tb_rt (30 d), httpOnly, Secure, SameSite=Lax
      N-->>B: 303 redirect to next or /
    end
  end
```

## Notes

- `next` is validated against an allowlist of relative paths (no open redirects).
- `suspended` users get `ACCOUNT_SUSPENDED`. The response for `deleted` users is indistinguishable from unknown ones.
- Account lockout: after 10 failures, `locked_until = now + 15 min`, on top of the rate limit.
