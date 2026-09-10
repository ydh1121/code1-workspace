# CODE1 CODING BATON

PLANNING_DELTA_SEQ_SEEN = 20260910-001

LAST_VERIFIED_ACTION: resumed from the CODE1 Supabase STAGING migration boundary, verified project ref `bsintmkyhptizrjoizfb`, applied migrations `0001` through `0006`, closed post-apply service-role/search-path/API-function security findings, re-read the current native Sheet snapshot, prepared the real source import payload, proved that the invited Developer connector SQL session is read-only for DML, verified zero imported rows after that rejected attempt, and added a fail-closed service-role import runner plus tests on the isolated branch.

CURRENT_WORK: CODE1 STAGING schema and security gate are applied on the dedicated CODE1 project. The current live Internal Workspace still uses Apps Script/Sheet/Drive. No dual-write and no live cutover exists. Real source data import is the active next step but requires a writable CODE1-owner/service-role execution context.

VERIFIED_CODE_STATE:
- branch: `coding/runtime-backend-staging`
- base main remains: `a71a71eae73706862308e194110f4fcc2d25db01`
- latest code-bearing import-runner test HEAD verified by CI: `930257c19f9559bcc3d8bf057cdf092cabf06e97`
- GitHub Actions run: `34472709381` / SUCCESS
- later documentation/env-only commits may advance branch HEAD; re-read branch HEAD before the next write.

SUPABASE_STAGING:
- project ref: `bsintmkyhptizrjoizfb`
- region: Seoul (`ap-northeast-2`)
- logical environment: CODE1 STAGING only
- Production: NOT CREATED/NOT CONNECTED by this workstream
- HOOOO refs: excluded and untouched

APPLIED_MIGRATIONS:
1. `code1_0001_runtime` / `20260910101211`
2. `code1_0002_mutations` / `20260910101239`
3. `code1_0003_planning_delta_20260910` / `20260910101312`
4. `code1_0004_preapply_security_hardening` / `20260910101342`
5. `code1_0005_service_role_grants` / `20260910112427`
6. `code1_0006_postapply_security_hardening` / `20260910112904`

POST_APPLY_SECURITY_GATE:
- 20 runtime/planning tables: RLS enabled.
- anon/authenticated: no table SELECT access.
- service_role: required table CRUD present.
- current-answer view: service-role read only, browser roles denied.
- CODE1 RPC/helper EXECUTE: browser roles denied, service-role allowed where required.
- Supabase `rls_auto_enable()` direct API-role EXECUTE removed; event-trigger behavior retained.
- CODE1 function search paths fixed.
- Security Advisor: no remaining WARN; `RLS enabled / no policy` is intentional INFO for server-only authorization.

CURRENT_NATIVE_SOURCE_COUNTS:
- farms 12
- accounts 2
- questions 231
- submissions 2
- answer revisions 5
- commit sentinels 3
- farm media 4, all current status DELETED
- DECK media excluded 2
- media events 5
- access logs 29
- login guard 3
- question policies/history 0/0
- housing-environment records 12, migration state UNCONFIRMED
- planning capabilities/brief versions/planning artifacts 0/0/0

MIGRATION_SEMANTICS:
- preserve explicit blank answer revision `C-02 / revision 2`;
- convert `__COMMIT__` rows to submission current-revision state, never to answers;
- preserve both ORGANIZED and later TRASHED events for the same legacy media;
- do not migrate DECK media into farm runtime media;
- legacy media remain `GOOGLE_DRIVE_LEGACY` with no R2 object key until R2 migration;
- housing code 1 is only an explicit source value, never a default; `미확인`/blank become NULL code and all imported records remain UNCONFIRMED;
- do not auto-grant Planning Delta capabilities.

IMPORT_RUNNER:
- `backend/staging/src/import-runner.mjs`
- `backend/staging/scripts/import-source-to-staging.mjs`
- requires exact project-ref match plus `CODE1_IMPORT_TARGET=STAGING` and `CODE1_IMPORT_CONFIRM_REF` acknowledgement;
- source credential values and service-role secrets must never enter Git/docs/log output.

CURRENT_BLOCKER:
- GPT can inspect CODE1 project and apply managed migrations through the invited Developer account.
- general SQL execution is currently `supabase_read_only_user` and rejected the first INSERT with `cannot execute INSERT in a read-only transaction`.
- rejected DML wrote zero rows; target runtime data remains empty.
- do not misuse schema migrations to embed credential hashes as a workaround.

NEXT_ATOMIC_ACTION:
1. Re-read branch HEAD and this BATON.
2. Establish a writable CODE1-owner/service-role data-import context.
3. Run the prepared source import against `bsintmkyhptizrjoizfb` only.
4. Verify exact row counts, stable IDs, revision history, media deletion/event state, actor mapping, and planning capability count 0.
5. Re-run Security/Performance Advisor and imported-data query checks.
6. Only after DB data gate PASS, verify existing CODE1 R2 bucket/binding and proceed with isolated private-media migration/integration tests.
7. Do not change live/Public Frontend/Production before separately approved cutover.

ROLLBACK: live remains unchanged. Until a future approved cutover, rollback remains “do nothing.” Existing Apps Script/Sheet/Drive runtime is retained as migration source and rollback evidence; long-term dual-write remains prohibited.
