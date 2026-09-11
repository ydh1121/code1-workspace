# CODE1 CODING CURRENT

Updated: 2026-09-12 02:51 KST
Status: PHASE 0 VERIFIED / SUPABASE STAGING FIRST_IMPORT PASS / PRIVATE R2 CREATED / MEDIA SCHEMA 0010 APPLIED / R2 UPLOAD CONTRACT HARDENED / PAGES PREVIEW R2 BINDING VERIFIED / PREVIEW BRANCH FILTER EXACT PASS / PREVIEW SUPABASE RUNTIME NOT_CONFIGURED / PREVIEW ENV INVENTORY NEXT
Branch: `coding/runtime-backend-staging`
Base main: `a71a71eae73706862308e194110f4fcc2d25db01`
Live cutover: NOT APPROVED
Production: PROHIBITED
PLANNING_DELTA_SEQ_SEEN = 20260911-003
CROSS_TRACK_BUS_LAST_SEEN = MSG-20260912-0016

## Hard boundaries

- Work is CODING/STAGING only.
- Do not modify `main`, live Public Frontend, Production Admin, CODE1 Production, HOOOO, INDX, IndiaDesk, Planning SSOT, or UIUX SSOT.
- No force push/history rewrite.
- Existing Apps Script/Sheet/Drive remains the live rollback source until separate cutover approval.
- Do not rerun Supabase FIRST_IMPORT.
- Do not migrate/delete the four legacy Drive media rows merely because R2 exists.
- No public R2 endpoint, `r2.dev`, custom R2 domain, or browser-visible credentials.
- Production variables/secrets/bindings are READ_ONLY and must not be copied into Preview by assumption.

## Durable staging state

Supabase STAGING target ref: `bsintmkyhptizrjoizfb` only. FIRST_IMPORT remains VERIFIED_COMPLETE and must not be rerun. Verified counts remain accounts 2, farms 12, questions 231, submissions 2, answer versions 5, media 4, media events 5, audit 29, login guard 3, housing 12, migration registry 268.

All imported media remain 4/4 `GOOGLE_DRIVE_LEGACY`, `object_key=NULL`, `DELETED`; private Drive originals remain preserved and no legacy R2 migration has occurred. Migration `r2_media_upload_state` / ledger `20260910181248` remains applied and verified.

Bucket `code1-staging-media` remains APAC / Standard, 0 objects / 0 B, `r2.dev` disabled, no custom domain, no lock rule, default multipart abort after 7 days. CORS configuration is absent / API code 10059. No R2 object write has occurred.

Upload runtime hardening commit `a2c65735c5606789c7dfe423a3988229e96b0505`, CI `34512718904` SUCCESS. Begin/chunk/finish, 6 MiB multipart, idempotency/retry/finalize, orphan compensation, and HEAD size/MIME verification are implemented. External R2 integration is still NOT RUN.

## Pages binding/runtime state

Preview R2 binding `CODE1_MEDIA_BUCKET -> code1-staging-media`: VERIFIED. Production R2 binding: NONE. Preview runtime is still NOT_CONFIGURED for `SUPABASE_STAGING`; the last read-only probe returned root 200, session `configured=false`, unauth RPC 400, media route 404, and no object write.

The staging runtime environment contract includes `APP_ORIGIN`, `SESSION_SECRET`, `CODE1_RUNTIME_BACKEND=SUPABASE_STAGING`, `CODE1_STAGING_PROJECT_REF`, `CODE1_SUPABASE_URL`, `CODE1_SUPABASE_SERVICE_ROLE_KEY`, `CODE1_LOGIN_IP_SECRET`, `CODE1_UPLOAD_TOKEN_SECRET`, and `CODE1_MEDIA_TOKEN_SECRET`. Password/Google/legacy bridge settings must be reconciled from actual Preview inventory before any mutation; do not reuse Production/live values by assumption.

## Preview branch-control gate: PASS

Read-only audit evidence before the Dashboard change:

- Preview recent deployments 25/25: only `coding/runtime-backend-staging`
- unexpected Preview branches: none
- Production recent deployments 25/25: only `main`
- Preview R2 binding: VERIFIED
- Production R2 binding: NONE
- R2 object count / size: 0 / 0 B

Cloudflare Dashboard initially showed Preview branch policy `All non-Production branches`, which correctly kept secret provisioning BLOCKED.

On 2026-09-12 the operator changed only Pages Branch control and saved it. The panel was reopened and visually verified as:

```text
productionBranch = main
previewDeploymentSetting = custom
previewBranchIncludes = ["coding/runtime-backend-staging"]
previewBranchExcludes = []
```

Therefore:

`exposureGate = PASS_CONFIGURED_PREVIEW_BRANCH_EXACT`

No variable, secret, R2 object, Production binding, or runtime-mode mutation was performed as part of this gate closure.

## Cross-track sync

- `MSG-20260911-0009`: APPLIED
- `MSG-20260911-0011`: APPLIED by Planning
- `MSG-20260911-0015`: SUPERSEDED
- `MSG-20260912-0016`: PENDING outbound; superseding checkpoint to be published for exact branch-control PASS
- current CODING inbound: 0

## NEXT_ATOMIC_ACTION

Perform a READ-ONLY inventory of the Cloudflare Pages **Preview** environment before provisioning anything:

1. In `code1-workspace -> Settings`, change `Choose Environment` from Production to Preview.
2. Inspect `Variables and secrets`: capture names/types only; do not reveal, edit, delete, or add values.
3. Inspect `Bindings`: confirm `CODE1_MEDIA_BUCKET -> code1-staging-media` and note any other Preview bindings.
4. If a Preview origin/branch deployment identifier is visible, capture it without changing configuration.
5. Do not rerun `verify-pages-preview-readonly.mjs` yet; runtime env has not changed.

After inventory reconciliation, define the exact Preview-only mutation set. Only then provision the minimum staging vars/new staging-only secrets, intentionally deploy one Preview, rerun read-only HTTP probes, and after PASS perform actual R2 single/multipart/HEAD/DB/private-GET/denial/retry integration tests.

## Other open items

- npm audit: 3 high + 1 critical; separate dependency hardening, no blind `npm audit fix --force`
- stale source duplicate rows 501-512: separate decision
- same-action p50/p95: wait for runnable R2-backed staging
- Apps Script Drive root: `ROOT_EXCEPTION`; no copy/replacement

ROLLBACK: Apps Script/Sheet/Drive remains live. R2 contains no migrated legacy objects and Production has no R2 binding.
