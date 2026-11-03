# Sequence 16 · Attachment upload (presigned PUT to RustFS)

> Index: [07 · Sequence flows](../../07-sequence-flows.md) · Use case: [UC-TKT-10](../use-case/05-collaboration.md#uc-tkt-10--upload-attachment) · State: [Attachment](../state/10-attachment.md) · Class: [Storage](../class/06-storage.md) · Design: [13 · File uploads](../../13-file-uploads.md)

```mermaid
sequenceDiagram
  autonumber
  actor U as User
  participant B as Browser
  participant N as BFF
  participant A as API (Storage)
  participant DB as PostgreSQL
  participant S3 as RustFS
  participant MQ as RabbitMQ
  participant W as Worker (preview)

  U->>B: Drop spec.png (2.4 MB) on the ticket
  B->>B: check the size, create the attachment id, add it to the upload queue
  loop up to 3 attempts, with a fresh URL each time
    B->>N: mutation requestAttachmentUpload(id, ticketId, fileName, mimeType, sizeBytes)
    N->>A: forward
    A->>A: policy canEditContent, size ≤ 25 MB, ticket has room, type not blocked
    A->>DB: INSERT attachments (pending, object_key boards/b/tickets/t/att), or reuse the row
    A->>A: presign PUT with the public endpoint (5 min, Content-Type and Content-Length signed)
    A-->>N: attachment, upload (url, headers, expiresAt)
    N-->>B: same
    B->>S3: PUT url (bytes, XHR progress)
  end
  alt the user cancels or every attempt fails
    B->>B: show the result, the row stays pending, GC deletes it after 1 h
  else 200 OK
    B->>N: mutation confirmAttachmentUpload(attachmentId)
    N->>A: forward
    A->>A: policy canEditContent again
    A->>S3: HEAD object (internal endpoint)
    alt missing, or size or type differs
      A->>DB: status failed
      A-->>N: UPLOAD_INVALID
    else ok
      A->>DB: BEGIN, UPDATE to ready WHERE status pending, activity, outbox storage.attachment.uploaded, COMMIT
      A-->>N: Attachment (ready)
      N-->>B: replace the queue row with the attachment
    end
  end
  MQ->>W: storage.attachment.uploaded (image types only)
  W->>S3: GET original (stream)
  W->>W: resize to 600 px wide (sharp), strip EXIF
  W->>S3: PUT previews/att.webp
  W->>DB: UPDATE preview_key, width, height + outbox storage.attachment.preview_ready
  Note over B,W: SSE attachment.updated swaps in the thumbnail for every viewer
```

## Notes

- **Signing host:** the URL must be signed for the host the **browser** uses (`S3_PUBLIC_ENDPOINT`), not the Docker-internal `rustfs:9000`. That's why the storage adapter has two clients ([class diagram](../class/06-storage.md)).
- **CORS** on RustFS must allow `PUT` from the web origin ([10 · Infrastructure §6](../../10-infrastructure.md#6-object-storage-rustfs)). The fallback is in [13 §9](../../13-file-uploads.md#9-rustfs-and-deployment).
- **Retries reuse the id.** The request mutation is idempotent, so a second call returns the same row and a new URL. That also recovers from an expired URL.
- Files are never served from the API process. Bytes go browser ↔ RustFS directly.
