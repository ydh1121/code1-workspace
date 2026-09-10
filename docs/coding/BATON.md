# CODE1 CODING BATON

Updated: 2026-09-11
PLANNING_DELTA_SEQ_SEEN = 20260910-002
CROSS_TRACK_BUS_LAST_SEEN = MSG-20260911-0007

LAST_VERIFIED_ACTION: CODE1 STAGING R2 bucket `code1-staging-media` was created and read-only verified private/empty. Media upload contract hardening commit `a2c65735c5606789c7dfe423a3988229e96b0505` passed GitHub Actions run `34512718904` without a Cloudflare Pages deployment because `[CF-Pages-Skip]` was used. Supabase STAGING migration `r2_media_upload_state` / ledger version `20260910181248` then applied successfully and independent readback verified the new columns/index/functions and preserved all 4 legacy DELETED media rows.

CURRENT_WORK: preserve current Pages Preview configuration, then add Preview-only R2 binding `CODE1_MEDIA_BUCKET -> code1-staging-media` and intentionally deploy/test exactly one preview. Production/live remains prohibited.

VERIFIED_CODE_STATE:
- branch: `coding/runtime-backend-staging`
- base main: `a71a71eae73706862308e194110f4fcc2d25db01`
- R2 upload hardening: `a2c65735c5606789c7dfe423a3988229e96b0505`
- R2 upload hardening CI: `34512718904` / SUCCESS
- read-only audit sanitizer: `9dd49cb99e3a334945de14cad57855112cfcd8bd`
- normal branch commits were proven to trigger Cloudflare Pages Preview; `[CF-Pages-Skip]` is required for non-deployment hardening/checkpoint commits until the intentional integration deployment.

POST_IMPORT_DB_GATE:
- Supabase target: CODE1 STAGING `bsintmkyhptizrjoizfb` only
- FIRST_IMPORT: VERIFIED_COMPLETE / do not rerun
- accounts 2; farms 12; questions 231; submissions 2; answer versions 5
- media assets 4; media events 5; audit log 29; login guard 3; housing 12
- migration registry 268
- question policies/history 0/0; planning capabilities/brief/artifacts 0/0/0

R2_BUCKET_GATE:
- bucket `code1-staging-media`: CREATED
- location APAC; Standard storage class
- post-create object inventory: 0 objects / 0 B
- r2.dev: disabled
- custom domains: none
- lock rules: none
- lifecycle: default abort incomplete multipart uploads after 7 days
- Pages R2 binding: none at post-create audit
- CORS list: command returned exit 1 on empty bucket; no policy is required for the current server-binding architecture. Enhanced runner now reports allowed-command detail on next read-only audit.
- deleted Drive legacy source migration: NOT PERFORMED

R2_MEDIA_SCHEMA_0010:
- repository file: `backend/staging/schema/0010_r2_media_upload_state.sql`
- applied migration name: `r2_media_upload_state`
- ledger version: `20260910181248`
- added columns: `r2_multipart_upload_id`, `upload_chunk_bytes`, `upload_received_bytes`, `upload_parts`
- partial unique index: `media_assets_r2_actor_request_uniq` for `R2_PRIVATE` actor/request identity
- RPC `code1_finalize_media_upload`: service_role execute true; anon/authenticated false
- RPC `code1_register_media_upload`: service_role execute true; anon/authenticated false
- post-apply media rows: total 4 / DELETED 4 / R2_PRIVATE 0

R2_UPLOAD_RUNTIME:
- isolated module: `backend/staging/src/media-upload-runtime.mjs`
- `staging-dispatch.mjs` intercepts FARM `upload` plus `mediaUpload.begin`, `.chunk`, `.finish`
- high-resolution chunk size: 6 MiB
- browser high-res contract preserved because client uses `begin.chunkBytes`
- small upload contract preserved because browser already sends `requestId`
- begin retry: actor + request ID resolves to same R2_PRIVATE media identity
- chunk retry: monotonic offset plus per-part SHA-256/ETag state
- finish retry: recovers when object already exists after multipart completion
- final status/event: atomic service-role SQL RPC; repeated finish does not append another UPLOADED event
- <=8 MiB single PUT: failed DB registration triggers R2 object compensation delete
- finalization verifies R2 HEAD exact size and MIME mismatch fail-closed

R2_TEST_STATE:
- local isolated tests for new runtime: 5/5 PASS before commit
- repository CI staging unit/contract tests: PASS in run `34512718904`
- root regression comparison/build: PASS in same run
- actual external R2 PUT/multipart/HEAD/GET: NOT YET RUN
- browser PASS: NOT YET RUN

SECURITY_PERFORMANCE_POST_0010:
- Security Advisor: WARN 0; `rls_enabled_no_policy` INFO 20, intentional server-only boundary
- Performance Advisor: unindexed foreign keys 22; unused indexes 11
- prior unindexed FK count was 23; do not infer a tuning target or remove indexes without workload evidence

PAGES_CONFIG_GATE:
- repo `wrangler.toml` remains intentionally minimal and does not yet contain R2 binding
- do not promote it blindly to Pages source-of-truth
- enhanced runner `backend/staging/scripts/audit-cloudflare-r2-readonly.mjs` now prints sanitized `PAGES_SAFE_CONFIG_SHAPE`, variable/binding presence with values redacted, sanitized WHOAMI, and detailed allowed-command failures
- next operator read-only command: `node backend/staging/scripts/audit-cloudflare-r2-readonly.mjs --bucket code1-staging-media`
- after safe-shape review, add Preview-only binding `CODE1_MEDIA_BUCKET -> code1-staging-media` while preserving existing Preview variables/secrets/settings
- then intentionally deploy one Preview and run actual R2 integration tests

SOURCE_MEDIA_MANIFEST:
- private Drive artifact `CODE1_SOURCE_MEDIA_MANIFEST_20260911` in `[PRIVATE] CODE1 STAGING MIGRATION`
- 4/4 legacy farm media originals exist privately; MIME/size match DB; SHA-256 stored only in private manifest
- DB state 4/4 DELETED, object_key NULL, source GOOGLE_DRIVE_LEGACY
- eligibility HOLD_DELETED_RETENTION
- do not copy/delete them merely because R2 now exists

CROSS_TRACK_SYNC:
- `MSG-20260911-0003` CODING -> PLANNING post-import evidence: PENDING
- `MSG-20260911-0005` PLANNING -> CODING Drive root hygiene: NEEDS_REVIEW; connector 403 blocked safe same-file-ID move, no Drive mutation
- `MSG-20260911-0006`: SUPERSEDED
- `MSG-20260911-0007` CODING -> PLANNING R2 account inventory/provisioning evidence: PENDING
- next new CODING message must use a fresh ID after re-reading the Bus and should report bucket creation + 0010 + upload-contract hardening evidence; do not duplicate FIRST_IMPORT evidence

OPEN_WAITING:
- sanitized Pages Preview config shape: WAITING operator read-only output
- `CODE1_MEDIA_BUCKET` Preview binding: NOT_CONFIGURED
- actual R2 integration/security test: WAITING_PREVIEW_BINDING
- same-action p50/p95: NO_BASELINE / WAITING runnable R2-backed staging
- npm 3 high + 1 critical: OPEN_SEPARATE_HARDENING
- stale source duplicate rows 501-512: OPEN_SEPARATE_DECISION
- Drive root hygiene: NEEDS_REVIEW
- live cutover: NOT APPROVED
- CODE1 Production: PROHIBITED

NEXT_ATOMIC_ACTION:
1. operator pulls latest `coding/runtime-backend-staging`;
2. run `node backend/staging/scripts/audit-cloudflare-r2-readonly.mjs --bucket code1-staging-media`;
3. inspect `PAGES_SAFE_CONFIG_SHAPE` plus detailed CORS failure; do not paste secrets because runner redacts values;
4. preserve existing Preview configuration and add Preview-only `CODE1_MEDIA_BUCKET -> code1-staging-media`;
5. intentionally deploy exactly one Preview containing the hardened code;
6. test actual R2 multipart/single PUT -> HEAD size/MIME -> DB linkage -> private GET plus unauthenticated/expired/wrong-scope/deleted/retry behavior;
7. update CURRENT/BATON/Message Bus with verified evidence; no live or Production cutover.

ROLLBACK: existing Apps Script/Sheet/Drive remains the live runtime. The R2 bucket is still empty and unbound to Pages at this checkpoint, so no user-visible runtime dependency has been introduced.
