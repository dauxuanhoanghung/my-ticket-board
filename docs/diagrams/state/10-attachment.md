# State · Attachment

> Index: [08 · State machines](../../08-state-machines.md) · Column: `attachments.status` · Sequences: [16](../sequence/16-attachment-upload.md), [17](../sequence/17-attachment-download.md) · Class: [Storage](../class/06-storage.md)

```mermaid
stateDiagram-v2
  [*] --> Pending : requestAttachmentUpload (file)
  [*] --> Ready : addLinkAttachment (link)
  Pending --> Pending : requestAttachmentUpload again (fresh URL)
  Pending --> Ready : confirm, HEAD ok
  Pending --> Failed : HEAD missing, or size or type differs
  Pending --> Collected : older than 1 h (GC removes row and object)
  state Ready {
    [*] --> NoPreview
    NoPreview --> Previewed : worker stores preview (images only)
  }
  Ready --> Deleted : deleteAttachment, or ticket/board deleted
  Failed --> Collected : GC
  Deleted --> [*] : worker deletes the object and preview
  Collected --> [*]
```

- Only `Ready` attachments count in badges, appear in lists and can become a cover.
- Deleting the attachment used as cover resets the ticket's cover (`ON DELETE SET NULL` + domain clears `cover_kind`).
