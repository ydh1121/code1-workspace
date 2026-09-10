# CODE1 CODING CURRENT

Updated: 2026-09-11
Status: PHASE 0 VERIFIED / SUPABASE STAGING FIRST_IMPORT PASS / R2 PRIVATE BUCKET CREATED+VERIFIED / R2 MEDIA SCHEMA 0010 APPLIED / MEDIA UPLOAD CONTRACT HARDENED / PAGES PREVIEW BINDING NOT YET CONFIGURED
Branch: `coding/runtime-backend-staging`
Base main: `a71a71eae73706862308e194110f4fcc2d25db01`
Live cutover: NOT APPROVED
Production: PROHIBITED
PLANNING_DELTA_SEQ_SEEN = 20260911-003
CROSS_TRACK_BUS_LAST_SEEN = MSG-20260911-0010

## Planning Delta 20260911-003 boundary

`MSG-20260911-0009` / Planning Delta `20260911-003` was read at the required infra boundary. It does not change the current coding priority. Planning accepted `code1-staging-media` + server-only `CODE1_MEDIA_BUCKET` as an isolated STAGING technical candidate while preserving the existing restrictions: no public endpoint, no other-project resource reuse, no live/main/Production impact, and no automatic legacy Drive-media migration. The prior Apps Script root-hygiene request is reconciled as `ROOT_EXCEPTION / MOVE_BLOCKED_BY_FILE_AUTHORIZATION`; no copy or replacement Apps Script may be created.

## Durable database state

CODE1 Supabase STAGING project `bsintmkyhptizrjoizfb` remains the only database target. `FIRST_IMPORT` is complete and must not be rerun. Durable imported counts remain:

- workspace accounts 2
- farms 12
- question catalog 231
- intake submissions 2
- submission answer versions 5
- media assets 4
- media events 5
- audit log 29
- login guard 3
- housing environment records 12
- migration registry 268
- question policies/history 0/0
- planning capabilities/brief versions/source artifacts 0/0/0

The 4 imported media rows remain `GOOGLE_DRIVE_LEGACY`, `object_key = NULL`, and `DELETED`. They were not copied to R2 and their private Drive rollback sources remain intact under the private source-media manifest.

## R2 resource gate

The operator created exactly one CODE1 STAGING-only bucket:

- bucket: `code1-staging-media`
- location: APAC
- storage class: Standard
- object count / size at post-create audit: 0 / 0 B
- `r2.dev`: disabled
- custom domains: none
- lock rules: none
- lifecycle: default abort of incomplete multipart uploads after 7 days
- Pages R2 binding at post-create audit: none
- CORS list command: exit 1 on the empty bucket; no CORS policy is being added because the current architecture uses a server-side Pages Function binding, not direct browser/presigned cross-origin R2 access. The enhanced read-only runner will capture the CLI detail on the next audit.

The bucket is private and no legacy media/object was uploaded during the provisioning audit.

## Media upload contract hardening

Commit `a2c65735c5606789c7dfe423a3988229e96b0505` added an isolated staging media-upload runtime without changing the legacy live runtime. GitHub Actions run `34512718904` succeeded, including staging unit/contract tests, root regression comparison, and build. The commit used `[CF-Pages-Skip]`; GitHub check evidence showed only the GitHub Actions check and no Cloudflare Pages preview deployment for that commit.

The staging upload path now provides:

- `mediaUpload.begin -> mediaUpload.chunk -> mediaUpload.finish` dispatch coverage;
- 6 MiB multipart chunk size, safely above R2's 5 MiB non-final-part minimum and below the existing 12 MB JSON RPC body cap after base64 expansion;
- begin retry reuse keyed by actor + request ID for `R2_PRIVATE` rows;
- monotonic chunk offset/received-byte tracking and part SHA-256/ETag metadata for retry verification;
- finish retry recovery when the R2 object already exists after multipart completion;
- status-idempotent finalization so repeated finish does not append another `UPLOADED` event;
- small-upload R2 object compensation delete when atomic DB registration fails;
- exact object HEAD size check and MIME mismatch fail-closed behavior before final DB transition.

The existing browser already supplies `requestId` for small uploads and uses `begin.chunkBytes` for high-resolution uploads, so no Public Frontend/client contract rewrite was required.

## Supabase migration 0010

Repository schema file: `backend/staging/schema/0010_r2_media_upload_state.sql`.

Applied to CODE1 STAGING through Supabase migration `r2_media_upload_state` (migration ledger version `20260910181248`). Independent readback verified:

- 4 new media state columns present: `r2_multipart_upload_id`, `upload_chunk_bytes`, `upload_received_bytes`, `upload_parts`;
- partial unique idempotency index `media_assets_r2_actor_request_uniq` present;
- `code1_finalize_media_upload(text,text,text)` EXECUTE: service_role true / anon false / authenticated false;
- `code1_register_media_upload(text,text,jsonb)` EXECUTE: service_role true / anon false / authenticated false;
- media row count still 4, all 4 still DELETED, R2_PRIVATE row count still 0.

Security Advisor after 0010: WARN 0; existing `rls_enabled_no_policy` INFO count remains 20. Performance Advisor: unindexed foreign keys 22, unused indexes 11. No workload-free index cleanup is authorized.

## Cloudflare Pages deployment boundary

A prior GitHub check audit proved normal commits on this branch trigger Cloudflare Pages preview deployment. Therefore staging hardening commits now use `[CF-Pages-Skip]` until an intentional preview integration test is ready.

Do not immediately make the repository's 3-line `wrangler.toml` the Pages source of truth. Cloudflare documents that existing dashboard configuration should first be downloaded and reconciled. The read-only audit runner was enhanced in commit `9dd49cb99e3a334945de14cad57855112cfcd8bd` to print a sanitized `PAGES_SAFE_CONFIG_SHAPE` with values redacted, plus detailed allowed-command failures, without printing the Cloudflare account ID/email.

## Cross-track sync

`MSG-20260911-0009` is APPLIED. New implementation evidence `MSG-20260911-0010` was published to Planning after the R2 bucket/schema/upload-hardening checkpoint. Current CODING sync is inbound 0 / outbound 1; only `MSG-0010` remains PENDING for Planning.

## Remaining gate

Pages Preview still has no verified `CODE1_MEDIA_BUCKET` binding. No actual R2 object integration test or browser PASS has been run yet.

Next atomic action:

1. operator pulls the latest coding branch;
2. run `node backend/staging/scripts/audit-cloudflare-r2-readonly.mjs --bucket code1-staging-media`;
3. inspect `PAGES_SAFE_CONFIG_SHAPE` and detailed CORS output without exposing secret values;
4. preserve all existing Preview settings and add `CODE1_MEDIA_BUCKET -> code1-staging-media` to Preview only, not Production;
5. intentionally deploy exactly one Preview containing the hardened media runtime;
6. run actual R2 PUT/multipart -> HEAD size/MIME -> Supabase linkage -> private authenticated GET and denial/retry tests;
7. do not migrate the four deleted Drive sources and do not cut over live without separate approval.

## Other open items

- Drive root hygiene `MSG-20260911-0005`: `ACKED / ROOT_EXCEPTION`; safe same-file-ID target was identified but connector write authorization blocked the move. No copy was made.
- npm audit report: 3 high + 1 critical; separate hardening track, no `npm audit fix --force` during this gate.
- stale `01_농가_Master` rows 501-512 cleanup: separate explicit decision.
- same-action p50/p95: `NO_BASELINE` until runnable R2-backed staging path exists.
- live/Public Frontend/main/Production/HOOOO/INDX/IndiaDesk: unchanged.
