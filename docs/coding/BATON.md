# CODE1 CODING BATON

Updated: 2026-09-11
PLANNING_DELTA_SEQ_SEEN = 20260911-003
CROSS_TRACK_BUS_LAST_SEEN = MSG-20260911-0010

LAST_VERIFIED_ACTION: CODE1 Supabase STAGING FIRST_IMPORT remains complete. Private R2 bucket `code1-staging-media` is created/empty/private, media schema migration `r2_media_upload_state` is applied and read back, and upload runtime hardening is CI-PASS. The pre-binding Pages SAFE audit showed only root config plus empty `[env.production]`. Preview-only R2 config was then committed at `0920bfa49afa3a55355b91fc7fe98890d2f59916`; GitHub Actions run `34515272730` and Cloudflare Pages Preview deployment both completed SUCCESS. Production was not deployed.

CURRENT_WORK: independently read back the deployed Preview binding and probe the stable branch Preview without authentication or object writes. Do not claim R2 integration PASS until remote config + runtime probes pass.

PLANNING_DELTA_003:
- `code1-staging-media` + `CODE1_MEDIA_BUCKET` accepted as `ISOLATED_STAGING_TECHNICAL_CANDIDATE`
- no public R2 endpoint, no other-project resource reuse, no live/main/Production impact
- no automatic migration of the four legacy Drive media rows
- Apps Script root-hygiene reconciled as `ROOT_EXCEPTION / MOVE_BLOCKED_BY_FILE_AUTHORIZATION`

VERIFIED_CODE_STATE:
- branch: `coding/runtime-backend-staging`
- base main: `a71a71eae73706862308e194110f4fcc2d25db01`
- R2 upload hardening: `a2c65735c5606789c7dfe423a3988229e96b0505`
- R2 hardening CI: `34512718904` / SUCCESS
- Preview R2 config deployment commit: `0920bfa49afa3a55355b91fc7fe98890d2f59916`
- Preview deployment CI: `34515272730` / SUCCESS
- Cloudflare Pages check at `0920bfa...`: SUCCESS / Preview deployed
- audit diagnostic redaction: `794a535a3b9e67d6d9f3dfbdd9fb013659a5f22f` / CI `34515383539` SUCCESS / Pages skipped
- read-only Preview HTTP verifier: `8efe534bda3c86f8c48ede4a98af0cde7b98519e` / CI SUCCESS / Pages skipped

POST_IMPORT_DB_GATE:
- Supabase target: CODE1 STAGING `bsintmkyhptizrjoizfb` only
- FIRST_IMPORT: VERIFIED_COMPLETE / do not rerun
- accounts 2; farms 12; questions 231; submissions 2; answer versions 5
- media assets 4; media events 5; audit log 29; login guard 3; housing 12
- migration registry 268
- question policies/history 0/0; planning capabilities/brief/artifacts 0/0/0

R2_BUCKET_GATE:
- `code1-staging-media`: CREATED / APAC / Standard
- post-create inventory: 0 objects / 0 B
- r2.dev: disabled
- custom domains: none
- lock rules: none
- lifecycle: default abort incomplete multipart uploads after 7 days
- CORS: configuration does not exist / API code 10059; not required for current server-side binding architecture
- deleted Drive legacy source migration: NOT PERFORMED

R2_MEDIA_SCHEMA_0010:
- repository file: `backend/staging/schema/0010_r2_media_upload_state.sql`
- applied migration: `r2_media_upload_state`
- ledger version: `20260910181248`
- four R2 upload-state columns + partial unique actor/request index present
- finalization/registration RPCs: service_role execute true; anon/authenticated false
- post-apply media: total 4 / DELETED 4 / R2_PRIVATE 0

R2_UPLOAD_RUNTIME:
- module: `backend/staging/src/media-upload-runtime.mjs`
- dispatch: FARM upload + `mediaUpload.begin/chunk/finish`
- multipart chunk: 6 MiB
- begin retry: actor + request ID idempotency
- chunk retry: offset + per-part SHA-256/ETag verification
- finish retry: object-exists recovery + atomic final status/event
- small PUT DB failure: R2 object compensation delete
- finalization: R2 HEAD exact size and MIME mismatch fail closed

PAGES_PREVIEW_CONFIG:
- repo `wrangler.toml` now contains no top-level R2 binding and no Production R2 binding
- exact declaration is `[[env.preview.r2_buckets]] binding = "CODE1_MEDIA_BUCKET" bucket_name = "code1-staging-media"`
- Pages environment overrides are Preview/Production; this Preview binding applies to Preview deployments project-wide, not only one branch
- intentional Cloudflare Pages Preview deployment at `0920bfa...`: SUCCESS
- remote binding readback after deployment: WAITING
- Production deployment: NONE
- object write caused by config deployment: NONE

READ_ONLY_VERIFICATION:
- Cloudflare inventory/config runner: `backend/staging/scripts/audit-cloudflare-r2-readonly.mjs`
- runner now redacts account-path IDs/emails/bearer/token-secret-key-looking values from allowed-command diagnostics
- Preview HTTP verifier: `backend/staging/scripts/verify-pages-preview-readonly.mjs`
- production hostname is rejected by verifier
- session probe must be configured=true/authenticated=false before login
- unauthenticated bootstrap POST must return 401 UNAUTHENTICATED; 403 means Preview APP_ORIGIN mismatch
- `/api/staging/media-get` without token: 404 = runtime still Apps Script; 503 = R2 binding missing; 403 = staging media path sees binding and token denial works
- all of the above are no-object-write probes

LAST_ATTEMPTED_BUT_UNVERIFIED:
- `CODE1_MEDIA_BUCKET` Preview config is deployed but not independently read back from the remote Pages config yet
- `CODE1_RUNTIME_BACKEND=SUPABASE_STAGING` on Preview is not yet proven
- Preview APP_ORIGIN compatibility is not yet proven
- actual external R2 PUT/multipart/HEAD/private GET and browser integration: NOT RUN

SECURITY_PERFORMANCE:
- Security Advisor after 0010: WARN 0; existing `rls_enabled_no_policy` INFO 20
- Performance Advisor: unindexed FKs 22; unused indexes 11
- no workload-free index tuning

SOURCE_MEDIA_MANIFEST:
- private Drive manifest `CODE1_SOURCE_MEDIA_MANIFEST_20260911`
- 4/4 legacy farm media originals exist privately and match DB MIME/size; SHA-256 stored only in private manifest
- 4/4 DB status DELETED, object_key NULL, source GOOGLE_DRIVE_LEGACY
- eligibility `HOLD_DELETED_RETENTION`
- do not copy/delete them because R2 exists

CROSS_TRACK_SYNC:
- `MSG-20260911-0003`: APPLIED
- `MSG-20260911-0005`: ACKED / ROOT_EXCEPTION
- `MSG-20260911-0006`: SUPERSEDED
- `MSG-20260911-0007`: APPLIED
- `MSG-20260911-0009`: APPLIED
- `MSG-20260911-0010`: PENDING
- last verified sync: inbound 0 / outbound 1

OPEN_WAITING:
- remote Preview R2 binding readback: WAITING_OPERATOR_READONLY
- Preview runtime mode / APP_ORIGIN probe: WAITING_OPERATOR_READONLY
- actual R2 integration/security test: WAITING_READONLY_PREVIEW_PASS
- same-action p50/p95: NO_BASELINE
- npm 3 high + 1 critical: OPEN_SEPARATE_HARDENING
- stale source duplicate rows 501-512: OPEN_SEPARATE_DECISION
- live cutover: NOT APPROVED
- CODE1 Production: PROHIBITED

NEXT_ATOMIC_ACTION:
1. pull current `coding/runtime-backend-staging`;
2. run `node backend/staging/scripts/audit-cloudflare-r2-readonly.mjs --bucket code1-staging-media`;
3. verify downloaded Pages config shows exact `env.preview` R2 binding and no Production binding;
4. run `node backend/staging/scripts/verify-pages-preview-readonly.mjs --base-url https://coding-runtime-backend-stagi.code1-workspace.pages.dev`;
5. require configured session surface + 401 unauth RPC + 403 media binding probe before any object write;
6. only after that run real single/multipart R2 integration and authenticated private GET/denial/retry tests;
7. update CURRENT/BATON/Message Bus with independent evidence; no live/main/Production cutover.

ROLLBACK: existing Apps Script/Sheet/Drive remains the live runtime. The new R2 bucket contains no migrated legacy media and the current Preview work introduces no Production dependency.
