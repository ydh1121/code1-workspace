# CODE1 CODING CURRENT

Updated: 2026-09-12 04:38 KST
Status: PHASE 0 VERIFIED / SUPABASE STAGING FIRST_IMPORT PASS / PRIVATE R2 CREATED / MEDIA SCHEMA 0010 APPLIED / R2 UPLOAD CONTRACT HARDENED / PAGES PREVIEW R2 BINDING VERIFIED / PREVIEW BRANCH FILTER EXACT PASS / PREVIEW ORIGIN PASS / PREVIEW CORE ENV PASS / CONTROLLED PREVIEW DEPLOY PASS / PREVIEW READONLY HTTP PASS / ACTUAL R2 INTEGRATION PASS / SUPABASE POST-INTEGRATION VERIFY PASS / R2 INVENTORY READBACK NEXT
Branch: `coding/runtime-backend-staging`
Base main: `a71a71eae73706862308e194110f4fcc2d25db01`
Live cutover: NOT APPROVED
Production: PROHIBITED
PLANNING_DELTA_SEQ_SEEN = 20260911-003
CROSS_TRACK_BUS_LAST_SEEN = MSG-20260912-0022

## Hard boundaries

- Work is CODING/STAGING only.
- Do not modify `main`, live Public Frontend, Production Admin, CODE1 Production, HOOOO, INDX, IndiaDesk, Planning SSOT, or UIUX SSOT.
- Existing Apps Script/Sheet/Drive remains the live rollback source until separate cutover approval.
- No force push/history rewrite; do not rerun Supabase FIRST_IMPORT.
- Do not migrate/delete the four legacy Drive media rows merely because R2 exists.
- No public R2 endpoint, `r2.dev`, custom R2 domain, or browser-visible credential.
- Production variables/secrets/bindings remain READ_ONLY.
- No secret value may be committed to Git, Message Bus, Drive documents, or chat.

## Durable staging state

Supabase STAGING ref: `bsintmkyhptizrjoizfb` only. FIRST_IMPORT remains VERIFIED_COMPLETE.

Imported legacy media remain 4/4 `GOOGLE_DRIVE_LEGACY`, `object_key=NULL`, `DELETED`; Drive originals remain preserved. Migration `r2_media_upload_state` / ledger `20260910181248` remains applied.

R2 `code1-staging-media` remains private, with `r2.dev` disabled, no custom domain, and no legacy media migration.

Upload runtime hardening commit `a2c65735c5606789c7dfe423a3988229e96b0505`, CI `34512718904` SUCCESS. Begin/chunk/finish, 6 MiB multipart, idempotency/retry/finalize, HEAD verification, private GET, and small-upload orphan compensation are implemented.

## Pages isolation/runtime gates: PASS

Saved/reopened branch control:

```text
productionBranch = main
previewDeploymentSetting = custom
previewBranchIncludes = ["coding/runtime-backend-staging"]
previewBranchExcludes = []
```

Preview R2 binding:

```text
CODE1_MEDIA_BUCKET -> code1-staging-media
```

Production R2 binding: NONE.

Stable Preview origin:

`https://coding-runtime-backend-stagi.code1-workspace.pages.dev`

Preview environment exact runtime-name set remains:

```text
APP_ORIGIN
CODE1_LOGIN_IP_SECRET
CODE1_MEDIA_TOKEN_SECRET
CODE1_RUNTIME_BACKEND
CODE1_STAGING_PROJECT_REF
CODE1_SUPABASE_SERVICE_ROLE_KEY
CODE1_SUPABASE_URL
CODE1_UPLOAD_TOKEN_SECRET
SESSION_SECRET
```

Deferred remains `PASSWORD_PEPPER`, Google OAuth vars, and `BRIDGE_URL/BRIDGE_SECRET`.

## Controlled Preview deployment + read-only gate: PASS

Controlled post-provisioning Preview deployment commit:

`84ef7ed379c0a568544536b89039a0b335b681b1` -> SUCCESS

Read-only verifier result:

```text
ROOT_GET = 200
SESSION_GET = 200 {configured:true, authenticated:false, googleEnabled:false}
RPC_UNAUTH_BOOTSTRAP = 401 UNAUTHENTICATED
MEDIA_BINDING_PROBE = 403 FORBIDDEN
PREVIEW_READONLY_VERIFY=PASS
OBJECT_WRITE=NONE
REMOTE_MUTATION=NONE
```

## Actual external R2 integration: PASS

Operator ran `backend/staging/scripts/run-pages-r2-integration.ps1` once against the stable Preview alias.

Observed top-level result:

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

The signed-session success proves the entered Preview `SESSION_SECRET` matched the configured value; an incorrect secret could not have reached authenticated bootstrap or any subsequent PASS stage.

The post-delete `media` RPC returns generic HTTP 400 `REQUEST_FAILED` because `NOT_FOUND` is not currently mapped to a dedicated 404 response in the shared failure mapper. This is semantically rough but still proves new read-token issuance is denied after soft-delete. It does not invalidate the integration PASS.

## Independent Supabase post-integration verification: PASS

Independent SQL readback verified both test rows:

```text
M_32c63189358249c2844869a4
  status=DELETED
  source_storage=R2_PRIVATE
  file_size_bytes=131072
  upload_received_bytes=131072
  uploaded_by=OWNER

M_6132c51925d449b2b5b2e402
  status=DELETED
  source_storage=R2_PRIVATE
  file_size_bytes=11534336
  upload_received_bytes=11534336
  uploaded_by=OWNER
  r2_multipart_upload_id populated
```

Independent `media_events` readback also verified one `UPLOADED` event and one `SOFT_DELETED` event for each test media ID, with expected transition to `REVIEW_REQUIRED` and then `DELETED`.

## Local secret-input UX preference

Operator preference recorded: do not use clipboard-dependent secret entry and do not use hidden/SecureString input for future local operator steps. Prefer ordinary visible local input when a secret must be entered, and avoid requesting secret input entirely where technically unnecessary.

`backend/staging/scripts/run-pages-r2-integration.ps1` was updated accordingly in commit `5a2ee0109e6c97ed322f5906abd953cb181acc73` using `[CF-Pages-Skip]`; it now uses normal visible `Read-Host` input and still clears the temporary environment variable after execution.

No secret value is stored in Git, Bus, Drive documents, or this CURRENT.

## Cross-track sync

- `MSG-20260912-0019`: CODING -> PLANNING APPLIED.
- `MSG-20260912-0021`: PLANNING -> CODING Local Orchestrator Phase 1 notice ACKED; deferred until active R2 atomic work completes.
- `MSG-20260912-0022`: CODING -> PLANNING PENDING, Preview runtime read-only PASS + guarded R2 integration readiness.
- current CODING inbound pending: 0.
- current CODING outbound pending: 1.

## NEXT_ATOMIC_ACTION

Close the external R2 integration gate with an independent Cloudflare R2 inventory readback proving the two intended private test objects exist and no unexpected object was created.

Expected intentional post-test delta:

```text
private R2 test objects = 2
DB test rows = 2, both DELETED
legacy Drive media migrated = 0
Production mutation = 0
```

Do not rerun the integration test merely to re-prove already-passed stages.

After R2 inventory PASS, publish the consolidated R2 completion evidence to Planning, then read/apply the already-ACKED Local Orchestrator Phase 1 Work Order.

## Other open items

- HTTP error mapping: consider mapping `NOT_FOUND` to 404 instead of generic 400 in a separate behavioral cleanup.
- npm audit: 3 high + 1 critical; separate dependency hardening, no blind `npm audit fix --force`
- stale source duplicate rows 501-512: separate decision
- same-action p50/p95: now eligible for later runnable staging measurement
- Apps Script Drive root: `ROOT_EXCEPTION`; no copy/replacement
- Local Orchestrator Phase 1: ACKED and next after R2 inventory close

ROLLBACK: Apps Script/Sheet/Drive remains live. Production has no R2 binding.
