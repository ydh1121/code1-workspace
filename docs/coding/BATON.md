# CODE1 CODING BATON

PLANNING_DELTA_SEQ_SEEN = 20260910-001

LAST_VERIFIED_ACTION: continued the existing isolated branch `coding/runtime-backend-staging`, consumed Planning Delta `20260910-001`, completed the native Sheet migration dry-run review, added the Planning Delta backend contracts, added mandatory pre-apply schema hardening `0004_preapply_security_hardening.sql`, and ran isolated GitHub Actions verification.

CURRENT_WORK: normalized Supabase STAGING runtime schema, mutation RPCs, Planning Delta schema/API, private R2 upload/read authorization contracts, source normalizers, migration verifier, performance benchmark harness, and branch-only CI. Nothing is connected to live runtime or Production.

VERIFIED_AUTOMATION:
- GitHub Actions workflow: `CODE1 runtime backend staging CI`
- Run: `34456909154`
- Code-bearing HEAD tested: `f0505d24ea4eef9aa1823d3cc89adc40819b7f7b`
- `.mjs` syntax checks: PASS
- Node unit/contract tests: 27 PASS / 0 FAIL / 0 SKIP / 0 CANCEL
- This does NOT establish PostgreSQL migration, Supabase integration, R2 integration, live browser, or performance PASS.

PRE_APPLY_SCHEMA_GATE:
- Required order: `0001_runtime.sql` -> `0002_mutations.sql` -> `0003_planning_delta_20260910.sql` -> `0004_preapply_security_hardening.sql`.
- Existing `submission_id` may not move to another `farm_id`.
- Housing-environment VERIFIED state requires evidence and FARM identity consistency.
- Fact Inbox DOCUMENT_RECEIVED/VERIFIED path requires retained evidence.
- Fact Inbox external disclosure is prohibited in this staging schema.
- Browser roles `PUBLIC`, `anon`, and `authenticated` cannot execute the service-boundary mutation RPCs; `service_role` receives explicit execute permission.

PLANNING_DELTA_SCOPE_COMPLETED_IN_ISOLATION:
- housing-environment schema remains extensible for nullable codes 1–4, with no permanent code-1 hard-code;
- Fact Inbox data contract/API exists with ordered verification transitions and append-only event history;
- Executive Brief CURRENT read path consumes only a PUBLISHED snapshot and omits source document IDs from the runtime response;
- planning capabilities are separate from legacy roles and are not auto-granted to SUPER_ADMIN/ADMIN;
- GreatFarm/confidential planning source artifacts have no public-delivery path.

BLOCKED_EXTERNAL_RESOURCES:
- A dedicated CODE1 Supabase STAGING project has not been created/selected in this workstream.
- The migration chain has not been executed against a real PostgreSQL/Supabase target.
- R2 bucket/binding details are not independently verified or approved for this cutover.
- Live Pages deployment revision remains unverified from this environment.

NEXT_ATOMIC_ACTION:
1. Preserve the current isolated branch and no-Production boundary.
2. Before any external change, verify the exact dedicated CODE1 Supabase STAGING project identity/ref.
3. After explicit approval, apply migrations `0001` through `0004` to that CODE1 STAGING project only and capture SQL/apply evidence.
4. Run post-migration count/stable-ID/constraint/RLS/RPC ACL checks before importing any real data.
5. Only after DB gate PASS, proceed to staged data import and R2 object migration/integration tests.
6. Keep live/Public Frontend/consumer 2–4 UI/Premium Membership untouched until separately approved.

ROLLBACK: current live site is unchanged. Until a future approved cutover, rollback remains “do nothing.” At cutover, the existing Apps Script path must remain available behind a reversible backend flag until the new path passes compatibility and performance gates.
