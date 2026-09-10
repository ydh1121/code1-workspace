# CODE1 CODING CURRENT

Updated: 2026-09-11
Status: PHASE 0 VERIFIED / SUPABASE STAGING FIRST_IMPORT PASS / R2 PRIVATE BUCKET CREATED+VERIFIED / R2 MEDIA SCHEMA 0010 APPLIED / MEDIA UPLOAD CONTRACT HARDENED / PAGES PREVIEW R2 CONFIG DEPLOYED / REMOTE BINDING+RUNTIME READBACK WAITING
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
- pre-binding Pages R2 binding: none
- CORS: Cloudflare API returned code 10059 / configuration does not exist. No CORS policy is being added because the current architecture uses a server-side Pages Function binding rather than direct browser/presigned cross-origin R2 access.

The bucket remains private. No legacy media/object was uploaded during provisioning or binding configuration.

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

## Pages Preview binding deployment

The pre-binding operator audit showed the downloaded Pages config shape contained only the Pages project root fields plus an empty `[env.production]`; no R2 binding existed. This removed the earlier configuration-shape ambiguity.

Repository commit `0920bfa49afa3a55355b91fc7fe98890d2f59916` then changed only `wrangler.toml` to add:

```toml
[env.production]

[[env.preview.r2_buckets]]
binding = "CODE1_MEDIA_BUCKET"
bucket_name = "code1-staging-media"
```

The binding is deliberately under `env.preview`, not top-level or `env.production`. Cloudflare Pages supports only `preview` and `production` environment overrides; Preview configuration applies to Preview deployments project-wide rather than one branch only. Production remains without an R2 binding in this repository config.

The commit intentionally omitted `[CF-Pages-Skip]`. GitHub Actions run `34515272730` completed SUCCESS and Cloudflare Pages check completed SUCCESS, producing an immutable Preview deployment and the stable branch Preview URL. No production deployment was requested or performed.

This deployment success proves the config parsed and deployed, but does not by itself prove the remote Pages project now exposes the expected binding to runtime. Remote config readback and HTTP runtime probing remain required before claiming `PAGES_PREVIEW_R2_BINDING_PASS`.

## Read-only verification tooling

`backend/staging/scripts/audit-cloudflare-r2-readonly.mjs` remains the Cloudflare resource/config readback tool. Commit `794a535a3b9e67d6d9f3dfbdd9fb013659a5f22f` hardened diagnostic redaction so account paths, emails, bearer tokens and token/secret/key-looking values are not echoed by allowed-command errors. CI `34515383539` SUCCESS; `[CF-Pages-Skip]` prevented another Preview deployment.

`backend/staging/scripts/verify-pages-preview-readonly.mjs` was added in commit `8efe534bda3c86f8c48ede4a98af0cde7b98519e`. It rejects the production hostname and performs only:

- GET `/`;
- GET `/api/session`;
- one unauthenticated `bootstrap` POST to `/api/rpc`, which is rejected during session validation before action dispatch;
- GET `/api/staging/media-get` without a token.

The media probe distinguishes the remaining runtime gate without object writes: `404` means Preview is still on Apps Script runtime, `503 R2_BINDING_REQUIRED` means Supabase staging runtime is active but R2 binding is missing, and `403 FORBIDDEN` means the staging media route sees the R2 binding and correctly denies an invalid/missing media token.

## LAST_ATTEMPTED_BUT_UNVERIFIED

- Pages Preview config containing `env.preview.r2_buckets` deployed successfully at `0920bfa49afa3a55355b91fc7fe98890d2f59916`.
- Remote Pages config has not yet been independently downloaded after that deployment, so `CODE1_MEDIA_BUCKET` binding is `DEPLOYED_CONFIG / READBACK_WAITING`, not VERIFIED.
- Preview `CODE1_RUNTIME_BACKEND=SUPABASE_STAGING` and Preview `APP_ORIGIN` compatibility have not yet been proven by external HTTP read-only probes.
- Actual R2 PUT/multipart/HEAD/private GET and DB linkage remain NOT RUN.

## Cross-track sync

`MSG-20260911-0009` is APPLIED. Implementation evidence `MSG-20260911-0010` remains PENDING for Planning. Current CODING sync at the last Bus read is inbound 0 / outbound 1.

## Next atomic action

On the operator PC after pulling the current branch:

1. rerun `node backend/staging/scripts/audit-cloudflare-r2-readonly.mjs --bucket code1-staging-media` and confirm the downloaded Pages config contains the exact Preview R2 binding while Production remains unbound;
2. run `node backend/staging/scripts/verify-pages-preview-readonly.mjs --base-url https://coding-runtime-backend-stagi.code1-workspace.pages.dev`;
3. classify the Preview result before any object write: PASS only if session configuration is present, unauthenticated RPC returns 401, and the media probe returns 403;
4. if runtime probe returns 404, configure the isolated Preview runtime/env gate before R2 integration; if 503, repair only the Preview R2 binding; if RPC returns 403, repair Preview APP_ORIGIN before integration;
5. only after read-only PASS run actual R2 single/multipart PUT -> HEAD size/MIME -> Supabase linkage -> private authenticated GET plus unauthorized/expired/wrong-scope/deleted/retry tests;
6. do not migrate the four deleted Drive sources and do not cut over live without separate approval.

## Other open items

- Drive root hygiene `MSG-20260911-0005`: `ACKED / ROOT_EXCEPTION`; safe same-file-ID target was identified but connector write authorization blocked the move. No copy was made.
- npm audit report: 3 high + 1 critical; separate hardening track, no `npm audit fix --force` during this gate.
- stale `01_농가_Master` rows 501-512 cleanup: separate explicit decision.
- same-action p50/p95: `NO_BASELINE` until runnable R2-backed staging path exists.
- live/Public Frontend/main/Production/HOOOO/INDX/IndiaDesk: unchanged.
