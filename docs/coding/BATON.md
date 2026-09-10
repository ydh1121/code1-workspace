# CODE1 CODING BATON

Updated: 2026-09-11 04:03 KST
PLANNING_DELTA_SEQ_SEEN = 20260911-003
CROSS_TRACK_BUS_LAST_SEEN = MSG-20260911-0013

LAST_VERIFIED_ACTION: Preview-only R2 binding `CODE1_MEDIA_BUCKET -> code1-staging-media` is now independently interpreted as VERIFIED from Wrangler's canonical Pages config download semantics. The same read-only HTTP probe proves the Preview runtime itself is still NOT_CONFIGURED for `SUPABASE_STAGING`. Staging auth was decoupled from live Apps Script `BRIDGE_SECRET`, and the Cloudflare audit runner was corrected to audit Preview exposure before any staging secret is provisioned.

CURRENT_WORK: verify Cloudflare Pages Preview branch exposure controls before placing the Supabase service-role key or other staging-only secrets into the project-wide Preview environment.

## Fixed boundaries

- branch: `coding/runtime-backend-staging`
- base main: `a71a71eae73706862308e194110f4fcc2d25db01`
- CODE1 Supabase target: STAGING ref `bsintmkyhptizrjoizfb` only
- live cutover: NOT APPROVED
- CODE1 Production: PROHIBITED
- no main/history rewrite/force push
- no public R2 endpoint
- no HOOOO/INDX/IndiaDesk mutation
- no legacy Drive-media auto migration/deletion

## Durable database/import state

FIRST_IMPORT is VERIFIED_COMPLETE and must not be rerun.

Counts remain: accounts 2, farms 12, questions 231, submissions 2, answer versions 5, media 4, media events 5, audit 29, login guard 3, housing 12, migration registry 268.

All imported media remain 4/4 `GOOGLE_DRIVE_LEGACY`, `object_key=NULL`, `DELETED`. Private Drive originals and SHA-256 evidence remain in `CODE1_SOURCE_MEDIA_MANIFEST_20260911`.

Migration `r2_media_upload_state` / ledger `20260910181248` is applied and verified. Security Advisor WARN 0. Performance INFO remains 22 unindexed FKs / 11 unused indexes.

## R2 state

Bucket `code1-staging-media`:

- APAC / Standard
- latest audit: 0 objects / 0 B
- r2.dev disabled
- custom domain none
- CORS config absent / code 10059
- lock rules none
- default multipart abort after 7 days

No actual R2 object write has been run yet.

## Upload runtime state

Hardening commit `a2c65735c5606789c7dfe423a3988229e96b0505`, CI `34512718904` SUCCESS.

Implemented: 6 MiB multipart, begin request idempotency, chunk retry verification, finish retry/object-exists recovery, atomic finalization, small-PUT orphan compensation, exact HEAD size/MIME verification.

External R2 integration/browser PASS: NOT YET RUN.

## Pages binding state

Config deployment commit `0920bfa49afa3a55355b91fc7fe98890d2f59916`; GitHub Actions `34515272730` SUCCESS and Cloudflare Pages Preview deployment SUCCESS.

Repo declaration:

```toml
[env.production]

[[env.preview.r2_buckets]]
binding = "CODE1_MEDIA_BUCKET"
bucket_name = "code1-staging-media"
```

Latest remote canonical download returned top-level `[[r2_buckets]] CODE1_MEDIA_BUCKET -> code1-staging-media` plus empty `[env.production]`.

Wrangler source proves `pages download config` fetches both `deployment_configs.preview` and `.production`, uses Preview as top-level unless `env.preview` must be emitted, and writes Production under `env.production`. R2 is non-inheritable. Therefore:

- Preview R2 binding: VERIFIED
- Production R2 binding: NONE

The earlier three-way `pages download config --env ...` audit was not a valid discriminator. Corrected runner commit: `79bf485d64d6c5518b6847418396cc630e05b766`, CI `34517842353` SUCCESS, Pages skipped.

## Preview runtime state

Read-only branch Preview probe:

- root 200
- session `configured=false`, `authenticated=false`
- unauth RPC 400
- media route 404
- object write NONE

Conclusion: R2 binding exists but `CODE1_RUNTIME_BACKEND=SUPABASE_STAGING` and required Preview vars/secrets are not configured yet.

## Staging auth separation

Commit `92f19361d7f028005024c5062f918078b6e70329`, CI `34517035790` SUCCESS.

- staging login IP HMAC uses new `CODE1_LOGIN_IP_SECRET`
- staging no longer requires Apps Script `BRIDGE_SECRET`
- legacy Apps Script mode still requires and uses `BRIDGE_URL/BRIDGE_SECRET`

Do not inject/reuse Production bridge secrets for staging.

## Current security gate

Cloudflare Pages Preview vars/secrets apply to Preview deployments project-wide, not per branch. Repo still has stale/temporary branches. Before provisioning `CODE1_SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`, `PASSWORD_PEPPER`, `CODE1_LOGIN_IP_SECRET`, `CODE1_UPLOAD_TOKEN_SECRET`, or `CODE1_MEDIA_TOKEN_SECRET`, read the Pages preview branch controls.

The updated runner now prints:

- canonical remote Pages safe config
- interpreted Preview R2 bindings
- interpreted Production R2 bindings
- `PAGES_PREVIEW_DEPLOYMENT_EXPOSURE`
- `PAGES_PRODUCTION_DEPLOYMENT_EXPOSURE`

Exposure output includes only safe source-control fields: observed branch names, production branch, preview deployment setting, preview branch includes/excludes.

## Cross-track sync

- MSG-0009: APPLIED
- MSG-0011: APPLIED
- MSG-0013: PENDING at last read
- current CODING inbound: 0

## NEXT_ATOMIC_ACTION

Operator PC:

```powershell
cd C:\Users\Administrator\Desktop\code1
git pull --ff-only origin coding/runtime-backend-staging
node backend/staging/scripts/audit-cloudflare-r2-readonly.mjs --bucket code1-staging-media
```

Do not rerun the Preview HTTP verifier yet; runtime env has not changed.

PASS requirements before any secret mutation:

1. Preview interpreted R2 = `CODE1_MEDIA_BUCKET -> code1-staging-media`.
2. Production interpreted R2 = `NONE_FOUND`.
3. Preview deployment exposure is restricted enough that staging secrets will not be delivered to unintended stale/tmp branch deployments.
4. Production branch context remains `main` and unchanged.

After that, provision Preview-only Supabase/runtime vars and newly generated staging-only secrets, intentionally deploy one Preview, rerun read-only HTTP probes, then perform actual R2 PUT/multipart/HEAD/DB/private-GET/denial/retry integration tests.

ROLLBACK: Apps Script/Sheet/Drive remains live. R2 contains no migrated legacy objects and Production has no R2 binding.
