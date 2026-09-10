# CODE1 CODING BATON

Updated: 2026-09-11 04:18 KST
PLANNING_DELTA_SEQ_SEEN = 20260911-003
CROSS_TRACK_BUS_LAST_SEEN = MSG-20260911-0014

LAST_VERIFIED_ACTION: Preview-only R2 binding `CODE1_MEDIA_BUCKET -> code1-staging-media` is VERIFIED from Wrangler's canonical Pages config semantics. Preview runtime remains NOT_CONFIGURED for `SUPABASE_STAGING`. Staging auth is decoupled from live Apps Script `BRIDGE_SECRET`. The Pages deployment exposure parser is now corrected for Wrangler 4.129.0's flattened JSON output and CI-PASS.

CURRENT_WORK: read the actual recent Preview deployment branch names before placing any Supabase service-role or other staging-only secret into the project-wide Pages Preview environment. Configured Preview include/exclude filters are not exposed by the safe Wrangler list commands and remain a separate fail-closed gap.

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

FIRST_IMPORT is VERIFIED_COMPLETE and must not be rerun. Counts remain: accounts 2, farms 12, questions 231, submissions 2, answer versions 5, media 4, media events 5, audit 29, login guard 3, housing 12, migration registry 268.

All imported media remain 4/4 `GOOGLE_DRIVE_LEGACY`, `object_key=NULL`, `DELETED`. Private Drive originals and SHA-256 evidence remain in `CODE1_SOURCE_MEDIA_MANIFEST_20260911`.

Migration `r2_media_upload_state` / ledger `20260910181248` is applied and verified. Security Advisor WARN 0. Performance INFO remains 22 unindexed FKs / 11 unused indexes.

## R2 state

Bucket `code1-staging-media`: APAC / Standard, latest audit 0 objects / 0 B, r2.dev disabled, custom domain none, CORS config absent / code 10059, lock rules none, default multipart abort after 7 days. No actual R2 object write has been run yet.

## Upload runtime state

Hardening commit `a2c65735c5606789c7dfe423a3988229e96b0505`, CI `34512718904` SUCCESS.

Implemented: 6 MiB multipart, begin request idempotency, chunk retry verification, finish retry/object-exists recovery, atomic finalization, small-PUT orphan compensation, exact HEAD size/MIME verification.

External R2 integration/browser PASS: NOT YET RUN.

## Pages binding state

Config deployment commit `0920bfa49afa3a55355b91fc7fe98890d2f59916`; GitHub Actions `34515272730` SUCCESS and Cloudflare Pages Preview deployment SUCCESS.

Repo declaration is Preview-only:

```toml
[env.production]

[[env.preview.r2_buckets]]
binding = "CODE1_MEDIA_BUCKET"
bucket_name = "code1-staging-media"
```

Remote canonical download returned top-level `[[r2_buckets]] CODE1_MEDIA_BUCKET -> code1-staging-media` plus empty `[env.production]`. Wrangler source proves Preview is canonicalized at top-level and Production under `env.production`; R2 is non-inheritable. Therefore Preview R2 binding is VERIFIED and Production R2 binding is NONE.

## Preview runtime state

Read-only branch Preview probe: root 200, session `configured=false`, unauth RPC 400, media route 404, object write NONE. Conclusion: R2 binding exists but `CODE1_RUNTIME_BACKEND=SUPABASE_STAGING` and required Preview vars/secrets are not configured.

## Staging auth separation

Commit `92f19361d7f028005024c5062f918078b6e70329`, CI `34517035790` SUCCESS.

- staging login IP HMAC uses `CODE1_LOGIN_IP_SECRET`
- staging no longer requires Apps Script `BRIDGE_SECRET`
- legacy Apps Script mode still requires and uses `BRIDGE_URL/BRIDGE_SECRET`

Do not inject/reuse Production bridge secrets for staging.

## Preview exposure parser

The operator's prior exposure output showed `deploymentCount=25` but `observedBranches=[]` because the runner expected raw Cloudflare API rows. Wrangler 4.129.0 `pages deployment list --json` actually emits flattened objects with `Id`, `Environment`, `Branch`, `Source`, `Deployment`, `Status`, and `Build`.

Parser fix commit: `7df5d597d9aed3aec67d1b0df5edaa04bbe3ade1`.
CI: `34519391147` SUCCESS.
Pages deployment: skipped via `[CF-Pages-Skip]`.

The runner now:

- reads `Branch` / `Environment` correctly;
- keeps a raw API-like fallback defensively;
- reports `unexpectedPreviewBranches` for any Preview branch other than `coding/runtime-backend-staging`;
- reports `configuredBranchFilter = UNAVAILABLE_VIA_SAFE_WRANGLER_CLI` because safe Pages project/deployment list commands do not expose `preview_branch_includes/excludes`;
- does not use Wrangler debug logging because the full project debug object may contain environment metadata.

## Current security gate

Pages Preview vars/secrets are project-wide across Preview deployments. Repo still contains stale/temporary branches. Before provisioning `CODE1_SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`, `PASSWORD_PEPPER`, `CODE1_LOGIN_IP_SECRET`, `CODE1_UPLOAD_TOKEN_SECRET`, or `CODE1_MEDIA_TOKEN_SECRET`:

1. observe actual recent Preview deployment branches with the corrected runner;
2. block immediately if any unexpected Preview branch is observed;
3. even if only the coding branch is observed, resolve the configured Preview include/exclude filter through a safe authenticated read path or explicit dashboard inspection before service-role secret provisioning.

## Cross-track sync

- MSG-0009: APPLIED
- MSG-0011: APPLIED
- MSG-0014: PENDING at last read
- current CODING inbound: 0

## NEXT_ATOMIC_ACTION

Operator PC:

```powershell
cd C:\Users\Administrator\Desktop\code1
git pull --ff-only origin coding/runtime-backend-staging
node backend/staging/scripts/audit-cloudflare-r2-readonly.mjs --bucket code1-staging-media
```

Do not rerun the Preview HTTP verifier yet; runtime env has not changed.

Expected interpretation:

1. Preview R2 = `CODE1_MEDIA_BUCKET -> code1-staging-media`.
2. Production R2 = `NONE_FOUND`.
3. `PAGES_PREVIEW_DEPLOYMENT_EXPOSURE.observedBranches` is now populated from Wrangler's flattened `Branch` field.
4. `configuredBranchFilter` remains `UNAVAILABLE_VIA_SAFE_WRANGLER_CLI`; that is intentional, not a parser failure.

After exposure/filter gate resolution, provision Preview-only Supabase/runtime vars and newly generated staging-only secrets, intentionally deploy one Preview, rerun read-only HTTP probes, then perform actual R2 PUT/multipart/HEAD/DB/private-GET/denial/retry integration tests.

ROLLBACK: Apps Script/Sheet/Drive remains live. R2 contains no migrated legacy objects and Production has no R2 binding.
