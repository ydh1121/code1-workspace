# CODE1 CODING BATON

Updated: 2026-09-11
PLANNING_DELTA_SEQ_SEEN = 20260910-002
CROSS_TRACK_BUS_LAST_SEEN = MSG-20260911-0006

LAST_VERIFIED_ACTION: CODE1 Supabase STAGING FIRST_IMPORT remains complete and durable counts still match the verified post-import state. The operator successfully ran the fail-closed Cloudflare/R2 read-only inventory using Wrangler `4.129.0`. The verified Cloudflare account contains Pages project `code1-workspace`, but account-level R2 bucket inventory is empty and Pages has no R2 binding. No Cloudflare bucket/binding/object mutation occurred.

CURRENT_WORK: prior `R2_RESOURCE_IDENTITY_BLOCKED` ambiguity is resolved as `R2_ACCOUNT_INVENTORY_EMPTY`. There is no existing bucket to select or reuse. Next resource gate is creation of exactly one CODE1 STAGING-only private R2 bucket, proposed exact name `code1-staging-media`, followed immediately by read-only bucket-detail verification before binding or object writes.

VERIFIED_CODE_STATE:
- branch: `coding/runtime-backend-staging`
- base main: `a71a71eae73706862308e194110f4fcc2d25db01`
- R2 read-only runner Windows compatibility fix: `5f180aaa3c2e6653e771fbd519de1e87e546747c`
- local operator pulled that commit and successfully executed the inventory runner
- local operator working tree after the reported commands is assumed only for those shown commands; unreported local edits remain `UNVERIFIED_LOCAL`

POST_IMPORT_DB_GATE:
- project ref: `bsintmkyhptizrjoizfb`
- target: CODE1 STAGING only
- source SHA-256: `bde8f0671fd59bc125573129db7d4391bf0987380effcb50e91e43019eeb8f5b`
- source bytes: `200458`
- import state: VERIFIED_COMPLETE / do not rerun FIRST_IMPORT
- accounts 2
- farms 12
- questions 231
- submissions 2
- answer versions 5
- media assets 4
- media events 5
- audit log 29
- login guard 3
- housing environment 12
- question policies/history 0/0
- planning capabilities/brief versions/artifacts 0/0/0
- migration registry 268

R2_ACCOUNT_INVENTORY:
- authenticated Cloudflare account id: `7c52434598072e9bce77aa00bafa1ed3`
- Pages project: `code1-workspace`
- Pages domain: `code1-workspace.pages.dev`
- account R2 bucket list: EMPTY / zero bucket rows returned
- downloaded Pages R2 bindings: NONE_FOUND
- repository `wrangler.toml` R2 bindings: NONE
- result: `R2_ACCOUNT_INVENTORY_EMPTY`
- proposed new staging-only bucket: `code1-staging-media`
- runtime binding contract: `CODE1_MEDIA_BUCKET`
- public R2 URL/custom domain: must remain disabled unless separately approved
- external R2 mutation so far: NONE
- other-project R2 reuse: prohibited

SOURCE_MEDIA_MANIFEST:
- private Drive artifact: `CODE1_SOURCE_MEDIA_MANIFEST_20260911`
- parent: `[PRIVATE] CODE1 STAGING MIGRATION`
- source rows: 4 legacy farm media
- Drive originals: 4/4 exist and are private owner-only
- MIME/byte size: 4/4 match Supabase metadata
- actual-byte SHA-256: 4/4 calculated and stored only in private manifest
- DB state: 4/4 `DELETED`, 4/4 `object_key = NULL`, source `GOOGLE_DRIVE_LEGACY`
- R2 migration eligibility: `HOLD_DELETED_RETENTION`
- Drive rollback source deletion: not performed

R2_CONTRACT_BLOCKERS:
1. current high-resolution browser path uses `mediaUpload.begin -> mediaUpload.chunk -> mediaUpload.finish`, but staging dispatch lacks `mediaUpload.chunk`;
2. repeated `mediaUpload.begin` does not yet resolve a logical retry to an existing upload identity;
3. repeated `mediaUpload.finish` can append duplicate `UPLOADED` events;
4. <=8 MiB compatibility upload can orphan an R2 object if DB metadata insert fails after object write;
5. actual R2 PUT/HEAD/private GET/unauthorized-denial/browser tests are WAITING new bucket creation, read-only verification, and binding.

NEW_ISOLATED_TESTS:
- media PUT missing-binding fail closed
- invalid/expired upload auth denial
- exact content-length/MIME enforcement
- exact private object-key write to mock binding
- media GET missing-binding fail closed
- invalid read token denial before object read
- authorized missing object 404
- exact private object read + private response headers

These are mock-binding contract tests only, not actual R2 or browser PASS.

READONLY_CLOUDFLARE_AUDIT_RUNNER:
- path: `backend/staging/scripts/audit-cloudflare-r2-readonly.mjs`
- exact-branch fail closed
- uses repository-local Wrangler CLI entrypoint; Windows `.cmd` direct-execution bug fixed
- no `auth token`, create/delete/set/enable/disable/deploy/object-write command
- first pass verified account/Pages/R2 inventory
- post-create second pass with `--bucket code1-staging-media` reads bucket info, r2.dev, custom domains, CORS, lifecycle, and lock state
- temporary downloaded config is removed after parsing

SOURCE_BOUNDARY:
- private source snapshot remains outside Git in `[PRIVATE] CODE1 STAGING MIGRATION`
- stale `01_농가_Master` rows 501-512 remain unmodified and excluded from the verified snapshot
- DECK media 2 remain excluded from farm runtime
- deleted legacy farm media remain private Drive rollback/retention sources pending policy/technical gate
- housing unknown/blank remains NULL / UNCONFIRMED
- Planning capabilities remain 0

CROSS_TRACK_SYNC:
- `MSG-20260910-0004` APPLIED
- `MSG-20260911-0001` SUPERSEDED
- `MSG-20260911-0002` SUPERSEDED
- `MSG-20260911-0003` CODING -> PLANNING / IMPLEMENTATION_EVIDENCE / PENDING
- `MSG-20260911-0005` PLANNING -> CODING / DRIVE_ROOT_HYGIENE / NEEDS_REVIEW because Drive connector write authorization blocked; no move occurred
- `MSG-20260911-0006` CODING -> PLANNING / R2 IMPLEMENTATION_EVIDENCE / PENDING
- do not duplicate completed FIRST_IMPORT evidence
- publish a new message only after the new bucket/detail verification or later backend implementation produces new evidence, with a fresh collision check

OPEN_WAITING:
- new CODE1 STAGING R2 bucket: NOT_YET_CREATED / proposed `code1-staging-media`
- `CODE1_MEDIA_BUCKET` Pages binding: NOT_YET_CONFIGURED
- media chunk compatibility + retry/compensation hardening: OPEN
- actual R2 integration: WAITING_BUCKET_AND_BINDING
- same-action performance p50/p95: `NO_BASELINE` / WAITING runnable R2-backed staging path
- stale source duplicate cleanup: OPEN_SEPARATE_DECISION
- npm 3 high + 1 critical: OPEN_SEPARATE_HARDENING
- Drive root hygiene: NEEDS_REVIEW / manual same-ID move or file-specific write authorization required
- live cutover: NOT APPROVED
- CODE1 Production: PROHIBITED

NEXT_ATOMIC_ACTION:
1. create exactly one R2 bucket in the verified account, proposed exact name `code1-staging-media`; use default private state and do not upload objects;
2. rerun `node backend/staging/scripts/audit-cloudflare-r2-readonly.mjs --bucket code1-staging-media`;
3. verify exact account/bucket identity, private/public URL state, custom domains, CORS, lifecycle, lock rules, and empty object state;
4. only after that bucket gate passes, add the isolated staging `[[r2_buckets]]` binding with `binding = "CODE1_MEDIA_BUCKET"` and `bucket_name = "code1-staging-media"`;
5. close `mediaUpload.chunk`, begin/finish retry idempotency, and small-upload compensation/reconciliation before actual object integration;
6. run actual staging R2 PUT -> HEAD exact size/MIME -> DB linkage -> private GET plus unauthorized/expired/wrong-scope/deleted denial tests;
7. keep deleted Drive source files as rollback/retention evidence until a separate policy permits purge;
8. do not touch live/Public Frontend/main/Production/other projects.

ROLLBACK: live remains unchanged. Until an approved cutover, existing Apps Script/Sheet/Drive remains the live runtime and source evidence.
