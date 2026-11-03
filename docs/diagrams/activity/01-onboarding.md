# Activity · First-run onboarding

> Index: [03 · Use cases](../../03-use-cases.md) · Use cases: [Account](../use-case/01-account.md), [Workspace](../use-case/02-workspace.md)

```mermaid
flowchart TD
  S((start)) --> A["Open app"]
  A --> B{"Signed in?"}
  B -- no --> C{"Has account?"}
  C -- no --> D["Sign up"] --> E["Verify email via link"] --> F["Auto sign-in"]
  C -- yes --> G["Log in"] --> H{"Email verified?"}
  H -- no --> I["Show 'verify your email' + resend"] --> E
  H -- yes --> F
  B -- yes --> J{"Member of any workspace?"}
  F --> J
  J -- no --> K{"Pending invitations?"}
  K -- yes --> L["Show invitations"] --> M{"Accept?"}
  M -- yes --> N["Join workspace / board"] --> P["Open home"]
  M -- no --> O["Create first workspace"]
  K -- no --> O
  O --> Q["Create first board<br/>(Basic template suggested)"] --> R["Open board"]
  J -- yes --> P
  P --> Z((end))
  R --> Z
```

## Notes

- "Pending invitations" means invitations addressed to the user's verified email that are still `pending`. They show even though the user arrived without clicking the invite link.
- The first workspace slug is derived from the user's name (`alex-workspace`), and the user can edit it.
