# State · Session (refresh-token rotation)

> Index: [08 · State machines](../../08-state-machines.md) · Table: `sessions` · Sequences: [02](../sequence/02-login.md), [03](../sequence/03-silent-session-refresh.md), [04](../sequence/04-logout-and-session-revocation.md)

```mermaid
stateDiagram-v2
  [*] --> Active : login or verifyEmail
  Active --> Active : refresh with current token (rotate, previous kept)
  Active --> Active : previous token within 10 s grace (access token only)
  Active --> Revoked : logout
  Active --> Revoked : password changed or reset
  Active --> Revoked : previous token reused after grace (reuse detected)
  Active --> Revoked : user suspended or deleted
  Active --> Expired : expires_at passed
  Revoked --> [*] : purged after 30 days
  Expired --> [*] : purged after 30 days

  note right of Active
    expires_at slides 30 days on each rotation
    absolute cap 90 days after login
  end note
```

On entering `Revoked`, the API writes the revoked-sid cache marker and emits `identity.session.revoked`. That closes the session's SSE streams.
