# UI · Screen map

> Index: [01 · Trello analysis §4](../../01-trello-analysis.md#4-ui-anatomy) · Routes: [04 · Architecture §5.1](../../04-architecture.md#51-route-map-app-router)

```mermaid
flowchart LR
  LOGIN["Login / Sign-up"] --> HOME["Home<br/>starred · recent · workspaces"]
  INVITE["Invite link /invite/:token"] --> LOGIN
  INVITE --> WSHOME
  HOME --> WSHOME["Workspace boards /w/:slug"]
  WSHOME --> WSMEM["Workspace members /w/:slug/members"]
  WSHOME --> WSSET["Workspace settings /w/:slug/settings"]
  HOME --> BOARD["Board view /b/:shortId/:slug"]
  WSHOME --> BOARD
  BOARD --> CARD["Ticket modal /c/:shortId/:number-slug<br/>(intercepted route over the board)"]
  BOARD --> BMENU["Board menu drawer<br/>about · activity · archived items · settings · labels · background"]
  HOME --> NOTIF["Notifications panel"]
  HOME --> PROFILE["Profile and settings /u/:username, /settings"]
  HOME --> SEARCH["Search results (P2)"]
```

## Notes

- `/c/:shortId` opens as a **modal over the board** when you navigate client-side (Next.js intercepting route `@modal/(...)c/...`). A hard load renders it as a full page, the way Trello behaves.
- Every page under `(app)` requires a session. There are no signed-out board pages.
