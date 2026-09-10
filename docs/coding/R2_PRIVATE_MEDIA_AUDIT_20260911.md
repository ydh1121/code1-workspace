# CODE1 R2 / PRIVATE MEDIA STAGING READ-ONLY AUDIT — 2026-09-11

Status: `R2_ACCOUNT_INVENTORY_EMPTY / PROVISIONING_REQUIRED / NO_EXTERNAL_R2_MUTATION`
Track: CODING
Branch: `coding/runtime-backend-staging`
Supabase target: CODE1 STAGING `bsintmkyhptizrjoizfb` only
Live / Public Frontend / main / Production: unchanged

## 1. Recovery result

The completed Supabase FIRST_IMPORT was preserved. A fresh read of CODE1 STAGING reconfirmed the durable post-import counts already recorded in the post-import handoff, including 4 `media_assets` rows and migration registry 268. No import, schema, or index mutation was repeated during this audit.

Cross-track state was re-read before the account-level R2 evidence was folded back into CODING durable state. `MSG-20260911-0003` and `MSG-20260911-0007` remain CODING -> PLANNING implementation-evidence messages, while `MSG-20260911-0005` remains NEEDS_REVIEW because the requested Apps Script same-ID Drive move was blocked by file-specific connector authorization.

## 2. Actual legacy media state

The four imported farm-media metadata rows are not active migration candidates:

- all 4 have `source_storage = GOOGLE_DRIVE_LEGACY`;
- all 4 have `object_key = NULL`;
- all 4 currently have `status = DELETED`;
- their Drive originals still exist as private owner-only files;
- Drive MIME type and byte size match the corresponding Supabase metadata for all 4;
- SHA-256 was calculated from the actual Drive bytes for all 4.

Detailed file identifiers, filenames, rights/consent fields, deletion timestamps, and SHA-256 values are intentionally not committed to this repository. They are recorded in the private Drive artifact `CODE1_SOURCE_MEDIA_MANIFEST_20260911` inside `[PRIVATE] CODE1 STAGING MIGRATION`.

Until a retention/purge policy or an explicit migration decision says otherwise, these rows remain classified as `HOLD_DELETED_RETENTION`. Creating a new R2 bucket does not make these deleted source files migration candidates. This audit does not copy deleted originals into R2 and does not delete the Drive rollback source.

## 3. R2 resource identity audit — resolved account inventory

The repository establishes a logical binding contract named `CODE1_MEDIA_BUCKET`, but the current `wrangler.toml` contains no `r2_buckets` binding and no actual bucket name.

The operator ran the branch's fail-closed local Cloudflare inventory runner with Wrangler `4.129.0`. The runner returned authenticated account-level evidence without invoking create/delete/set/enable/disable/deploy/object-write commands.

Verified current Cloudflare state:

- exact authenticated account identity was observed in the operator output and is intentionally not committed to this repository;
- Pages project `code1-workspace` exists with domain `code1-workspace.pages.dev`;
- `wrangler r2 bucket list` returned no bucket rows for the current account;
- downloaded Pages project configuration contained no R2 binding;
- repository `wrangler.toml` also contains no R2 binding;
- no R2 object or bucket mutation occurred.

Result: the prior `R2_RESOURCE_IDENTITY_BLOCKED` ambiguity is resolved as `R2_ACCOUNT_INVENTORY_EMPTY`.

There is no current CODE1 R2 bucket to select and no other-project bucket available for reuse. The correct next resource action is therefore creation of a new CODE1 STAGING-only bucket, followed immediately by a second read-only verification pass before any binding or object write.

Proposed exact new bucket name: `code1-staging-media`.

R2 buckets are private by default. This path must retain private-by-default access; do not enable r2.dev or attach a public custom domain. The runtime binding name remains `CODE1_MEDIA_BUCKET` and stays server-side only.

## 4. Existing private-media contract verified in code

The isolated staging implementation already contains the following pieces and they should be continued rather than redesigned from zero:

- deterministic private object key hierarchy under `private/farms/{farm_id}/submissions/{submission_id}/media/{media_id}/original/...`;
- short-lived HMAC-scoped upload authorization;
- server-side R2 binding only (`CODE1_MEDIA_BUCKET`), with no R2 credential exposed to the browser;
- PUT endpoint enforcement for exact authorized object key, declared byte length, and MIME;
- `mediaUpload.finish` object `HEAD` existence/size verification before moving DB status to `REVIEW_REQUIRED`;
- short-lived private-read token plus farm-access check before URL issuance;
- soft delete in Supabase with private object retention rather than immediate physical purge.

## 5. Compatibility and retry blockers found

### A. `mediaUpload.chunk` compatibility gap

The current internal-web high-resolution upload client calls:

`mediaUpload.begin -> mediaUpload.chunk (repeated) -> mediaUpload.finish`.

The isolated staging dispatcher implements `mediaUpload.begin` and `mediaUpload.finish` but does not implement `mediaUpload.chunk`.

Therefore an R2 binding alone would not make the existing high-resolution upload flow cutover-compatible. This is a real coding blocker, not an R2 inventory assumption.

### B. Begin retry identity

`mediaUpload.begin` currently inserts a new `UPLOADING` media row after issuing a new media ID. A retry of the same logical begin request is not yet resolved against an existing request identity. The R2 phase needs an explicit idempotent begin rule before integration PASS.

### C. Finish retry identity

`mediaUpload.finish` currently inserts an `UPLOADED` media event after a successful `HEAD` and DB status update. Repeating finish after a partial client/server retry can append duplicate finalization events. Finish needs an idempotent finalized-state path before integration PASS.

### D. Small-upload compensation

The current <=8 MiB compatibility upload writes the R2 object before inserting its metadata row. If the metadata commit fails after object write, an orphan private object can remain. The R2 phase needs compensation or a recoverable reconciliation path and a regression test for metadata-commit failure.

## 6. Tests added in this audit

Without touching an external bucket, isolated tests were added for:

- upload endpoint fail-closed behavior when the R2 binding is absent;
- invalid/expired upload authorization denial;
- exact content-length and MIME enforcement;
- exact authorized private object-key write to a mock R2 binding;
- read endpoint fail-closed behavior when the binding is absent;
- invalid read-token denial before object access;
- authorized missing-object `404`;
- authorized private read using the exact token object key and private response headers.

These tests are contract tests only. They are not evidence of actual R2 PUT/HEAD/GET and are not `BROWSER_PASS`.

## 7. Fail-closed local Cloudflare inventory runner

Path:

`backend/staging/scripts/audit-cloudflare-r2-readonly.mjs`

The runner:

- refuses to run outside `coding/runtime-backend-staging`;
- uses the repository-local Wrangler installation and invokes its Node CLI entrypoint directly for Windows/Unix compatibility;
- calls only read operations: Wrangler version, `whoami --json`, Pages project list, R2 bucket list, and a temporary Pages config download;
- filters the downloaded Pages configuration to R2 binding/bucket fields only, then deletes the temporary local directory;
- when an exact bucket name is supplied, additionally reads bucket info, r2.dev state, custom domains, CORS, lifecycle rules, and lock rules;
- never calls `auth token`, create, delete, set, enable, disable, deploy, or any object-write command.

Current first-pass result is account inventory empty. Therefore there is no valid existing bucket name for a second pass yet.

After the new bucket is created, run:

```powershell
node backend/staging/scripts/audit-cloudflare-r2-readonly.mjs --bucket code1-staging-media
```

The returned bucket identity/private/public/CORS/lifecycle/lock evidence must be checked before adding the Pages binding or writing an object.

## 8. Remaining gate

Before any actual R2 object write or Pages deployment:

1. create exactly one CODE1 STAGING-only bucket, proposed name `code1-staging-media`;
2. keep the bucket private and do not enable r2.dev/custom public domain;
3. rerun the read-only bucket-detail audit;
4. verify exact account/bucket identity, public state, CORS, lifecycle, lock rules, and empty object state;
5. only then add the `CODE1_MEDIA_BUCKET` Pages/Worker binding in the isolated staging branch/environment;
6. close `mediaUpload.chunk` compatibility, begin/finish idempotency, and small-upload compensation/reconciliation before integration PASS;
7. run actual staging R2 PUT -> HEAD exact size/MIME -> DB linkage -> private authenticated GET -> unauthorized/expired/wrong-scope/deleted denial tests.

The four deleted legacy Drive sources stay outside this initial R2 object path unless a separate retention/migration decision explicitly changes their status.

## 9. Performance state

No same-action Drive/R2 latency baseline has been established. `NO_BASELINE` remains the correct performance statement. No speed multiplier or index optimization is inferred.
