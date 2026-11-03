# 13 · File uploads

> How files get from the browser to RustFS, with GraphQL, NestJS and Next.js.
> Decisions: [ADR-009](./11-decisions.md#adr-009), [ADR-027](./11-decisions.md#adr-027) · Flows: [Sequence 16](./diagrams/sequence/16-attachment-upload.md), [Sequence 17](./diagrams/sequence/17-attachment-download.md), [Sequence 23](./diagrams/sequence/23-image-upload.md) · State: [Attachment](./diagrams/state/10-attachment.md) · Class: [Storage](./diagrams/class/06-storage.md)

The code below is a sketch of the intended design. It hasn't been compiled.

---

## 1. Recommendation

**GraphQL carries metadata, never bytes.** The browser sends the file straight to RustFS with a presigned PUT. Two GraphQL mutations wrap that PUT: one to get permission, one to confirm the result.

| Option | Verdict | Why |
|---|---|---|
| **Presigned PUT + two mutations** | **Use this** | Next.js and NestJS never hold the file, so a slow upload can't tie them up. RustFS lists presigned PUT as [tested](https://docs.rustfs.com/en/reference/s3-compatibility) |
| GraphQL multipart (`graphql-upload`) | No | Doesn't work with this BFF (see below). Apollo's own docs [recommend signed URLs](https://www.apollographql.com/docs/apollo-server/v3/data/file-uploads) instead (Apollo Server 3 docs, the latest guidance found) |
| Server Actions | No | [1 MB body limit by default](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions), and the file would pass through Node |
| Streaming through a route handler | Fallback only | Needed only if browser CORS can't work on RustFS ([§9](#9-rustfs-and-deployment)) |
| Presigned POST | No | Its main benefit is a server-enforced size range, but RustFS's matrix doesn't cover POST policy conditions |
| S3 multipart upload | Later | Unnecessary at 25 MB. S3's guidance is [100 MB or larger](https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html) ([§11](#11-later-larger-files)) |

GraphQL multipart fails here for reasons specific to this project:

- **`proxy.ts` truncates large bodies.** When a proxy is used, Next.js buffers the request body and [keeps only the first 10 MB by default](https://nextjs.org/docs/app/api-reference/config/next-config-js/proxyClientMaxBodySize). The request still succeeds, so a 25 MB file would arrive cut off with no error at the client.
- **`/api/graphql` is JSON only.** That's part of the CSRF protection ([04 §5.3](./04-architecture.md#53-bff-session-handling)), and production only accepts persisted operations.
- **Every byte would cross two Node processes**, Next.js and then NestJS, for the whole upload.

---

## 2. Flow

```text
1. Browser → requestAttachmentUpload → BFF → API     permission check, pending row, presigned URL
2. Browser → PUT → RustFS                            the file, with a progress bar
3. Browser → confirmAttachmentUpload → BFF → API     HEAD check, row becomes ready, events go out
```

The API signs URLs locally without calling RustFS, so step 1 stays fast. The worker builds the preview after step 3, and SSE updates every viewer.

| Rule | Reason |
|---|---|
| The client generates the attachment id | Makes step 1 idempotent (rule 10). A retry with the same id returns the same row and a fresh URL |
| Step 3 trusts nothing from the client | It's only a trigger. The API reads the real size and type from RustFS |
| Only `ready` attachments are visible | Other viewers never see half-finished uploads |
| Object keys are ids only | Rule 13. The file name stays in `attachments.file_name` and is applied at download |

---

## 3. Long uploads

| Upload speed | Time for the 25 MB limit |
|---|---|
| 1 Mbps | About 3.5 minutes |
| 5 Mbps | About 42 seconds |
| 20 Mbps | About 10 seconds |

- **A 5-minute URL is enough.** S3 [checks expiry when the request starts](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html), so an upload that starts in time can finish later. RustFS doesn't document this, so it's on the test list in [§10](#10-tests).
- **Expired URLs recover on their own.** A retry calls `requestAttachmentUpload` with the same id and gets a new URL.
- **Queued files don't use up their URL.** The client asks for a URL only when a file's turn comes.
- **The session doesn't matter during the PUT.** The upload doesn't touch `tb_at`. If the token expires before step 3, `proxy.ts` refreshes it as usual.
- **People can keep working.** Uploads run in a queue that survives closing the ticket modal or changing boards ([§5.5](#55-queue-and-ui)).

---

## 4. NestJS

### 4.1 Files

```text
apps/api/src/modules/storage/
├─ domain/attachment/        attachment.aggregate.ts, file-meta.vo.ts, object-key.vo.ts, upload-limits.vo.ts
├─ application/
│  ├─ commands/              request-attachment-upload/, confirm-attachment-upload/,
│  │                         request-image-upload/, confirm-image-upload/
│  ├─ policies/              storage.policy.ts
│  └─ ports/                 object-storage.port.ts, ticket-access.reader.ts, workspace-access.reader.ts
├─ infrastructure/           persistence/, acl/, consumers/ (preview, image-process, cleanup)
└─ interface/graphql/        attachment.resolver.ts, image-upload.resolver.ts, inputs/, types/

apps/api/src/shared/infrastructure/storage/rustfs-object-storage.ts
```

### 4.2 GraphQL contract

The SDL is in [09 §2](./09-api-contract.md#2-schema-draft-sdl). In code-first style:

```ts
// interface/graphql/inputs/request-attachment-upload.input.ts
@InputType()
export class RequestAttachmentUploadInput {
  @Field(() => UUIDScalar) @IsUUID() id: string;
  @Field(() => UUIDScalar) @IsUUID() ticketId: string;
  @Field() @Length(1, 255) fileName: string;
  @Field() @MaxLength(127) mimeType: string;
  @Field(() => Float) @IsInt() @Min(1) sizeBytes: number;
}

// interface/graphql/types/presigned-upload.type.ts
@ObjectType()
export class PresignedUpload {
  @Field() url: string;
  @Field(() => [HttpHeader]) headers: HttpHeader[];
  @Field(() => GraphQLISODateTime) expiresAt: Date;
}

// interface/graphql/attachment.resolver.ts
@Resolver(() => AttachmentType)
export class AttachmentResolver {
  constructor(private readonly commands: CommandBus) {}

  @Mutation(() => RequestAttachmentUploadPayload)
  requestAttachmentUpload(
    @Args('input') input: RequestAttachmentUploadInput,
    @CurrentActor() actor: Actor,
  ) {
    return this.commands.execute(new RequestAttachmentUploadCommand(actor, input));
  }

  @Mutation(() => AttachmentPayload)
  confirmAttachmentUpload(
    @Args('input') input: ConfirmAttachmentUploadInput,
    @CurrentActor() actor: Actor,
  ) {
    return this.commands.execute(new ConfirmAttachmentUploadCommand(actor, input));
  }
}
```

`mimeType` and `sizeBytes` are checked again in the domain through `FileMeta` and `UploadLimits`, because the DTO only validates shape.

### 4.3 Request handler

```ts
async execute({ actor, input }: RequestAttachmentUploadCommand) {
  const ticket = await this.tickets.forUpload(input.ticketId, actor.userId); // NOT_FOUND when hidden
  this.policy.assertCanUpload(actor, ticket);

  const attachment = await this.uow.run(async () => {
    const existing = await this.attachments.findById(input.id);
    if (existing) {
      existing.assertSameUpload(actor.userId, input);
      return existing;
    }
    const created = Attachment.requestUpload(ticket, actor.userId, FileMeta.of(input), this.limits);
    await this.attachments.add(created);
    return created;
  });

  if (attachment.isReady) return { attachment, upload: null };
  return { attachment, upload: await this.storage.presignPut(attachment.objectKey, attachment.file) };
}
```

- `Attachment.requestUpload` enforces the size limit and the 100-per-ticket limit. Count `pending` as well as `ready` rows, so parallel uploads can't pass the limit.
- Rate-limit this mutation per user with `CacheFacade.increment`.
- `upload: null` means the file is already confirmed, so the client skips the PUT.

### 4.4 Confirm handler

```ts
async execute({ actor, input }: ConfirmAttachmentUploadCommand) {
  const attachment = await this.attachments.getById(input.attachmentId);
  const ticket = await this.tickets.forUpload(attachment.ticketId, actor.userId);
  this.policy.assertCanUpload(actor, ticket);
  if (attachment.isReady) return { attachment };

  const head = await this.storage.head(attachment.objectKey); // outside the transaction
  return this.uow.run(async () => {
    attachment.confirmUpload(head); // ready + storage.attachment.uploaded, or failed
    await this.attachments.save(attachment);
    return { attachment };
  });
}
```

- **Check permission again.** The person may have been removed from the board during the upload.
- **Run HEAD outside the transaction**, so a slow RustFS call never holds a database connection.
- **Save with `UPDATE … WHERE status = 'pending'`.** Two racing confirms then produce one event. The loser reloads the row and returns it.
- `failed` is final. The client tries again with a new id, and GC removes the old row and object.

### 4.5 RustFS adapter

```ts
this.publicClient = new S3Client({
  endpoint: config.S3_PUBLIC_ENDPOINT,
  region: config.S3_REGION,
  forcePathStyle: true,
  credentials,
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

async presignPut(key: ObjectKey, file: FileMeta): Promise<PresignedUpload> {
  const command = new PutObjectCommand({
    Bucket: key.bucket,
    Key: key.key,
    ContentType: file.mimeType,
    ContentLength: file.sizeBytes,
  });
  const url = await getSignedUrl(this.publicClient, command, {
    expiresIn: PUT_TTL_SECONDS,
    signableHeaders: new Set(['content-type', 'content-length']),
  });
  return {
    url,
    headers: [{ name: 'Content-Type', value: file.mimeType }],
    expiresAt: addSeconds(this.clock.now(), PUT_TTL_SECONDS),
  };
}
```

Three details here are easy to get wrong:

- **Checksum settings.** Since v3.729.0 the SDK adds integrity checksums by default. On presigned PUTs that can put `x-amz-checksum-crc32=AAAAAA==`, the checksum of an empty body, into the URL. S3-compatible servers have rejected real uploads because of it ([Garage](https://git.deuxfleurs.fr/Deuxfleurs/garage/issues/1236), [Tigris on Fly.io](https://community.fly.io/t/signaturedoesnotmatch-when-using-pre-signed-url-with-aws-sdk/23549)). `WHEN_REQUIRED` is the reported fix.
- **`signableHeaders`.** The presigner doesn't sign `content-type` unless told to. Check `X-Amz-SignedHeaders` in a test rather than assuming.
- **No `Content-Length` in `headers`.** It's a forbidden header, so browser code can't set it. The browser sends the real file size, and that's what the signature is checked against.

### 4.6 Worker

- `tb.attachment.preview` handles images only. Use `sharp` with `limitInputPixels`, so a decompression bomb can't exhaust memory.
- A file that `sharp` can't decode isn't an error. It stays `ready` with no preview, and the message is acknowledged.
- SVG gets no preview, because `sharp` would have to render untrusted XML.

---

## 5. Next.js

### 5.1 What each layer does

| Layer | Role in uploads |
|---|---|
| Browser GraphQL client | Calls both mutations through `/api/graphql`, using TanStack Query mutations |
| Server GraphQL client | Not used for uploads. It only serves `/api/files/:id` |
| Server Actions | Not used, including for the avatar form. The profile form saves text fields only |
| `/api/graphql` | JSON only, with no special upload handling |
| `/api/files/:id` | Downloads: checks permission, then `302` to a presigned GET |
| Browser → RustFS | The only path file bytes take |

### 5.2 Files

```text
apps/web/src/lib/upload/
├─ put-with-progress.ts     one PUT with progress and cancel
├─ upload-errors.ts         which failures can retry
└─ upload-queue.tsx         provider in the (app) layout, 3 uploads at a time
apps/web/src/features/attachments/
├─ upload-attachment.ts     request → PUT → confirm, with retries
├─ attachment-dropzone.tsx  drop target in the ticket modal
└─ upload-tray.tsx          progress, cancel, retry
apps/web/src/features/profile/
└─ avatar-picker.tsx        same helpers, image mutations
```

The GraphQL documents live next to the features, so codegen and the persisted-operation allowlist pick them up as usual.

### 5.3 PUT with progress

Use `XMLHttpRequest`. `fetch` has no upload progress event that works across browsers.

```ts
export function putWithProgress({ upload, file, signal, onProgress }: PutArgs): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', upload.url);
    for (const { name, value } of upload.headers) xhr.setRequestHeader(name, value);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new UploadError(xhr.status));
    xhr.onerror = () => reject(new UploadError(0));
    xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'));

    signal.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(file);
  });
}
```

Apply only the headers the API returned. The presigned URL is the credential, so the request sends no cookies, and `withCredentials` stays off.

### 5.4 Upload with retries

```ts
const MAX_ATTEMPTS = 3;

export async function uploadAttachment({ id, ticketId, file, signal, onProgress }: UploadArgs) {
  const input = {
    id,
    ticketId,
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
  };

  for (let attempt = 1; ; attempt++) {
    const { attachment, upload } = await requestAttachmentUpload(input);
    if (!upload) return attachment;

    try {
      await putWithProgress({ upload, file, signal, onProgress });
      break;
    } catch (error) {
      if (attempt === MAX_ATTEMPTS || !isRetryable(error)) throw error;
      await backoff(attempt, signal);
    }
  }

  return (await confirmAttachmentUpload({ attachmentId: id })).attachment;
}
```

- `isRetryable` is true for status `0` (network), `403` (expired URL), `408`, `429` and `5xx`. It's false for `AbortError`.
- A `403` can also mean a bad signature. The three-attempt limit stops that from looping.
- Generate `id` once per file, outside this function. A retry after an error shown in the UI reuses it unless the row has `failed`.
- Check `file.size` against the limit before starting, for an instant message. The API still enforces it.

### 5.5 Queue and UI

- Mount `UploadQueueProvider` in the `(app)` layout, not the ticket modal. Closing the modal or changing boards then doesn't cancel anything.
- Run 3 uploads at a time, and call `requestAttachmentUpload` only when a file starts.
- Add a `beforeunload` warning while uploads are active. A `File` can't survive a page reload, so a reload loses them, and GC removes the rows.
- Show in-progress files as local rows in the ticket modal and the tray. When the upload finishes, upsert by attachment id, because the SSE `attachment.updated` event can arrive before or after the mutation result.
- The card's attachment badge changes only when the file is `ready`.
- Text comes from `next-intl`. `@tb/ui` receives its labels as props.

### 5.6 Showing files

- Use `/api/files/:id?variant=preview` in a plain `<img>`, not `next/image`. The image optimizer keeps a server-side cache keyed by URL, which doesn't fit per-user permissions.
- Avatars and logos are public, so they link straight to the `tb-public` URL.

---

## 6. Avatars and logos

The docs had a place to store these (`avatar_key`, `logo_key`, `tb-public`) but no way to upload them. Both are MVP features (ACC-06, WSP-02).

They use the same three steps with one difference: **the browser never writes to `tb-public`.** That bucket allows anonymous reads, so unverified bytes must not land there. The file goes to a private key first, and the worker re-encodes it. Re-encoding also removes metadata such as GPS location.

| | Attachment | Avatar or logo |
|---|---|---|
| Mutations | `requestAttachmentUpload`, `confirmAttachmentUpload` | `requestImageUpload`, `confirmImageUpload` |
| Limit | 25 MB, most file types | 5 MB (`IMAGE_MAX_BYTES`), PNG, JPEG or WebP |
| Upload key | `boards/{boardId}/tickets/{ticketId}/{attachmentId}` | `incoming/avatars/{userId}/{id}` or `incoming/logos/{workspaceId}/{id}` |
| Database row during upload | `attachments` (`pending`) | None |
| Final location | Same key, `tb-attachments` | `avatars/{userId}/{id}.webp` or `logos/{workspaceId}/{id}.webp`, `tb-public` |
| Result reaches the UI | Mutation result and `attachment.updated` | SSE `image.ready` or `image.rejected` |

Flow details are in [Sequence 23](./diagrams/sequence/23-image-upload.md).

- The API builds the key from the signed-in user or a checked `workspaceId`, so nobody can confirm someone else's upload.
- The worker skips a message if the `incoming/` object is already gone, which makes a repeated confirm harmless.
- `tb.image.apply` runs `SetAvatar` or `SetWorkspaceLogo`, then deletes the previous public object.
- A job every 15 minutes deletes `incoming/` objects older than 1 hour.
- The UI shows a local preview with `URL.createObjectURL`, then swaps in the URL from `image.ready`. On `image.rejected` it restores the old image and shows an error.

---

## 7. Security

| Risk | Control |
|---|---|
| Malicious HTML or SVG runs when opened | Downloads default to `Content-Disposition: attachment`. Only PNG, JPEG, GIF, WebP and PDF may open inline |
| A stored file reaches app cookies | RustFS stays on a separate origin. Never route a bucket under the app's domain |
| Client lies about size | Signed `Content-Length`, plus a HEAD check at confirm |
| Client lies about type | The browser receives the declared type, so a fake `image/png` can only render as a broken image. Inline display is decided by the allow-list above |
| Unsafe file names | Keys contain ids only. Names are sent in the download header as `filename*=UTF-8''…`, which also keeps Vietnamese names intact |
| Leaked upload URL | Bound to one key, size and type, for 5 minutes |
| Replaced object after confirm | A URL stays valid until it expires, so the uploader could overwrite their own file for up to 5 minutes. Accepted |
| Storage abuse | 25 MB limit, 100 per ticket, rate limit. Workspace quotas are P2 |
| Decompression bombs | `limitInputPixels` in `sharp` |
| Malware | No scanning in the MVP, so opening a file means downloading it first. Scanning in the worker would fit before `ready`, if it's needed later |

---

## 8. Failure handling

| Failure | Result | Recovery |
|---|---|---|
| Network drops during PUT | Automatic retry, 3 attempts | Then a Retry button with the same id |
| URL expired | `403` | Automatic, with a fresh URL |
| User cancels | XHR aborted | Row stays `pending`, GC removes it |
| Tab closed before confirm | The file is stored but never confirmed | GC removes the row and object after 1 hour |
| Confirm response lost | The client retries | Confirm is idempotent |
| Size or type doesn't match | `UPLOAD_INVALID`, row `failed` | New id. GC removes the old row and object |
| Removed from the board mid-upload | `NOT_FOUND` at confirm | GC removes the row and object |
| Ticket deleted mid-upload | `NOT_FOUND` at confirm | A PUT that finishes after the cleanup can leave one orphan object, which is accepted |
| Worker can't build a preview | Stays `ready`, no thumbnail | Generic file icon |

---

## 9. RustFS and deployment

**CORS.** Set `RUSTFS_CORS_ALLOWED_ORIGINS` to the web origin. It's the simplest option for one origin, and [per-bucket `PutBucketCors` has varied between releases](https://formbricks.com/docs/self-hosting/configuration/file-uploads). If a bucket has its own CORS rules, [they override the server setting](https://github.com/rustfs/rustfs/issues/2330). Pin the image tag at init, because this behaviour has changed between releases.

**Production proxy in front of RustFS:**

- Use HTTPS, or browsers block uploads from the HTTPS app as mixed content.
- Keep the `Host` header unchanged, because the signature covers it.
- Forward `OPTIONS`, and leave CORS headers untouched.
- Allow bodies of at least 25 MB, with no short timeouts.

**Fallback if browser uploads can't work.** Add a streaming `/api/files/upload` route handler. It **must be excluded from the `proxy.ts` matcher**, or uploads over 10 MB are silently cut off. That route then has no session refresh, so the client must refresh first, for example with a quick authenticated query. The two mutations and the confirm step stay the same.

---

## 10. Tests

These RustFS checks run in CI against the pinned image, because the compatibility matrix doesn't settle them. They live in `apps/api/test/storage/` and use Testcontainers.

| Check | If it fails |
|---|---|
| The generated URL has no `x-amz-checksum-*`, and `X-Amz-SignedHeaders` includes `content-length` and `content-type` | Fix the client config |
| A browser-style `OPTIONS` preflight and PUT pass CORS | Try `PutBucketCors`, then the fallback in [§9](#9-rustfs-and-deployment) |
| A PUT with the wrong size or type is rejected | The HEAD check at confirm is still the safety net, but document that the signature isn't enforced |
| A slow PUT that starts before expiry finishes after it | Raise the TTL so it covers the slowest expected upload |
| A presigned GET honours `response-content-disposition` with a UTF-8 name | Sign `Content-Disposition` at upload time instead |

| Layer | Tests |
|---|---|
| Domain (Jest) | Size and type limits, state changes, the HEAD comparison |
| Application (Jest) | Idempotent request, racing confirms, permission lost before confirm, with in-memory repositories |
| GraphQL (Supertest) | Both mutations, error codes, `upload: null` |
| Web (Playwright) | Progress, cancel, retry through `page.route`, oversize message, a Vietnamese file name, the second tab seeing the attachment |

---

## 11. Later: larger files

Keep single PUTs while the limit stays under 100 MB. Above that, add multipart upload with a new ADR:

```graphql
createMultipartUpload(input): CreateMultipartUploadPayload!  # uploadId, part size
presignUploadParts(input): PresignUploadPartsPayload!        # URLs for the next batch of parts
completeMultipartUpload(input): AttachmentPayload!           # part numbers and ETags
abortMultipartUpload(input): OkPayload!
```

- Sign parts in small batches just before use, so late parts can't expire.
- CORS must expose `ETag`, because the browser has to read it from each part.
- GC must abort unfinished uploads as well as delete rows.
- RustFS lists create, upload, complete and abort as tested, but the matrix doesn't mention presigned `UploadPart`, so test that first.
