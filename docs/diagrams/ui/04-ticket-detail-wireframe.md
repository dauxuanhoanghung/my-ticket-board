# UI · Ticket back (detail modal) wireframe

> Index: [01 · Trello analysis §4](../../01-trello-analysis.md#4-ui-anatomy) · Query: `ticket(shortId)` in [09 · API](../../09-api-contract.md)

```text
+--------------------------------------------------------------------------+
| [ cover ]                                                           [x]  |
| Implement upload API                                   (inline editable) |
| in list "Doing"  ·  #42                                                  |
+-----------------------------------------------+--------------------------+
| Members (AB)(CD)[+]   Labels [Bug][API][+]    | Add to ticket            |
| Notifications [Watch]  Dates [Oct 30, done]   |   Members                |
|                                               |   Labels                 |
| Description                       [Edit]      |   Checklist              |
|   markdown rendered...                        |   Dates                  |
|                                               |   Attachment             |
| Attachments                       [Add]       |   Cover                  |
|   [thumb] spec.pdf  added 2h ago  [...]       | Actions                  |
|                                               |   Move                   |
| Checklist "QA"   40% [=====         ]         |   Copy (P2)              |
|   [x] unit tests                              |   Watch                  |
|   [ ] e2e tests  (CD, Oct 29)                 |   Archive                |
|   [Add an item]                               |   Delete (when archived) |
|                                               |   Share link             |
| Activity                     [Show details]   |                          |
|   [Write a comment...]                        |                          |
|   AB  "LGTM @cd"   2 min ago   Edit · Delete  |                          |
|   CD moved this ticket from To Do to Doing    |                          |
+-----------------------------------------------+--------------------------+
```

## Notes

- **Activity** interleaves comments and activity entries by time (both UUIDv7, so `ORDER BY id` works). "Show details" toggles non-comment entries.
- The description editor is a markdown textarea with preview. On save it sends `expectedVersion` ([Sequence 14](../sequence/14-edit-description-conflict.md)).
- Observers see the same layout without the editing affordances or the "Add to ticket" column.
