# Class · Trello object model (reference, as investigated)

> Index: [05 · Domain model](../../05-domain-model.md) · Analysis: [01 · Trello analysis](../../01-trello-analysis.md)
>
> This is **Trello's** model, using field names from its REST API. It's the reference we cloned from, not our domain model. For ours, see [04-board](./04-board.md).

```mermaid
classDiagram
  direction TB
  class Organization {
    <<Workspace>>
    +String id
    +String name
    +String displayName
    +String desc
    +String website
    +OrgPrefs prefs
  }
  class Membership {
    +String idMember
    +String memberType
    +Boolean unconfirmed
    +Boolean deactivated
  }
  class Member {
    +String id
    +String username
    +String fullName
    +String initials
    +String avatarUrl
  }
  class Board {
    +String id
    +String shortLink
    +String name
    +String desc
    +Boolean closed
    +String idOrganization
    +BoardPrefs prefs
  }
  class BoardPrefs {
    <<value>>
    +String permissionLevel
    +String comments
    +String invitations
    +Boolean selfJoin
    +Boolean cardCovers
    +String background
  }
  class Label {
    +String id
    +String name
    +String color
  }
  class TrelloList {
    <<List>>
    +String id
    +String name
    +Number pos
    +Boolean closed
    +Number softLimit
  }
  class Card {
    +String id
    +Number idShort
    +String shortLink
    +String name
    +String desc
    +Number pos
    +Date start
    +Date due
    +Boolean dueComplete
    +Number dueReminder
    +Cover cover
    +Badges badges
    +Boolean closed
  }
  class Checklist {
    +String id
    +String name
    +Number pos
  }
  class CheckItem {
    +String id
    +String name
    +String state
    +Number pos
    +Date due
    +String idMember
  }
  class Attachment {
    +String id
    +String name
    +String url
    +String mimeType
    +Number bytes
    +Boolean isUpload
  }
  class Action {
    +String id
    +String type
    +Object data
    +Date date
    +String idMemberCreator
  }
  class Notification {
    +String id
    +String type
    +Boolean unread
    +Object data
    +Date date
  }
  class CustomField {
    +String id
    +String name
    +String type
  }

  Organization "1" *-- "0..*" Board
  Organization "1" *-- "1..*" Membership : workspace memberships
  Board "1" *-- "1..*" Membership : board memberships
  Membership "0..*" --> "1" Member
  Board *-- BoardPrefs
  Board "1" *-- "0..*" Label
  Board "1" *-- "0..*" TrelloList
  Board "1" *-- "0..*" CustomField
  Board "1" *-- "0..*" Action : activity log
  TrelloList "1" *-- "0..*" Card
  Card "0..*" --> "0..*" Label : idLabels
  Card "0..*" --> "0..*" Member : idMembers
  Card "1" *-- "0..*" Checklist
  Checklist "1" *-- "0..*" CheckItem
  Card "1" *-- "0..*" Attachment
  Card "1" --> "0..*" Action : comments are commentCard actions
  Member "1" --> "0..*" Notification
  Notification --> Action : triggered by
```

## Observations that shaped our model

| Trello fact | Consequence for Ticket Board |
|---|---|
| `memberType` exists on both org and board memberships | Two independent role tables: `workspace_members`, `board_members` |
| Labels belong to the board | `labels.board_id`. Cross-board moves remap labels |
| `pos` is a float | We use string fractional keys ([ADR-006](../../11-decisions.md#adr-006)) |
| `idShort` per board + `shortLink` | `tickets.number` (per-board sequence) + `short_id` |
| Comments are actions | Activity feed and comments share one timeline. Comments still get their own table so they can be edited |
| `badges` precomputed | Board snapshot query returns counts per ticket |
