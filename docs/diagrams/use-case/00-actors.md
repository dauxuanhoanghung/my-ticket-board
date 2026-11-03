# Use case · Actor generalisation

> Index: [03 · Use cases](../../03-use-cases.md) · Actor definitions: [02 · Product scope §1](../../02-product-scope.md#1-actors)

```mermaid
flowchart BT
  U["User"] --> V["Visitor"]
  WM["Workspace Member"] --> U
  WA["Workspace Admin"] --> WM
  BO["Board Observer"] --> U
  BM["Board Member"] --> BO
  BA["Board Admin"] --> BM
  G["Guest<br/>(board member without<br/>workspace membership)"] --> BO
  SCH["⏱ Scheduler"]
  WRK["⚙️ Worker"]
  MAIL["⚙️ Email provider"]
  S3["⚙️ Object storage"]
  classDef derived stroke-dasharray: 5 5
  classDef system fill:transparent,stroke-dasharray: 2 2
  class G derived
  class SCH,WRK,MAIL,S3 system
```

## Reading the diagram

- Arrows read **"is a specialisation of"**: the source actor inherits every use case of the target actor.
- **Workspace roles and board roles are independent axes.** A Workspace Member isn't automatically a Board Member. They only *view* workspace-visible boards until they join.
- **Guest** (dashed) is derived at runtime and never stored. It means a board member who isn't in the board's workspace. Guests can only see the boards they were added to.
- System actors (dotted) appear in the background use cases ([06-background](./06-background.md)).
