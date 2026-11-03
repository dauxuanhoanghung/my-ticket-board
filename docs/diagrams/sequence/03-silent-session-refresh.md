# Sequence 03 · Silent session refresh (refresh-token rotation)

> Index: [07 · Sequence flows](../../07-sequence-flows.md) · State: [Session](../state/02-session.md) · Decision: [ADR-004](../../11-decisions.md#adr-004)

```mermaid
sequenceDiagram
  autonumber
  participant B as Browser
  participant P as Next.js proxy.ts
  participant RSC as Server Component or route handler
  participant A as API (Identity)
  participant DB as PostgreSQL

  B->>P: GET /b/Ab12Cd34 (cookies tb_at, tb_rt)
  P->>P: decode tb_at exp (signature is checked later by the API)
  alt tb_at valid for more than 60 s
    P->>RSC: continue
  else tb_at missing or expiring, tb_rt present
    P->>A: mutation refreshSession(refreshToken)
    A->>DB: BEGIN, SELECT session WHERE refresh_token_hash = h OR previous_token_hash = h FOR UPDATE
    alt matches current hash and session active
      A->>DB: previous = current, current = new hash, rotated_at and last_used_at = now, COMMIT
      A-->>P: new accessToken + new refreshToken
      P->>P: set cookies on the response AND on the forwarded request headers
      P->>RSC: continue with the fresh tb_at
    else matches previous hash within the 10 s grace window
      A-->>P: new accessToken only (the parallel winner already rotated tb_rt)
      P->>RSC: continue
    else matches previous hash outside the grace window
      A->>DB: revoke session (reason reuse_detected), outbox identity.session.revoked, COMMIT
      A-->>P: SESSION_REVOKED
      P-->>B: clear cookies, redirect /login
    else no match, expired or revoked
      A-->>P: UNAUTHENTICATED
      P-->>B: clear cookies, redirect /login?next=...
    end
  else no session cookies
    P-->>B: redirect /login?next=... (protected routes only)
  end
  RSC->>A: GraphQL with Authorization Bearer tb_at
  A-->>RSC: data
  RSC-->>B: HTML / RSC payload
```

## Notes

- **Why in `proxy.ts`:** Server Components can't set cookies during render. The proxy (Next.js 16's renamed middleware) runs first, so it can rotate tokens and expose the new access token to the same request.
- **Grace window:** two tabs firing at once both send the old refresh token. The first rotates it. The second matches `previous_token_hash` within 10 s and gets only a new access token. The browser already holds the new `tb_rt` from the first response.
- **Reuse detection:** an old refresh token presented later means it was copied, so the whole session is revoked.
- `/api/graphql` and `/api/realtime` share the same refresh helper. Client-side, a `401` from `/api/graphql` triggers one transparent retry after the proxy refreshes.
