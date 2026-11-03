# UI · Frontend component tree (Next.js App Router)

> Index: [01 · Trello analysis §7](../../01-trello-analysis.md#7-derived-frontend-component-tree) · Routes: [04 · Architecture §5](../../04-architecture.md#5-frontend-nextjs-bff)

```mermaid
flowchart TD
  RL["RootLayout"] --> AUTHL["(auth) layout"]
  RL --> APPL["(app) layout"]
  AUTHL --> LOGINP["LoginPage · SignUpPage · VerifyEmailPage<br/>ForgotPasswordPage · ResetPasswordPage · InvitePage"]
  APPL --> HDR["AppHeader"]
  HDR --> HDR1["WorkspaceSwitcher · RecentBoardsMenu · StarredBoardsMenu"]
  HDR --> HDR2["CreateMenu · SearchBox · NotificationBell · AccountMenu"]
  APPL --> HOMEP["HomePage<br/>BoardTileGrid (starred, recent, per workspace)"]
  APPL --> WSP["WorkspacePage<br/>BoardTileGrid · MembersTable · InviteDialog · SettingsForm"]
  APPL --> BP["BoardPage (Server Component: loads board snapshot)"]
  BP --> BPROV["BoardProvider (client)<br/>query cache hydration · SSE subscription"]
  BPROV --> BH["BoardHeader<br/>BoardTitle · StarButton · VisibilityMenu · MemberAvatars · ShareDialog · FilterMenu · BoardMenuDrawer"]
  BPROV --> BC["BoardCanvas (DndContext + DragOverlay)"]
  BC --> LC["ListColumn x n (SortableContext)"]
  LC --> LH["ListHeader · ListActionsMenu"]
  LC --> TL["TicketList"]
  TL --> TC["TicketCard x n<br/>Cover · LabelChips · Title · Badges · AssigneeAvatars"]
  LC --> ATC["AddTicketComposer"]
  BC --> ALC["AddListComposer"]
  APPL --> MODAL["@modal slot → (...)c/[shortId] intercepted route"]
  MODAL --> TD["TicketDetailModal"]
  TD --> TD1["TicketTitle · TicketMeta (members, labels, dates, watch)"]
  TD --> TD2["DescriptionEditor (markdown) · AttachmentList · ChecklistList"]
  TD --> TD3["ActivityFeed · CommentComposer · CommentItem"]
  TD --> TD4["TicketSidebar (add-to-ticket and action popovers)"]

  classDef server fill:transparent,stroke-width:2px
  class RL,AUTHL,APPL,BP,HOMEP,WSP server
```

*Thick border = Server Component. Everything below `BoardProvider` and `TicketDetailModal` is a Client Component.*

Everything shown here lives in `apps/web`. Primitives such as buttons, dialogs, popovers and menus come from `@tb/ui`.

## Where state lives

| State | Owner |
|---|---|
| Board snapshot (lists, tickets, labels, members) | TanStack Query `['board', boardId]`, patched by SSE reducers |
| Ticket detail (description, checklists, comments, attachments) | TanStack Query `['ticket', ticketId]` |
| Drag state, composers, popovers | local component state |
| Filter (P2) | URL search params (`?label=…&member=…`) |
| Session | httpOnly cookies, never in JS |
