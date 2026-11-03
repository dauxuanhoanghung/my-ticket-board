# State · Invitation

> Index: [08 · State machines](../../08-state-machines.md) · Column: `invitations.status` · Sequence: [07](../sequence/07-invite-and-accept-invitation.md) · Activity: [Accept invitation](../activity/02-accept-invitation.md)

```mermaid
stateDiagram-v2
  [*] --> Pending : invite
  state Pending {
    [*] --> AwaitingToken
    AwaitingToken --> Sent : worker issues token and emails it
    Sent --> Sent : resend (new token, old link dies)
  }
  Pending --> Accepted : accept (membership created)
  Pending --> Declined : decline (inviter notified)
  Pending --> Revoked : inviter or admin revokes
  Pending --> Expired : expires_at passed (scheduler, or checked on access)
  Accepted --> [*]
  Declined --> [*]
  Revoked --> [*]
  Expired --> [*]
```

- Terminal states are kept for audit ("invited by X on …").
- A new invitation to the same email is allowed once the previous one has left `Pending` (partial unique index).
