# Sequence 22 · Locale propagation (web, API, worker)

> Index: [07 · Sequence flows](../../07-sequence-flows.md) · Design: [12 · Internationalisation](../../12-internationalisation.md) · Decision: [ADR-023](../../11-decisions.md#adr-023)

```mermaid
sequenceDiagram
  autonumber
  actor U as User
  participant B as Browser
  participant N as Next.js (server or browser client)
  participant A as API (I18nModule)
  participant DB as PostgreSQL
  participant W as Worker

  B->>N: GET /b/Ab12Cd34 (cookie tb_locale, browser Accept-Language)
  N->>N: resolveLocale: cookie, else browser match, else en
  N->>A: GraphQL with Accept-Language = resolved locale
  A->>A: AcceptLanguageResolver sets the request locale
  alt domain or validation error
    A->>A: exception filter translates the message from the error code
    A-->>N: errors[0].message translated, extensions.code unchanged
  else success
    A-->>N: data (user content and codes, no translated text)
  end
  N-->>B: page rendered with messages for the resolved locale
  U->>B: Change language in settings
  B->>N: Server Action updateProfile(locale)
  N->>A: mutation updateProfile(locale)
  A->>DB: UPDATE users SET locale
  A-->>N: ok
  N-->>B: Set-Cookie tb_locale, refresh the page
  Note over A,W: later, an email is sent with no request to read a header from
  W->>DB: SELECT locale of the recipient
  W->>W: render the template in the recipient's locale
  W->>W: send through DeliveryFacade
```

## Notes

- The BFF replaces the browser's `Accept-Language`, so the API always receives one supported value.
- Notifications and activities aren't translated on the server. They're stored as `type` + `data` and rendered by the web app in the viewer's language.
