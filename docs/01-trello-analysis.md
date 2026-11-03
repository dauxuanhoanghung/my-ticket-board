# 01 · Trello analysis

> **Goal:** understand Trello's building blocks well enough to decide what we clone, what we simplify and what we skip.
> **Sources:** Trello's public product behaviour and its REST API object model (Organization, Board, List, Card, Checklist, Action, Member, Notification). Feature names reflect Trello as of 2025–2026.

---

## 1. Object hierarchy

**Diagram →** [Trello object model (class diagram with API fields)](./diagrams/class/00-trello-object-model.md)

Key observations:

- **Board is the unit of collaboration and permission.** Almost every permission check is "what is this user's role on this board, and what do the board prefs allow?"
- **Labels are board-scoped**, not global. Moving a card to another board requires label remapping.
- **Comments are just actions.** Trello has one append-only log (`actions`) that powers the activity feed, the comment thread and notifications.
- **Guests are derived, not stored**: a guest is a board member who isn't a member of the board's workspace.

---

## 2. Component inventory

| Trello component | Purpose | Key fields (Trello API) | Notable behaviour | Our phase |
|---|---|---|---|---|
| **Workspace** (Organization) | Groups boards and people | `name` (slug), `displayName`, `desc`, `website`, `logo`, `prefs.permissionLevel`, `prefs.boardVisibilityRestrict` | Workspace page lists boards and members; settings restrict who may create boards of each visibility | MVP |
| **Workspace membership** | Who belongs to a workspace | `memberType` (admin / normal), `unconfirmed`, `deactivated` | Guests aren't workspace members. They only see the boards they were added to | MVP |
| **Board** | A Kanban surface | `name`, `desc`, `closed`, `idOrganization`, `shortLink`, `prefs`, `memberships` | URL `/b/{shortLink}/{slug}`. Close (archive) first, then delete | MVP |
| **Board prefs** | Board-level policy | `permissionLevel` (private / org / public), `comments`, `invitations`, `selfJoin`, `cardCovers`, `voting`, `background` | Every policy check reads these | MVP (subset) |
| **Starred board** | Per-user shortcut | member → board, ordered | Shown in header and home | MVP |
| **Board background** | Visual identity | color, gradient, photo, custom upload | — | MVP colors · P2 upload |
| **Label** | Categorise cards | `name` (optional), `color` | New boards get 6 default unnamed colored labels (green, yellow, orange, red, purple, blue). Colors also come in light/dark variants | MVP |
| **List** | Column of cards | `name`, `pos`, `closed`, `softLimit`, `subscribed` | Inline rename, drag reorder, move to another board, copy, sort, "archive all cards", "move all cards" | MVP core · P2 bulk ops |
| **Card** | The work item | `idShort`, `shortLink`, `name`, `desc`, `pos`, `idList`, `idLabels`, `idMembers`, `start`, `due`, `dueComplete`, `dueReminder`, `cover`, `badges`, `closed`, `isTemplate`, `cardRole` | URL `/c/{shortLink}/{idShort}-{slug}` opens as a **modal over the board** | MVP |
| **Card badges** | Summary on the card front | comment count, attachment count, check items done / total, has description, due state, watching, votes | Denormalised so the board renders fast | MVP |
| **Card cover** | Visual header | color or attachment, size normal / full | — | MVP |
| **Dates** | Scheduling | `start`, `due`, `dueReminder` (minutes before), `dueComplete` | Due chip color: due soon (< 24 h), overdue, complete | MVP · reminders P2 |
| **Checklist / item** | Sub-tasks | name, pos, state, (item) due, (item) member | Progress bar. An item can be converted into a card | MVP · item assign/due P2 |
| **Attachment** | Files and links | name, url, mimeType, bytes, previews, isUpload | Can be used as the cover. Upload size capped per plan | MVP |
| **Comment** | Discussion | action `commentCard`, text, reactions | Markdown, `@mentions`, edit/delete own comment, emoji reactions | MVP · reactions P2 |
| **Action** (activity) | Audit and history | `type`, `data` (old/new values, `listBefore`/`listAfter`), `memberCreator`, `date` | Single source for activity feeds and notifications | MVP |
| **Notification** | Inbox for a user | type (`mentionedOnCard`, `addedToCard`, `commentCard`, `cardDueSoon`, `changeCard`, `addedToBoard`…), `unread`, `data` | Bell panel and email (instant or periodic) | MVP in-app · P2 email prefs |
| **Watch** (subscribe) | Opt-in notifications | `subscribed` on board / list / card | Watching a card notifies on comments, moves, due changes | MVP card · P2 board/list |
| **Archive** | Soft removal | `closed` | "Archived items" panel lets you restore or delete permanently | MVP |
| **Move / Copy** | Re-organise | — | Move a card to any board/list/position. Copy offers to keep checklists, labels, members, attachments, comments | Move MVP · Copy P2 |
| **Templates** | Reuse | `board.isTemplate`, `card.isTemplate` | — | P3 |
| **Custom fields** | Structured data | text, number, date, checkbox, dropdown | — | P3 |
| **Search** | Find anything | operators `@member`, `#label`, `list:`, `board:`, `due:`, `is:open`, `has:attachments` | — | P2 |
| **Board filter** | Narrow the board | keyword, members, labels, due, complete | Client-side: dims or hides non-matching cards | P2 |
| **Views** | Alternative layouts | Table, Calendar, Timeline, Dashboard, Map | Premium | P3 |
| **Butler automation** | Rules and buttons | triggers, actions, schedules | — | Out of scope |
| **Power-Ups** | Plugins | iframe capabilities | — | Out of scope |
| **Webhooks / public API** | Integrations | `callbackURL`, `idModel` | — | P3 |
| **Inbox / Planner** | Personal capture and calendar (2024 redesign) | — | — | Out of scope |
| **Mirror / link / separator cards** | Special card roles | `cardRole` | — | Out of scope |

---

## 3. Trello permission model

| Concept | Values | Meaning |
|---|---|---|
| Workspace role | **Admin**, **Member** | Admins manage settings, members, billing. Members see workspace-visible boards and can create boards (subject to restrictions) |
| Guest (derived) | — | A board member who isn't a member of the board's workspace |
| Board role | **Admin**, **Member**, **Observer** | Admin manages members and settings. Member edits content. Observer is read-only, may comment if the comment policy allows |
| Board visibility | **Private**, **Workspace**, **Public** | Private: board members only. Workspace: all workspace members can view (and join if self-join is on). Public: anyone with the link can view (read-only) |
| Comment policy | disabled · members · members + observers · workspace members · any Trello user | Who may comment |
| Invite policy | admins · all members | Who may add people to the board |
| Self-join | on / off | Whether workspace members may join a workspace-visible board themselves |

Invariants Trello enforces, and we will too:

- A board must keep **at least one admin**. The last admin can't leave or be demoted.
- A board must be **closed (archived) before it can be deleted**.
- A workspace must keep at least one admin.

---

## 4. UI anatomy

### 4.1 Screen map

**Diagram →** [Screen map](./diagrams/ui/01-screen-map.md)

### 4.2 Board view

**Diagram →** [Board view wireframe](./diagrams/ui/02-board-view-wireframe.md)

### 4.3 Ticket front (card tile)

**Diagram →** [Ticket front wireframe and badge rules](./diagrams/ui/03-ticket-card-wireframe.md)

### 4.4 Ticket back (detail modal)

**Diagram →** [Ticket detail wireframe](./diagrams/ui/04-ticket-detail-wireframe.md)

### 4.5 Interaction catalogue

| Interaction | Where | Notes for implementation |
|---|---|---|
| Inline edit | board name, list name, ticket title, checklist titles | Optimistic update, commit on blur/Enter, revert on Esc |
| Composer | "Add a list", "Add a ticket", "Add an item" | Stays open after submit for rapid entry. Client generates the UUIDv7 |
| Drag and drop | tickets within/between lists, lists within a board, checklist items | Auto-scroll at edges. Placeholder shows the drop slot. Optimistic UI |
| Popover menus | labels, members, dates, move, list actions | Anchored to trigger, keyboard navigable |
| Modal via URL | ticket detail | Deep-linkable. Closing returns to board URL |
| Keyboard shortcuts | `n` new ticket, `e` quick edit, `space` assign me, `c` archive, `l` labels, `d` dates | P2 |
| Realtime presence | other users' changes appear live | MVP for data changes · P2 for "who's viewing" avatars |

---

## 5. Engineering behaviours worth copying

1. **Ordering by sparse positions.** Trello stores a floating-point `pos` with large gaps (e.g. multiples of 16384) and inserts at the midpoint between neighbours, renormalising when gaps get too small. We use **string fractional-index keys** instead, which never run out of precision ([ADR-006](./11-decisions.md#adr-006)).
2. **Short links and per-board numbers.** Boards and cards have short URL-safe ids, and cards also have a per-board sequential number (`idShort`). We keep both: `short_id` and `number`.
3. **One activity log.** Activity feed, comment thread and notifications all derive from a single append-only log.
4. **Optimistic UI and server push.** Trello's original stack (2012 tech-stack blog post) was Node.js + MongoDB + Redis pub/sub + WebSockets, with a client that applies changes optimistically and reconciles with server pushes. Same model here, using SSE + RabbitMQ ([ADR-005](./11-decisions.md#adr-005)).
5. **Archive before delete** for boards. Archive is the default "remove" everywhere.
6. **Cross-board moves remap data.** Labels are matched by name+color on the target board (created if missing). Assignees who aren't members of the target board are dropped. The card gets a new number on the target board.
7. **Denormalised badges** for fast card-front rendering.
8. **Drag and drop.** Trello uses Atlassian's open-source *Pragmatic drag and drop* library. We use **dnd-kit** instead ([ADR-018](./11-decisions.md#adr-018)).

---

## 6. Terminology mapping (Trello → Ticket Board)

| Trello | Ticket Board (ubiquitous language) | Notes |
|---|---|---|
| Organization / Workspace | **Workspace** | |
| Board | **Board** | |
| List | **List** | |
| Card | **Ticket** | Product term. The visual tile component is `TicketCard` |
| Member (account) | **User** | |
| memberType `normal` | Role `MEMBER` | |
| Action | **Activity** | |
| Closed | **Archived** | |
| Subscribed | **Watching** | |
| `idShort` | **Ticket number** (`#42`) | |
| `shortLink` | **shortId** | |
| Check item | **Checklist item** | |
| Card members | **Assignees** | |

---

## 7. Derived frontend component tree

**Diagram →** [Frontend component tree](./diagrams/ui/05-component-tree.md)
