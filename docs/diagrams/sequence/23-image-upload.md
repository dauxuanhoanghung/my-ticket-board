# Sequence 23 · Avatar and workspace logo upload

> Index: [07 · Sequence flows](../../07-sequence-flows.md) · Details: [13 · File uploads §6](../../13-file-uploads.md#6-avatars-and-logos) · Attachments: [Sequence 16](./16-attachment-upload.md) · Class: [Storage](../class/06-storage.md)

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
  participant W as Worker

  U->>B: Choose avatar.jpg
  B->>B: show a local preview, create the upload id
  B->>N: mutation requestImageUpload(id, AVATAR, mimeType, sizeBytes)
  N->>A: forward
  A->>A: policy, size ≤ 5 MB, PNG, JPEG or WebP only
  A->>A: presign PUT to incoming/avatars/user/id (private bucket)
  A-->>N: upload (url, headers, expiresAt)
  N-->>B: same
  B->>S3: PUT url (bytes, XHR progress)
  S3-->>B: 200
  B->>N: mutation confirmImageUpload(id, AVATAR)
  N->>A: forward
  A->>S3: HEAD incoming object (internal endpoint)
  alt missing, too large or wrong type
    A-->>N: UPLOAD_INVALID
    N-->>B: restore the old image, show an error
  else ok
    A->>DB: outbox storage.image.uploaded
    A-->>N: ok
    N-->>B: keep the local preview
    MQ->>W: storage.image.uploaded (tb.image.process)
    W->>S3: GET incoming object
    alt not a valid image
      W->>S3: DELETE incoming object
      W->>DB: outbox storage.image.rejected
      MQ->>A: storage.image.rejected
      A-->>B: SSE image.rejected through the BFF
    else valid
      W->>W: re-encode to WebP, up to 512 px, strip metadata
      W->>S3: PUT tb-public avatars/user/id.webp
      W->>S3: DELETE incoming object
      W->>DB: outbox storage.image.ready
      MQ->>W: storage.image.ready (tb.image.apply)
      W->>DB: SetAvatar, users.avatar_key, outbox identity.user.profile_updated
      W->>S3: DELETE the previous public object
      MQ->>A: storage.image.ready
      A-->>B: SSE image.ready (url) through the BFF
    end
  end
```

## Notes

- **The browser never writes to `tb-public`.** That bucket allows anonymous reads, so only the worker's re-encoded output goes there.
- There's no database row during the upload. The API rebuilds the key from the signed-in user or a checked `workspaceId`, so nobody can confirm someone else's upload.
- A workspace logo follows the same flow with `purpose = WORKSPACE_LOGO`, a workspace admin check and `SetWorkspaceLogo`.
- A job every 15 minutes deletes `incoming/` objects older than 1 hour.
