# Activity · Accept invitation

> Index: [03 · Use cases](../../03-use-cases.md) · Use case: [UC-WSP-04/05](../use-case/02-workspace.md#uc-wsp-0405--invite-and-accept) · Sequence: [07](../sequence/07-invite-and-accept-invitation.md) · State: [Invitation](../state/04-invitation.md)

```mermaid
flowchart TD
  S((start)) --> A["GET /invite/:token"]
  A --> B{"Token found and status = pending?"}
  B -- no --> X1["Show 'invitation invalid or already used'"] --> Z((end))
  B -- yes --> C{"Expired?"}
  C -- yes --> X2["Mark expired, show 'ask for a new invite'"] --> Z
  C -- no --> D{"Signed in?"}
  D -- no --> E["Redirect to login/sign-up with next=/invite/:token"] --> D
  D -- yes --> F["Show invitation: scope, inviter, role"]
  F --> G{"User decision"}
  G -- decline --> H["status = declined, notify inviter"] --> Z
  G -- accept --> I{"Scope"}
  I -- workspace --> J{"Already workspace member?"}
  J -- yes --> K["status = accepted (no-op)"]
  J -- no --> L["Add workspace_members(role)"] --> K
  I -- board --> M{"Already board member?"}
  M -- yes --> K
  M -- no --> N["Add board_members(role)<br/>guest if not a workspace member"] --> K
  K --> O["Emit workspace.invitation.accepted + member events"]
  O --> P["Redirect to workspace / board"] --> Z
```

## Notes

- Steps after "accept" run in **one transaction**: lock the invitation row (`FOR UPDATE`), re-check status, insert membership, update the invitation, write the outbox.
- A board invitation always carries the board's `workspace_id`. The invitee becomes a **guest** unless they're already a workspace member.
