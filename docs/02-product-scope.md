# 02 · Product scope, roles and permissions

> What we build, for whom, in which phase. Feature IDs (e.g. `TKT-05`) are referenced from use cases, flows and tickets.

---

## 1. Actors

| Actor | Type | Description |
|---|---|---|
| **Visitor** | Human | Not signed in. Can sign up, log in, open invite links |
| **User** | Human | Signed-in account (status `active`) |
| **Workspace Admin** | Role of User | Manages a workspace: settings, members, invitations, deletion |
| **Workspace Member** | Role of User | Sees workspace-visible boards, creates boards (subject to policy) |
| **Board Admin** | Role of User | Manages a board: settings, visibility, members, archive/delete |
| **Board Member** | Role of User | Edits board content: lists, tickets, comments |
| **Board Observer** | Role of User | Read-only, may comment if the board comment policy allows |
| **Guest** | Derived | Board member who isn't a member of the board's workspace |
| **Scheduler** | System | Time-based jobs: due-date reminders, cleanup, expiring invitations |
| **Worker** | System | Async consumers: emails, notifications, thumbnails, outbox relay |
| **Email provider** | External | Reached through `DeliveryFacade`. SMTP to Mailpit in development |
| **Object storage** | External | RustFS (S3-compatible) |

**Diagram →** [Actor generalisation](./diagrams/use-case/00-actors.md)

---

## 2. Feature catalogue

Priority: **MVP** = first release · **P2** = next · **P3** = after that · **Later** = not scheduled, revisit once the MVP is stable · **—** = out of scope.

### 2.1 Account and identity (ACC)

| ID | Feature | Priority |
|---|---|---|
| ACC-01 | Sign up with email, full name, password | MVP |
| ACC-02 | Verify email (link, 24 h expiry, resend) | MVP |
| ACC-03 | Log in / log out (httpOnly cookie session via BFF) | MVP |
| ACC-04 | Silent session refresh (rotating refresh token) | MVP |
| ACC-05 | Forgot / reset password | MVP |
| ACC-06 | Edit profile: full name, username, initials, bio, avatar, language | MVP |
| ACC-07 | Change password (revokes other sessions) | MVP |
| ACC-08 | List and revoke active sessions | P2 |
| ACC-09 | Change email (re-verification) | P2 |
| ACC-10 | Delete account (anonymise, keep activity integrity) | P2 |
| ACC-11 | OAuth sign-in (Google, GitHub) | Later |
| ACC-12 | Two-factor authentication (TOTP) | P3 |

### 2.2 Workspace and members (WSP)

| ID | Feature | Priority |
|---|---|---|
| WSP-01 | Create workspace (creator becomes admin) | MVP |
| WSP-02 | Edit workspace: name, slug, description, logo | MVP |
| WSP-03 | List my workspaces and their boards | MVP |
| WSP-04 | Invite people by email (pending invitation, 7-day expiry) | MVP |
| WSP-05 | Accept / decline invitation | MVP |
| WSP-06 | Revoke pending invitation | MVP |
| WSP-07 | Change member role (admin ⇄ member), last-admin guard | MVP |
| WSP-08 | Remove member / leave workspace | MVP |
| WSP-09 | Board-creation policy (admins only / all members) | MVP |
| WSP-10 | Shareable invite link | P2 |
| WSP-11 | Guests overview page | P2 |
| WSP-12 | Delete workspace (cascades boards) | MVP |

### 2.3 Board (BRD)

| ID | Feature | Priority |
|---|---|---|
| BRD-01 | Create board (blank, or "Basic" template with To Do / Doing / Done) | MVP |
| BRD-02 | Rename, edit description | MVP |
| BRD-03 | Visibility: private / workspace | MVP |
| BRD-04 | Background color / gradient | MVP |
| BRD-05 | Star / unstar, reorder stars | MVP |
| BRD-06 | Board members: invite, change role, remove, leave | MVP |
| BRD-07 | Board policies: comment, invite, self-join | MVP |
| BRD-08 | Labels: create, rename, recolor, delete (6 defaults) | MVP |
| BRD-09 | Archive (close) / reopen board | MVP |
| BRD-10 | Delete archived board | MVP |
| BRD-11 | Board activity feed | MVP |
| BRD-12 | Archived items panel (restore / delete lists and tickets) | MVP |
| BRD-13 | Filter tickets (keyword, members, labels, due) | P2 |
| BRD-14 | Copy board | P2 |
| BRD-15 | Custom background image upload | P2 |
| BRD-16 | Presence (who's viewing) | P2 |
| BRD-17 | Board templates | P3 |
| BRD-18 | Table and calendar views | P3 |
| BRD-19 | Public boards (read-only, signed-out access) | Later |

### 2.4 List (LST)

| ID | Feature | Priority |
|---|---|---|
| LST-01 | Create list | MVP |
| LST-02 | Rename list | MVP |
| LST-03 | Reorder lists (drag and drop) | MVP |
| LST-04 | Archive / restore list | MVP |
| LST-05 | Move list to another board | P2 |
| LST-06 | Copy list | P2 |
| LST-07 | WIP limit (soft limit indicator) | P2 |
| LST-08 | Move all tickets / archive all tickets in list | P2 |
| LST-09 | Watch list | P2 |

### 2.5 Ticket (TKT)

| ID | Feature | Priority |
|---|---|---|
| TKT-01 | Quick-create ticket from list composer | MVP |
| TKT-02 | Open ticket detail (modal, deep link `/c/:shortId`) | MVP |
| TKT-03 | Edit title, description (markdown) with conflict detection | MVP |
| TKT-04 | Move ticket within/between lists (drag and drop) — **realtime** | MVP |
| TKT-05 | Move ticket to another board/list/position (Move popover) | MVP |
| TKT-06 | Labels: add / remove | MVP |
| TKT-07 | Assignees: add / remove, "join" self | MVP |
| TKT-08 | Dates: start, due, reminder offset, mark complete | MVP |
| TKT-09 | Checklists: add, rename, delete, reorder; items add/edit/toggle/reorder/delete | MVP |
| TKT-10 | Attachments: upload file, add link, delete, set as cover | MVP |
| TKT-11 | Cover: color or image, normal/full size | MVP |
| TKT-12 | Comments: add, edit own, delete own (admins delete any), `@mentions` | MVP |
| TKT-13 | Watch / unwatch ticket | MVP |
| TKT-14 | Archive / restore / delete ticket | MVP |
| TKT-15 | Ticket number (`#42`) and share link | MVP |
| TKT-16 | Due-date reminders (in-app + email) | P2 |
| TKT-17 | Checklist item assignee and due date | P2 |
| TKT-18 | Copy ticket (with options) | P2 |
| TKT-19 | Comment emoji reactions | P2 |
| TKT-20 | Convert checklist item to ticket | P2 |
| TKT-21 | Custom fields | P3 |
| TKT-22 | Ticket templates | P3 |

### 2.6 Notifications, search, realtime (NTF / SRC / RT)

| ID | Feature | Priority |
|---|---|---|
| NTF-01 | In-app notifications (bell, unread count, mark read / all read) | MVP |
| NTF-02 | Triggers: mentioned, assigned, comment on watched ticket, added to board/workspace, invitation | MVP |
| NTF-03 | Email notifications (immediate) | P2 |
| NTF-04 | Notification preferences per type/channel | P2 |
| NTF-05 | Due-soon notifications | P2 |
| SRC-01 | Search tickets by title/description across accessible boards | P2 |
| SRC-02 | Search operators (`@me`, `#label`, `board:`, `due:`) | P3 |
| RT-01 | Live board updates for all viewers (tickets, lists, labels, members, comments, attachments) | MVP |
| RT-02 | Live notification badge | MVP |
| RT-03 | Presence avatars | P2 |

### 2.7 Internationalisation (I18N)

Launch languages: English (`en`, the default) and Vietnamese (`vi`).

| ID | Feature | Priority |
|---|---|---|
| I18N-01 | Translated web UI with a language picker (cookie, saved to the profile) | MVP |
| I18N-02 | API errors and validation messages in the request's language | MVP |
| I18N-03 | Emails in the recipient's language | MVP |
| I18N-04 | Notifications and activity feed shown in the viewer's language | MVP |

---

## 3. Permission matrix (MVP)

Legend: ✅ allowed · ❌ denied · ⚙️ depends on board/workspace policy · 👤 own resource only

| Action | WS Admin¹ | WS Member¹ | Board Admin | Board Member | Board Observer |
|---|---|---|---|---|---|
| View private board | ❌² | ❌ | ✅ | ✅ | ✅ |
| View workspace-visible board | ✅ | ✅ | ✅ | ✅ | ✅ |
| Join workspace-visible board | ✅ | ⚙️ self-join | — | — | — |
| Create board in workspace | ✅ | ⚙️ creation policy | — | — | — |
| Rename board / change background | ❌¹ | ❌¹ | ✅ | ✅ | ❌ |
| Change visibility / policies | ❌¹ | ❌ | ✅ | ❌ | ❌ |
| Invite / add board member | ❌¹ | ❌ | ✅ | ⚙️ invite policy | ❌ |
| Change board member role / remove | ❌¹ | ❌ | ✅ | 👤 leave | 👤 leave |
| Archive / reopen / delete board | ❌¹ | ❌ | ✅ | ❌ | ❌ |
| Create / edit / move / archive lists and tickets | ❌¹ | ❌ | ✅ | ✅ | ❌ |
| Manage labels | ❌¹ | ❌ | ✅ | ✅ | ❌ |
| Comment | ⚙️ | ⚙️ | ⚙️ | ⚙️ | ⚙️ |
| Edit / delete comment | — | — | ✅ delete any · 👤 edit | 👤 | 👤 |
| Upload / delete attachment | ❌¹ | ❌ | ✅ | ✅ (delete 👤 or admin) | ❌ |
| Watch ticket | ✅ if can view | ✅ if can view | ✅ | ✅ | ✅ |
| Manage workspace settings / members | ✅ | ❌ | — | — | — |

¹ Workspace roles grant **no content rights on their own**: to edit, a user must be a board member (workspace members may self-join workspace-visible boards when the policy allows).
² Workspace admins see that private boards exist in workspace settings (name only) and may delete them, but can't open them unless added (P2: "admin may join any board").

Effective-role resolution is shown in [Activity · Authorization resolution](./diagrams/activity/03-authorization-resolution.md).

---

## 4. Limits (initial, configurable)

| Limit | Value |
|---|---|
| Open lists per board | 500 |
| Open tickets per board | 5 000 |
| Labels per board | 100 |
| Checklists per ticket | 50 · items per checklist 200 |
| Attachment size | 25 MB (config `ATTACHMENT_MAX_BYTES`) |
| Avatar or logo size | 5 MB, PNG, JPEG or WebP (config `IMAGE_MAX_BYTES`) |
| Attachments per ticket | 100 |
| Ticket title | 512 chars · description 16 384 chars |
| Comment body | 16 384 chars |
| Board members | 1 000 |
| Pending invitations per workspace | 200 |

---

## 5. Non-functional requirements

| Area | Requirement |
|---|---|
| Realtime latency | A move by user A is visible to user B in **< 500 ms p95** (same region) |
| Board load | Board with 500 open tickets renders first paint **< 1.5 s** (SSR snapshot) |
| API latency | Mutations p95 < 150 ms (excluding uploads) |
| Availability | Stateless web/api tiers, horizontally scalable. Realtime survives instance loss via client reconnect |
| Consistency | Board state is strongly consistent in PostgreSQL. Realtime and notifications are eventually consistent (at-least-once, idempotent) |
| Security | OWASP ASVS L1 baseline. argon2id passwords. httpOnly cookies. CSRF protection. Rate limiting on auth. Private object storage with presigned URLs |
| Privacy | Account deletion anonymises PII while keeping activity history readable ("Deleted user") |
| Observability | Structured JSON logs with correlation id end-to-end (BFF → API → outbox → consumers). Health endpoints |
| Accessibility | WCAG 2.2 AA for core flows. Keyboard-operable drag and drop (dnd-kit keyboard sensor), plus the Move popover |
| Browser support | Last 2 versions of evergreen browsers |

---

## 6. Roadmap

| Phase | Scope |
|---|---|
| **0 · Foundation** | Monorepo, compose, CI · shared kernel, outbox, cache and delivery facades · `@tb/ui` package · i18n foundation · auth skeleton and BFF session |
| **1 · MVP** | Accounts and workspaces · boards, lists, tickets · labels, assignees, dates, checklists · comments, attachments, activity · realtime board and in-app notifications |
| **2 · Collaboration+** | Email notifications and preferences · due reminders · search and filters · copy board/list/ticket · sessions UI, presence |
| **3 · Power features** | Templates and custom fields · table and calendar views · webhooks and public API · 2FA |
| **Later** (not scheduled) | Public boards · OAuth sign-in · SMS delivery |

## 7. Out of scope

Power-Ups, Butler-style automation, billing/plans, enterprise SSO/SCIM, native mobile apps, offline mode, Inbox/Planner, mirror cards.
