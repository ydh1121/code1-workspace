# CODE1 Supabase STAGING Apply Gate — 2026-09-10

Status: SCHEMA_APPLIED / SECURITY_GATE_PASS / DATA_IMPORT_PENDING_WRITE_CAPABILITY
Track: CODING
Branch: `coding/runtime-backend-staging`
Logical environment: CODE1 STAGING only
Supabase project ref: `bsintmkyhptizrjoizfb`
Production/live cutover: NOT APPROVED
Planning delta seen: `20260910-001`

## Applied migration ledger

Applied to the dedicated CODE1 STAGING project only:

1. `code1_0001_runtime` — `20260910101211`
2. `code1_0002_mutations` — `20260910101239`
3. `code1_0003_planning_delta_20260910` — `20260910101312`
4. `code1_0004_preapply_security_hardening` — `20260910101342`
5. `code1_0005_service_role_grants` — `20260910112427`
6. `code1_0006_postapply_security_hardening` — `20260910112904`

No HOOOO, Production, Public Frontend, or current live runtime resource was modified by these database migrations.

## Post-apply findings and closure

With Supabase `Automatically expose new tables` disabled, the first live schema inspection correctly showed no anon/authenticated table access, but also showed that `service_role` did not receive table CRUD grants automatically. `0005_service_role_grants.sql` closed that integration blocker explicitly while keeping browser roles fail-closed.

Supabase Security Advisor then reported mutable `search_path` on CODE1 functions and API EXECUTE exposure of the Supabase-generated `public.rls_auto_enable()` event-trigger function. `0006_postapply_security_hardening.sql` fixes the CODE1 function search paths and removes direct EXECUTE access to `rls_auto_enable()` while leaving the event trigger itself intact.

Current verified state:

- 20 runtime/planning tables have RLS enabled.
- anon/authenticated table SELECT is denied.
- service_role has required CRUD privileges on the 20 runtime/planning tables.
- `submission_answers_current` is service-role readable and browser-role unreadable.
- CODE1 service-boundary mutation RPCs are not executable by anon/authenticated.
- CODE1 service_role can execute required RPCs.
- `code1_fact_transition_allowed` is not a browser RPC.
- Security Advisor has no remaining WARN finding from the applied CODE1 schema. Remaining `RLS enabled / no policy` notices are intentional INFO because browser access is prohibited and the Cloudflare service boundary performs application authorization.

Performance Advisor currently reports FK-index and unused-index INFO. The database is still empty and has not received runtime workload, so those notices are not treated as a correctness blocker. Index changes must be driven by imported-data query plans and measured workload rather than blanket advisor suppression.

## Authoritative source snapshot immediately before data import

Migration source authority is the native Google Sheet / Google Sheets API representation, not the earlier XLSX parser result.

Current normalized source counts:

- farms: 12
- workspace accounts: 2
- active question catalog rows: 231
- submissions: 2
- answer revisions: 5
- commit sentinels represented as submission revision state: 3
- farm runtime media rows: 4
- DECK media excluded from farm runtime cutover: 2
- media history events: 5
- access log rows: 29
- login guard rows: 3
- question policies: 0
- question policy history: 0
- housing-environment source records: 12
- planning capabilities: 0
- planning brief versions: 0
- planning source artifacts: 0

Important deltas from the earlier dry-run fixture:

- All four farm media rows are currently `DELETED`.
- One media item has both `ORGANIZED` and later `TRASHED` history; both append-only events must be retained.
- The explicit blank value at submission answer revision `C-02 / revision 2` is a real revision and must not be dropped.
- Housing-environment values remain `UNCONFIRMED`; explicit source code `1` may be represented as code 1, while `미확인` or blank values remain NULL code. No source value is auto-promoted to VERIFIED.

## Data import runner

The isolated branch now contains a fail-closed import runner:

- `backend/staging/src/import-runner.mjs`
- `backend/staging/scripts/import-source-to-staging.mjs`

It requires the existing exact-project-ref guard plus:

- `CODE1_IMPORT_TARGET=STAGING`
- `CODE1_IMPORT_CONFIRM_REF` exactly equal to `CODE1_STAGING_PROJECT_REF`

The runner performs source normalization, actor identity mapping, explicit-blank preservation, legacy deleted-media timestamp reconstruction, idempotent runtime upserts, append-only source-row deduplication for media/access histories, migration registry updates, and post-write count verification. It does not print source credential material or service-role secrets.

## Current import blocker

The ChatGPT Supabase connection currently reaches this CODE1 project through the invited HOOOO account with Developer access. DDL migration application succeeds through the management migration API, but general SQL execution runs as `supabase_read_only_user` in this connector session.

A first DML import attempt was rejected with `cannot execute INSERT in a read-only transaction`. The transaction wrote zero rows. A subsequent count check confirmed the target runtime tables remain empty.

Do not work around this by embedding account credential hashes into schema migrations. The next data-import action requires a server/service-role write path or a ChatGPT Supabase connection with a writable CODE1-owner context.

## Next atomic action

1. Establish a writable CODE1 STAGING data-import context without exposing service-role secrets in browser/Git/docs.
2. Execute the prepared import runner against `bsintmkyhptizrjoizfb` only.
3. Verify exact counts, stable IDs, revisions, deleted-media status/event history, actor mapping, and zero planning capability auto-grants.
4. Re-run Security/Performance Advisors and query-plan checks on imported data.
5. Only after DB data gate PASS, verify the exact existing CODE1 R2 bucket/binding and proceed to isolated private-media migration/integration tests.

Live/Public Frontend remains unchanged. Production remains prohibited.
