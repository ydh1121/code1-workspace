# CODE1 R2 / PRIVATE MEDIA STAGING READ-ONLY AUDIT — 2026-09-11

Status: `R2_RESOURCE_IDENTITY_BLOCKED / CONTRACT_AUDIT_ADVANCED / NO_EXTERNAL_R2_MUTATION`
Track: CODING
Branch: `coding/runtime-backend-staging`
Audited origin baseline: `9066c104a1fbc34f2b597ba9f6df0781d00203ee`
Supabase target: CODE1 STAGING `bsintmkyhptizrjoizfb` only
Live / Public Frontend / main / Production: unchanged

## 1. Recovery result

The completed Supabase FIRST_IMPORT was preserved. A fresh read of CODE1 STAGING reconfirmed the durable post-import counts already recorded in the post-import handoff, including 4 `media_assets` rows and migration registry 268. No import, schema, or index mutation was repeated during this audit.

Cross-track state was also re-read before R2 work: `MSG-20260911-0003` is the current CODING -> PLANNING pending implementation-evidence message and the older pre-import handoff state is superseded.

## 2. Actual legacy media state

The four imported farm-media metadata rows are not active migration candidates:

- all 4 have `source_storage = GOOGLE_DRIVE_LEGACY`;
- all 4 have `object_key = NULL`;
- all 4 currently have `status = DELETED`;
- their Drive originals still exist as private owner-only files;
- Drive MIME type and byte size match the corresponding Supabase metadata for all 4;
- SHA-256 was calculated from the actual Drive bytes for all 4.

Detailed file identifiers, filenames, rights/consent fields, deletion timestamps, and SHA-256 values are intentionally not committed to this repository. They are recorded in the private Drive artifact `CODE1_SOURCE_MEDIA_MANIFEST_20260911` inside `[PRIVATE] CODE1 STAGING MIGRATION`.

Until a retention/purge policy or an explicit migration decision says otherwise, these rows are classified in that private manifest as `HOLD_DELETED_RETENTION`. This audit does not copy deleted originals into R2 and does not delete the Drive rollback source.

## 3. R2 resource identity audit

The repository establishes a logical binding contract named `CODE1_MEDIA_BUCKET`, but the current `wrangler.toml` contains no `r2_buckets` binding and no actual bucket name or resource identifier.

Drive project records describe the intended Cloudflare/Supabase/R2 architecture but do not provide sufficient current evidence of an exact CODE1-only R2 bucket identity or staging binding. This session also has no authenticated Cloudflare account inventory capability from which to independently verify bucket list, account identifier, public access, CORS, lifecycle, existing objects, or Pages/Worker binding state.

Result: `R2_RESOURCE_IDENTITY_BLOCKED`.

No bucket was created, reused, bound, made public, or written during this audit. In particular, no HOOOO or other-project R2 resource is eligible for reuse.

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

## 7. Remaining gate

Before any actual R2 binding change or object migration, obtain current account-level evidence for the exact CODE1 STAGING resource:

- Cloudflare account/resource identifier;
- exact CODE1 R2 bucket name;
- private/public state and custom-domain/public-development-URL state;
- CORS;
- lifecycle/retention configuration;
- existing-object state;
- exact Pages/Worker staging binding name and environment;
- proof that the resource is not HOOOO or another project.

Only after resource identity is verified should the isolated staging implementation close `mediaUpload.chunk` compatibility and retry/compensation gaps, then run actual R2 PUT/HEAD/private GET/unauthorized-denial/DB-linkage tests.

## 8. Performance state

No same-action Drive/R2 latency baseline was established in this audit. `NO_BASELINE` remains the correct performance statement. No speed multiplier or index optimization is inferred.
