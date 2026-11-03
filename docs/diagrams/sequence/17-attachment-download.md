# Sequence 17 · Attachment download / preview (presigned GET)

> Index: [07 · Sequence flows](../../07-sequence-flows.md) · Class: [Storage](../class/06-storage.md)

```mermaid
sequenceDiagram
  autonumber
  participant B as Browser
  participant N as BFF /api/files/[id]
  participant A as API (Storage)
  participant DB as PostgreSQL
  participant S3 as RustFS

  B->>N: GET /api/files/attId?variant=preview (or download=1)
  N->>A: query attachmentUrl(attId, variant, disposition) with Bearer
  A->>DB: SELECT attachment + board
  A->>A: canView via cached effective role
  alt not allowed, not found or not ready
    A-->>N: NOT_FOUND
    N-->>B: 404
  else allowed
    A->>A: presign GET (expiry rounded up to the next hour, content-disposition)
    A-->>N: url
    N-->>B: 302 Location = presigned url, Cache-Control private max-age 300
    B->>S3: GET presigned url
    S3-->>B: bytes
  end
```

## Notes

- **Time-bucketed presigning:** rounding the expiry to the hour makes the URL stable for up to an hour, so the browser's HTTP cache serves repeated thumbnails on the board.
- Permission is checked on every redirect request. Revoked users can't fetch new URLs, though an already-issued URL stays valid until it expires (≤ 1 h). That's an accepted trade-off.
- Avatars, workspace logos and board backgrounds live in the **public** bucket and are linked directly. No redirect.
- **Disposition:** the default is `attachment`. Only PNG, JPEG, GIF, WebP and PDF may open inline. The file name comes from `attachments.file_name`, sent as `filename*=UTF-8''…` ([13 §7](../../13-file-uploads.md#7-security)).
