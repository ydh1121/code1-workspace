# CODE1 CODING BATON

Updated: 2026-09-12 04:18 KST
PLANNING_DELTA_SEQ_SEEN = 20260911-003
CROSS_TRACK_BUS_LAST_SEEN = MSG-20260912-0022

LAST_VERIFIED_ACTION: the freshly provisioned Cloudflare Pages Preview deployment passed the repository read-only HTTP verifier. Root=200; session reports configured=true/authenticated=false; unauth bootstrap fails closed with 401 UNAUTHENTICATED; R2-backed media route fails closed with 403 FORBIDDEN; verifier reports PREVIEW_READONLY_VERIFY=PASS, OBJECT_WRITE=NONE, REMOTE_MUTATION=NONE. Branch control, stable Preview origin, nine-name environment inventory, Preview R2 binding, and Production isolation remain PASS.

CURRENT_WORK: execute one guarded external R2 integration pass against the stable Preview alias, then independently verify Supabase test state and R2 inventory. Do not switch to Local Orchestrator Phase 1 until this active R2 atomic work reaches completion.

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

## Durable state before integration

FIRST_IMPORT is VERIFIED_COMPLETE and must not be rerun. Pre-integration counts remain accounts 2, farms 12, questions 231, submissions 2, answer versions 5, media 4, media events 5, audit 29, login guard 3, housing 12, migration registry 268.

Imported media remain 4/4 `GOOGLE_DRIVE_LEGACY`, `object_key=NULL`, `DELETED`; no legacy copy has occurred. Migration `r2_media_upload_state` / ledger `20260910181248` remains applied.

R2 `code1-staging-media` is private and, before the external integration run, remains 0 objects / 0 B with r2.dev disabled, no custom domain, CORS absent/code 10059, and default 7-day multipart abort.

## Pages state: PASS

- Preview branch control: exact custom include only `coding/runtime-backend-staging`
- Production branch: `main`
- Preview R2: `CODE1_MEDIA_BUCKET -> code1-staging-media`
- Production R2 binding: NONE
- stable Preview alias: `https://coding-runtime-backend-stagi.code1-workspace.pages.dev`
- Preview runtime names: exact approved nine-name set, stored as encrypted Secret entries by current UI
- deferred: `PASSWORD_PEPPER`, Google OAuth vars, `BRIDGE_URL/BRIDGE_SECRET`

Controlled post-provisioning Preview deployment:

`84ef7ed379c0a568544536b89039a0b335b681b1` -> SUCCESS

Do not Retry, Rollback, Promote, or trigger another Preview deployment for the integration runner/doc commits; all subsequent preparation commits use `[CF-Pages-Skip]`.

## Read-only verifier: PASS

Operator output:

```text
ROOT_GET: status=200
SESSION_GET: status=200 body={"configured":true,"authenticated":false,"googleEnabled":false}
RPC_UNAUTH_BOOTSTRAP: status=401 body={"error":"UNAUTHENTICATED",...}
MEDIA_BINDING_PROBE: status=403 body=FORBIDDEN
PREVIEW_READONLY_VERIFY=PASS
OBJECT_WRITE=NONE
REMOTE_MUTATION=NONE
```

This is the final no-write gate before actual R2 integration.

## Guarded integration tooling: READY

Files:

```text
backend/staging/scripts/integrate-pages-r2-staging.mjs
backend/staging/scripts/run-pages-r2-integration.ps1
```

Runner commit `1bef88f9ecaa0ba8dc929e3492c0a4b13d09a988` -> CI `34637938259` SUCCESS.

CI hardening head `fa9b1fc6fb501a91ab9b0c69b7e28a4ebac0a488` parses all staging PowerShell wrappers and preserves existing syntax/unit/root-baseline/build checks.

Runner contract:

- exact branch guard and Preview-host guard;
- explicit `--confirm-staging-r2-write` required;
- hidden local Preview `SESSION_SECRET` input via SecureString wrapper;
- active default test principal `OWNER`, session_version 2;
- authenticated bootstrap must prove `SUPABASE_STAGING`;
- actual small PUT and 11 MiB multipart flow;
- begin/chunk/finish retry idempotency;
- HEAD/DB linkage/private GET/hash checks;
- tampered media token denial;
- DB soft-delete + denial of new read-token issuance after delete.

Successful test objects remain private in R2 by soft-delete retention policy. A full PASS therefore intentionally leaves 2 private R2 test objects while test DB rows are soft-deleted. Production/main/legacy Drive remain untouched.

The session-cookie mechanism in this runner is integration-only and does not prove password login; `PASSWORD_PEPPER` remains deferred.

## Cross-track sync

- MSG-0019: CODING -> PLANNING APPLIED.
- MSG-0021: PLANNING -> CODING ACKED; Local Orchestrator Phase 1 is intentionally deferred until this R2 atomic work completes.
- MSG-0022: CODING -> PLANNING PENDING; Preview read-only PASS + integration readiness.
- CODING inbound pending: 0.
- CODING outbound pending: 1.

## NEXT_ATOMIC_ACTION

On the operator PC:

```powershell
cd C:\Users\Administrator\Desktop\code1
git pull --ff-only origin coding/runtime-backend-staging
powershell -NoProfile -ExecutionPolicy Bypass -File backend/staging/scripts/run-pages-r2-integration.ps1
```

When prompted `Paste Preview SESSION_SECRET (hidden)`, paste the exact Preview `SESSION_SECRET` currently saved in Cloudflare. Never send it to chat.

Do not run the integration a second time automatically if any step fails. Return the complete console output so the failed stage and any created staging rows/multipart state can be inspected first.

PASS requires at minimum:

```text
SIGNED_SESSION=PASS
SMALL_PUT=PASS
SMALL_PUT_RETRY_IDEMPOTENT=PASS
SMALL_PRIVATE_GET=PASS
TAMPERED_MEDIA_TOKEN_DENIAL=PASS
MULTIPART_BEGIN=PASS
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

After PASS, perform independent Supabase row/event verification and Cloudflare R2 object inventory before marking external integration complete.

ROLLBACK: Apps Script/Sheet/Drive remains live. Production has no R2 binding.
