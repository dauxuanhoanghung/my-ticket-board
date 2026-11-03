# Class · Storage context (attachments on RustFS)

> Index: [05 · Domain model §3.5](../../05-domain-model.md#35-storage) · Tables: [ERD 03](../erd/03-collaboration-storage-notification.md) · State: [Attachment](../state/10-attachment.md) · Sequences: [16](../sequence/16-attachment-upload.md), [17](../sequence/17-attachment-download.md)

```mermaid
classDiagram
  direction LR
  class Attachment {
    <<AggregateRoot>>
    +AttachmentId id
    +BoardId boardId
    +TicketId ticketId
    +UserId uploadedBy
    +AttachmentKind kind
    +AttachmentStatus status
    +FileMeta file
    +ObjectKey objectKey
    +ObjectKey previewKey
    +String linkUrl
    +requestUpload(ticket, uploader, fileMeta, limits)$ Attachment
    +addLink(ticket, uploader, url, name)$ Attachment
    +confirmUpload(head) void
    +attachPreview(previewKey, width, height) void
    +fail(reason) void
    +delete(by, byRole) void
  }
  class FileMeta {
    <<ValueObject>>
    +String fileName
    +String mimeType
    +long sizeBytes
    +String checksumSha256
  }
  class ObjectKey {
    <<ValueObject>>
    +String bucket
    +String key
    +forAttachment(boardId, ticketId, attachmentId)$ ObjectKey
    +forIncomingImage(purpose, ownerId, uploadId)$ ObjectKey
  }
  class UploadLimits {
    <<ValueObject>>
    +long maxBytes
    +int maxPerTicket
    +Set~String~ blockedMimeTypes
  }
  class AttachmentStatus {
    <<enumeration>>
    PENDING
    READY
    FAILED
  }
  class AttachmentKind {
    <<enumeration>>
    FILE
    LINK
  }
  class ObjectStorage {
    <<port>>
    +presignPut(key, fileMeta) PresignedUpload
    +presignGet(key, downloadName, ttl) String
    +head(key) ObjectHead
    +get(key) Stream
    +put(key, stream, mimeType) void
    +list(prefix) ObjectHead[]
    +delete(keys) void
  }
  class RustFsObjectStorage {
    <<adapter>>
    -S3Client internalClient
    -S3Client publicClient
  }
  class ImagePreviewer {
    <<port>>
    +thumbnail(stream, maxWidth) Image
  }

  Attachment *-- FileMeta
  Attachment *-- ObjectKey
  Attachment --> AttachmentStatus
  Attachment --> AttachmentKind
  Attachment ..> UploadLimits
  RustFsObjectStorage ..|> ObjectStorage
```

## Notes

- **Two S3 clients.** `internalClient` uses `http://rustfs:9000` for HEAD/GET/PUT/DELETE inside the network. `publicClient` uses the browser-reachable endpoint and **only signs URLs**, because the SigV4 signature covers the `Host` header.
- The object key is built from ids only: `boards/{boardId}/tickets/{ticketId}/{attachmentId}`. The file name stays in `attachments.file_name` and is applied at download ([13 · File uploads](../../13-file-uploads.md)).
- Cross-board ticket moves update `attachments.board_id` **only**. Object keys never change, so no copy is needed.
- When a ticket or board is deleted, `board.ticket.deleted` / `board.board.deleted` → the worker deletes the objects in batches.
