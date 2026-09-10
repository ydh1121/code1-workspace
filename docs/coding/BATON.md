# CODE1 CODING BATON

Updated: 2026-09-11
PLANNING_DELTA_SEQ_SEEN = 20260910-002
CROSS_TRACK_BUS_LAST_SEEN = MSG-20260911-0003

LAST_VERIFIED_ACTION: CODE1 Supabase STAGING FIRST_IMPORT remains complete and was re-read without mutation. Durable counts still match the post-import evidence. R2/private-media READ-ONLY audit then verified the current code/data contract, created a private source-media manifest, and identified the external resource gate and cutover compatibility gaps without changing Cloudflare/live/Production.

CURRENT_WORK: exact CODE1 STAGING R2 bucket/account/binding identity is required before any external R2 mutation. Current result is `R2_RESOURCE_IDENTITY_BLOCKED`. Continue isolated contract hardening only until that identity is verified.

VERIFIED_CODE_STATE:
- branch: `coding/runtime-backend-staging`
- base main: `a71a71eae73706862308e194110f4fcc2d25db01`
- audited origin recovery HEAD: `9066c104a1fbc34f2b597ba9f6df0781d00203ee`
- latest origin at session bootstrap matched that recovery HEAD
- post-import recovery CI: `34503734927` / SUCCESS
- new R2 contract-test/documentation commits are being validated by branch CI
- local operator working tree on the user's PC was not observable from this session and remains `UNVERIFIED_LOCAL`

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

R2_READ_ONLY_AUDIT:
- repository logical binding contract: `CODE1_MEDIA_BUCKET`
- current `wrangler.toml`: no actual `r2_buckets` binding/bucket identity
- Drive architecture docs: target R2 architecture only; no current exact CODE1-only bucket identity
- authenticated Cloudflare account inventory: not available in this session
- result: `R2_RESOURCE_IDENTITY_BLOCKED`
- external R2 mutation: none
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
5. actual R2 PUT/HEAD/private GET/unauthorized-denial/browser tests are still WAITING exact R2 resource identity.

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
- do not duplicate the completed FIRST_IMPORT evidence message
- publish a new message only for new R2/backend evidence after final CI verification and message-id collision check

OPEN_WAITING:
- exact CODE1 R2 identity/binding audit: BLOCKED
- media chunk compatibility + retry/compensation hardening: OPEN
- actual R2 integration: WAITING_R2_IDENTITY
- same-action performance p50/p95: `NO_BASELINE` / WAITING runnable R2-backed staging path
- stale source duplicate cleanup: OPEN_SEPARATE_DECISION
- npm 3 high + 1 critical: OPEN_SEPARATE_HARDENING
- live cutover: NOT APPROVED
- CODE1 Production: PROHIBITED

NEXT_ATOMIC_ACTION:
1. obtain current Cloudflare account-level evidence for the exact CODE1-only R2 bucket and staging Pages/Worker binding;
2. verify bucket privacy/public URL, CORS, lifecycle, object inventory, binding environment, and account/resource identity;
3. only after identity PASS, implement `mediaUpload.chunk` compatibility plus begin/finish retry identity and small-upload compensation/reconciliation;
4. run actual staging R2 PUT/HEAD/private GET/unauthorized denial/DB linkage tests;
5. keep deleted Drive source files as rollback/retention evidence until a separate policy permits purge;
6. do not touch live/Public Frontend/main/Production/other projects.

ROLLBACK: live remains unchanged. Until an approved cutover, existing Apps Script/Sheet/Drive remains the live runtime and source evidence.
