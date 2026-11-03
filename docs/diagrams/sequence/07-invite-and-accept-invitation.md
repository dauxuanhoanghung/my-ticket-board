# Sequence 07 · Invite member and accept invitation

> Index: [07 · Sequence flows](../../07-sequence-flows.md) · Use case: [UC-WSP-04/05](../use-case/02-workspace.md#uc-wsp-0405--invite-and-accept) · Activity: [Accept invitation](../activity/02-accept-invitation.md) · State: [Invitation](../state/04-invitation.md)

```mermaid
sequenceDiagram
  autonumber
  actor I as Inviter (workspace admin)
  participant B1 as Inviter browser
  participant N as Next.js BFF
  participant A as API (Workspace)
  participant DB as PostgreSQL
  participant MQ as RabbitMQ
  participant W as Worker
  participant M as SMTP
  actor V as Invitee
  participant B2 as Invitee browser

  I->>B1: Invite alice@example.com as member
  B1->>N: Server Action inviteToWorkspace(workspaceId, emails, role)
  N->>A: mutation inviteToWorkspace(input)
  A->>A: WorkspacePolicy can invite
  A->>DB: BEGIN, skip emails that already belong to members
  A->>DB: INSERT invitations (pending, no token yet, expires in 7 d)
  A->>DB: INSERT outbox workspace.invitation.created, COMMIT
  A-->>N: invitations
  N-->>B1: show the pending list
  MQ->>W: workspace.invitation.created (via outbox relay)
  W->>DB: UPDATE invitations SET token_hash WHERE token_hash IS NULL
  W->>M: email the invite link /invite/rawToken
  opt the email belongs to an existing user
    W->>DB: INSERT notifications INVITATION_RECEIVED + outbox notification.created
  end
  V->>B2: Click the link
  B2->>N: GET /invite/rawToken
  N-->>B2: no session, redirect /login?next=/invite/rawToken
  V->>B2: Log in (or sign up and verify)
  B2->>N: GET /invite/rawToken (signed in)
  N->>A: query invitationByToken(token)
  A-->>N: scope, workspace name, inviter, role, status
  N-->>B2: Accept / Decline page
  V->>B2: Accept
  B2->>N: Server Action acceptInvitation(token)
  N->>A: mutation acceptInvitation(token)
  A->>DB: BEGIN, SELECT invitation by token hash FOR UPDATE
  alt not pending or expired
    A->>DB: ROLLBACK
    A-->>N: INVITATION_INVALID
    N-->>B2: explanation page
  else workspace-scoped
    A->>DB: INSERT workspace_members ON CONFLICT DO NOTHING
    A->>DB: UPDATE invitation accepted + outbox workspace.invitation.accepted, workspace.member.joined
    A->>DB: COMMIT
    A-->>N: target workspace slug
    N-->>B2: redirect /w/slug
  else board-scoped
    A->>A: BoardMembershipWriter.addBoardMember (Board invariants apply)
    A->>DB: INSERT board_members (guest when not a workspace member)
    A->>DB: UPDATE invitation accepted + outbox workspace.invitation.accepted, board.member.added
    A->>DB: COMMIT
    A-->>N: target board shortId
    N-->>B2: redirect /b/shortId
  end
  Note over MQ,W: realtime pushes member.added to board viewers, and the notification worker tells the inviter
```

## Notes

- The token is issued by the worker, like verification tokens, so the raw token never sits in the outbox or queue. **Shareable link** invitations (P2) are the exception: the API returns the link to the inviter directly, because the inviter is authorised to see it.
- "Resend invitation" issues a new token and invalidates the old link.
