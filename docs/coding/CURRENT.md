# CODE1 CODING CURRENT

Updated: 2026-09-11 04:02 KST
Status: PHASE 0 VERIFIED / SUPABASE STAGING FIRST_IMPORT PASS / PRIVATE R2 CREATED / MEDIA SCHEMA 0010 APPLIED / R2 UPLOAD CONTRACT HARDENED / PAGES PREVIEW R2 BINDING VERIFIED / PREVIEW SUPABASE RUNTIME NOT_CONFIGURED / PREVIEW BRANCH EXPOSURE AUDIT NEXT
Branch: `coding/runtime-backend-staging`
Base main: `a71a71eae73706862308e194110f4fcc2d25db01`
Live cutover: NOT APPROVED
Production: PROHIBITED
PLANNING_DELTA_SEQ_SEEN = 20260911-003
CROSS_TRACK_BUS_LAST_SEEN = MSG-20260911-0013

## Hard boundaries

- Work is CODING/STAGING only.
- Do not modify `main`, live Public Frontend, Production Admin, CODE1 Production, HOOOO, INDX, or IndiaDesk resources.
- No force push/history rewrite.
- Existing Apps Script/Sheet/Drive runtime remains rollback/live source until a separate cutover approval.
- Do not rerun Supabase FIRST_IMPORT.
- Do not migrate or delete the four legacy Drive media rows merely because R2 exists.
- No public R2 endpoint, no `r2.dev`, no custom R2 domain, and no browser-visible service-role/R2 credentials.

## Durable Supabase STAGING state

Target ref: `bsintmkyhptizrjoizfb` only.

FIRST_IMPORT remains complete. Verified durable counts:

- accounts 2
- farms 12
- questions 231
- submissions 2
- answer versions 5
- media assets 4
- media events 5
- audit log 29
- login guard 3
- housing records 12
- migration registry 268
- planning/question policy placeholder rows remain 0 as previously verified

All four imported media rows remain `GOOGLE_DRIVE_LEGACY`, `object_key = NULL`, `status = DELETED`. Their private Drive originals remain preserved in `CODE1_SOURCE_MEDIA_MANIFEST_20260911`; no legacy object copy has occurred.

Migration `r2_media_upload_state` / ledger `20260910181248` is applied. Readback previously verified four upload-state columns, actor+request partial unique idempotency index, and service-role-only register/finalize RPCs. Security Advisor WARN remains 0. Performance INFO remains 22 unindexed FKs / 11 unused indexes; no workload-free index cleanup is authorized.

## R2 resource state

Bucket: `code1-staging-media`

Verified state:

- APAC / Standard
- 0 objects / 0 B at latest operator audit
- `r2.dev` disabled
- no custom domain
- no lock rule
- default incomplete multipart abort after 7 days
- CORS configuration does not exist / Cloudflare API code 10059; no CORS policy is required for the current server-side Pages Function binding architecture

No R2 object mutation has occurred yet.

## Media runtime hardening

Commit `a2c65735c5606789c7dfe423a3988229e96b0505`, CI `34512718904` SUCCESS.

Implemented and tested:

- `mediaUpload.begin -> mediaUpload.chunk -> mediaUpload.finish`
- 6 MiB multipart chunks
- actor + request ID begin idempotency
- chunk retry validation using offset + part SHA-256/ETag state
- finish retry/object-exists recovery
- atomic final status/event transition
- small PUT DB failure -> R2 object compensation delete
- final R2 HEAD size/MIME verification before DB finalization

Actual external single/multipart object integration is still NOT RUN.

## Pages Preview R2 binding: VERIFIED PREVIEW-ONLY

Repository config introduced the binding in commit `0920bfa49afa3a55355b91fc7fe98890d2f59916`:

```toml
[env.production]

[[env.preview.r2_buckets]]
binding = "CODE1_MEDIA_BUCKET"
bucket_name = "code1-staging-media"
```

The intentional Preview deployment for that commit succeeded; GitHub Actions `34515272730` and Cloudflare Pages check both passed. Production was not deployed.

Latest operator `wrangler pages download config` returned canonical remote config with:

```toml
[[r2_buckets]]
bucket_name = "code1-staging-media"
binding = "CODE1_MEDIA_BUCKET"

[env.production]
```

This is now interpreted using Wrangler's actual `pages download config` implementation rather than `--env` guesses. Wrangler fetches both `deployment_configs.preview` and `deployment_configs.production`, uses Preview as top-level unless a named `env.preview` is required, and writes Production under `env.production`. R2 bindings are non-inheritable. Therefore the canonical output above means:

- Preview `CODE1_MEDIA_BUCKET -> code1-staging-media`: VERIFIED
- Production R2 binding: NONE

The prior audit attempt that called `pages download config --env preview/production` three times was invalid as an environment discriminator; that command intentionally does not select one environment that way. Audit semantics were corrected in commit `79bf485d64d6c5518b6847418396cc630e05b766`, CI `34517842353` SUCCESS, with `[CF-Pages-Skip]` and no new Pages deployment.

## Preview runtime probe: NOT_CONFIGURED

Read-only probe against the stable branch Preview returned:

- root GET: 200
- `/api/session`: `configured=false`, `authenticated=false`
- unauthenticated bootstrap RPC: 400 `REQUEST_FAILED`
- `/api/staging/media-get` without token: 404
- object writes: none

This proves the Preview deployment currently has the R2 binding but has not yet been configured for `CODE1_RUNTIME_BACKEND=SUPABASE_STAGING` and its required runtime secrets/vars.

## Staging auth secret separation

Commit `92f19361d7f028005024c5062f918078b6e70329`, CI `34517035790` SUCCESS.

Preview Supabase staging no longer needs the Apps Script `BRIDGE_SECRET` for login IP hashing. The staging runtime uses `CODE1_LOGIN_IP_SECRET`; legacy Apps Script mode retains `BRIDGE_SECRET` behavior. `configured()` now requires bridge URL/secret only for `APPS_SCRIPT` mode. This prevents reuse/injection of the live bridge secret just to enable staging.

## Remaining security gate before Preview secrets

Cloudflare Pages Preview configuration is project-wide, not branch-specific. The Git repository still contains additional branches such as `coding/runtime-backend-staging-preflight-tmp` and `tmp-*`. Before putting a Supabase service-role key or other staging secrets into the Preview environment, verify the Pages source branch controls and observed Preview deployments.

The corrected read-only runner now:

1. downloads the canonical remote Pages config once and correctly interprets Preview vs Production R2;
2. lists Preview and Production deployments separately;
3. prints only safe branch-exposure fields: observed branch names, production branch, preview deployment setting, preview include list, preview exclude list;
4. continues to redact account IDs, email, bearer/token/secret-like diagnostics;
5. performs no create/delete/set/deploy/secret/object-write command.

## Cross-track sync

- `MSG-20260911-0009` Planning Delta003: APPLIED
- `MSG-20260911-0011` prior R2 deployment evidence: APPLIED by Planning
- `MSG-20260911-0013` latest CODING -> PLANNING implementation evidence: PENDING at last read
- current CODING inbound at last read: 0

## Next atomic action

On the operator PC:

```powershell
cd C:\Users\Administrator\Desktop\code1
git pull --ff-only origin coding/runtime-backend-staging
node backend/staging/scripts/audit-cloudflare-r2-readonly.mjs --bucket code1-staging-media
```

Required next evidence:

- `PAGES_PREVIEW_R2_BINDINGS_INTERPRETED` = `CODE1_MEDIA_BUCKET / code1-staging-media`
- `PAGES_PRODUCTION_R2_BINDINGS_INTERPRETED` = `NONE_FOUND`
- `PAGES_PREVIEW_DEPLOYMENT_EXPOSURE` shows current preview deployment setting/include/exclude and observed branches
- `PAGES_PRODUCTION_DEPLOYMENT_EXPOSURE` confirms the production branch context

Do not add Preview service-role/session/media/upload/login secrets until branch exposure is reviewed. After that gate, configure Preview-only Supabase staging vars/secrets, deploy one Preview intentionally, rerun the read-only HTTP verifier, and only after PASS run real R2 single/multipart integration tests.

## Other open items

- npm audit report: 3 high + 1 critical; separate dependency hardening, no blind `npm audit fix --force`
- stale source duplicate rows 501-512: separate decision
- same-action p50/p95: no baseline until runnable R2-backed staging exists
- Apps Script Drive root location: reconciled `ROOT_EXCEPTION`; no copy/replacement

ROLLBACK: Apps Script/Sheet/Drive remains the live runtime. R2 has no migrated legacy media and no production binding.
