# CODE1 CODING BATON

Updated: 2026-09-12 04:38 KST
PLANNING_DELTA_SEQ_SEEN = 20260911-003
CROSS_TRACK_BUS_LAST_SEEN = MSG-20260912-0022

LAST_VERIFIED_ACTION: actual Cloudflare Pages Preview -> private R2 -> Supabase STAGING integration completed PASS. Signed staging session was accepted; small 128 KiB PUT/private GET/tampered-token denial passed; 11 MiB multipart begin/chunk/finish plus retry idempotency/HEAD/DB linkage/private GET passed; both test media rows soft-deleted; new read issuance after delete denied; Production and legacy Drive mutation remained NONE. Independent Supabase SQL readback verified both rows are `DELETED`, `R2_PRIVATE`, exact expected sizes/received bytes, and each has UPLOADED + SOFT_DELETED events.

CURRENT_WORK: perform one independent Cloudflare R2 inventory readback to prove exactly the two intended private test objects exist and no unexpected object was created. Then close the R2 atomic work and switch to the already-ACKED Local Orchestrator Phase 1 Work Order.

## Fixed boundaries

- branch: `coding/runtime-backend-staging`
- base main: `a71a71eae73706862308e194110f4fcc2d25db01`
- Supabase target: STAGING ref `bsintmkyhptizrjoizfb` only
- live cutover: NOT APPROVED
- CODE1 Production: PROHIBITED
- no main/history rewrite/force push
- no Public Frontend / formal Admin / Planning SSOT / UIUX SSOT mutation
- no public R2 endpoint
- no HOOOO/INDX/IndiaDesk mutation
- no legacy Drive-media auto migration/deletion
- Production vars/secrets/bindings remain READ_ONLY
- no secret value in Git/Bus/Drive documents/chat

## Durable state

FIRST_IMPORT remains VERIFIED_COMPLETE and must not be rerun.

Imported legacy media remain 4/4 `GOOGLE_DRIVE_LEGACY`, `object_key=NULL`, `DELETED`; no legacy R2 copy occurred.

R2 `code1-staging-media` remains private with r2.dev disabled and no custom domain. The integration intentionally created two private test objects retained by soft-delete policy.

## Pages state: PASS

- Preview branch control: exact custom include only `coding/runtime-backend-staging`
- Production branch: `main`
- Preview R2: `CODE1_MEDIA_BUCKET -> code1-staging-media`
- Production R2 binding: NONE
- stable Preview alias: `https://coding-runtime-backend-stagi.code1-workspace.pages.dev`
- controlled post-provisioning Preview deployment `84ef7ed379c0a568544536b89039a0b335b681b1` -> SUCCESS
- read-only runtime verifier -> PASS

## External R2 integration: PASS

Operator output included:

```text
SIGNED_SESSION=PASS
bootstrapBackend=SUPABASE_STAGING
SMALL_PUT=PASS mediaId=M_32c63189358249c2844869a4 bytes=131072
SMALL_PUT_RETRY_IDEMPOTENT=PASS
SMALL_PRIVATE_GET=PASS
TAMPERED_MEDIA_TOKEN_DENIAL=PASS
MULTIPART_BEGIN=PASS mediaId=M_6132c51925d449b2b5b2e402 bytes=11534336
MULTIPART_BEGIN_RETRY_IDEMPOTENT=PASS
MULTIPART_CHUNK1=PASS
MULTIPART_CHUNK_RETRY_IDEMPOTENT=PASS
MULTIPART_CHUNK2=PASS
MULTIPART_FINISH_HEAD_DB=PASS
MULTIPART_FINISH_RETRY_IDEMPOTENT=PASS
MULTIPART_PRIVATE_GET=PASS
DB_LINKAGE=PASS
R2_STAGING_INTEGRATION=PASS
SOFT_DELETE=PASS (2 rows)
DELETED_NEW_READ_ISSUANCE_DENIAL=PASS (2 rows)
PRODUCTION_MUTATION=NONE
LEGACY_DRIVE_MUTATION=NONE
```

The accepted signed session proves the entered `SESSION_SECRET` was correct. A wrong secret would fail before authenticated bootstrap.

The post-delete media read attempts currently surface HTTP 400 generic `REQUEST_FAILED` rather than dedicated 404 because `NOT_FOUND` is not mapped in the shared failure mapper. This is a semantic cleanup item only; denial itself is confirmed.

## Independent Supabase verification: PASS

Rows:

```text
M_32c63189358249c2844869a4
  status=DELETED
  source_storage=R2_PRIVATE
  size=131072
  received=131072
  uploaded_by=OWNER

M_6132c51925d449b2b5b2e402
  status=DELETED
  source_storage=R2_PRIVATE
  size=11534336
  received=11534336
  uploaded_by=OWNER
  multipart upload id populated
```

Events: each media ID has one `UPLOADED` transition to `REVIEW_REQUIRED` and one `SOFT_DELETED` transition to `DELETED`.

## Local input preference

Do not use clipboard-dependent secret instructions and do not use hidden/SecureString prompts for future local operator steps. If a local secret must be entered, use ordinary visible input; avoid asking for secret input when it is not technically required.

Wrapper `backend/staging/scripts/run-pages-r2-integration.ps1` changed at commit `5a2ee0109e6c97ed322f5906abd953cb181acc73` to normal visible `Read-Host` input while still clearing the temporary environment variable after execution.

## Cross-track sync

- MSG-0019: CODING -> PLANNING APPLIED.
- MSG-0021: PLANNING -> CODING ACKED; Local Orchestrator Phase 1 remains next after R2 atomic close.
- MSG-0022: CODING -> PLANNING PENDING; read-only PASS + integration readiness.
- CODING inbound pending: 0.
- CODING outbound pending: 1.

## NEXT_ATOMIC_ACTION

Perform independent Cloudflare R2 inventory readback only. Do not rerun uploads.

Required close condition:

```text
bucket = code1-staging-media
expected test objects = 2
unexpected objects = 0
legacy migrated objects = 0
Production mutation = 0
```

After inventory PASS, publish consolidated CODING->PLANNING R2 completion evidence and begin the deferred Local Orchestrator Phase 1 Work Order.

ROLLBACK: Apps Script/Sheet/Drive remains live. Production has no R2 binding.
