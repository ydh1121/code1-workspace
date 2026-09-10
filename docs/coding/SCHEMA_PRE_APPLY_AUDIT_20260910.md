# CODE1 STAGING Schema Pre-Apply Audit — 2026-09-10

Status: `STATIC_AUDIT_COMPLETE / POSTGRES_APPLY_NOT_RUN / STAGING_ONLY`
Planning Delta: `20260910-001`
Branch: `coding/runtime-backend-staging`

This audit is limited to the isolated backend branch. No current Public Frontend, live runtime, Production resource, planning SSOT, or UI/UX canonical was changed.

## Migration order

1. `0001_runtime.sql`
2. `0002_mutations.sql`
3. `0003_planning_delta_20260910.sql`
4. `0004_preapply_security_hardening.sql`

`0004` is mandatory before any external CODE1 Supabase STAGING apply. It was added from the pre-apply review rather than silently rewriting earlier migration files.

## Findings closed before external apply

### 1. Stable submission IDs could be reassigned to another farm inside the service-role RPC

The initial `code1_save_submission` accepted the caller-supplied `p_farm_id` on every revision. Because the intended server path uses the Supabase service role, RLS alone is not the security boundary for that RPC.

`0004` replaces the function so an existing `submission_id` keeps its original `farm_id`. A mismatch raises `SUBMISSION_FARM_IMMUTABLE`, and the update statement no longer rewrites `farm_id`.

### 2. Planning verification did not require stored evidence at the database boundary

The Planning Delta state machine prevented transition shortcuts, but the original SQL constraints did not require `evidence_ref` for `housing_environment_records.VERIFIED` or `fact_inbox.VERIFIED/APPROVED_CURRENT`.

`0004` adds evidence constraints. The Fact Inbox transition RPC is replaced so `DOCUMENT_RECEIVED` must carry evidence and later verification cannot proceed without retained evidence. The server adapter now forwards `p_evidence_ref`.

### 3. Planning facts needed a database-level staging prohibition on external disclosure

The API already created facts with `external_disclosure_allowed=false`, but a direct service-role update could otherwise set it true.

`0004` adds `fact_external_disclosure_disabled_staging`, keeping Fact Inbox internal-only until a future separately reviewed migration explicitly changes that policy.

### 4. Public-schema mutation functions retained PostgreSQL default EXECUTE exposure

RLS was enabled and no browser policies were created, but PostgreSQL functions are executable by `PUBLIC` unless ACLs are tightened. The intended architecture is a Cloudflare server-only service-role boundary.

`0004` revokes mutation RPC execution from `PUBLIC`, `anon`, and `authenticated`, and grants it explicitly to `service_role` for the staging migration chain.

### 5. FARM housing-environment identity needed cross-field consistency

`housing_environment_records` permitted a `subject_type='FARM'` row whose `farm_id` and `subject_id` identified different farms.

`0004` adds a constraint requiring a FARM subject to have a non-null `farm_id` equal to `subject_id`.

## Planning Delta checks retained

- Housing-environment category remains nullable and limited to `1..4`; there is no `=1` hard-code.
- Source normalization keeps imported housing-environment values `UNCONFIRMED`; it does not auto-verify category 1 or any other category.
- Fact Inbox retains the ordered state path: `RECEIVED -> USER_REPORTED/PARTNER_REPORTED -> EVIDENCE_REQUESTED -> DOCUMENT_RECEIVED -> VERIFIED -> APPROVED_CURRENT`.
- New planning capabilities remain separate from legacy role names; `SUPER_ADMIN`/`ADMIN` does not automatically imply `EXECUTIVE_BRIEF_VIEW`, `FACT_SUBMIT`, `FACT_VERIFY`, or `FACT_APPROVE_CURRENT`.
- Executive Brief runtime reads only a `PUBLISHED` snapshot and does not expose source document IDs through the read API.
- Planning source artifacts remain private-only; `public_delivery_allowed=true` is prohibited and object keys, when present, must begin with `private/planning/`.

## Automated evidence

GitHub Actions workflow `CODE1 runtime backend staging CI`, run `34456909154`, completed successfully on branch HEAD `f0505d24ea4eef9aa1823d3cc89adc40819b7f7b` at the time of this audit.

The job executed:

- syntax checks for every `.mjs` under `backend/staging/src`, `backend/staging/scripts`, and `backend/staging/test`;
- `node --test backend/staging/test/*.test.mjs`;
- 27 tests passed, 0 failed, 0 skipped, 0 cancelled.

This is a static/unit/contract PASS only. It is not a PostgreSQL migration PASS, Supabase integration PASS, R2 integration PASS, authenticated browser performance PASS, or live cutover PASS.

## Remaining approval boundary

No CODE1 Supabase STAGING project currently exists in this track. Therefore the migration chain has not been executed against a real PostgreSQL/Supabase target.

The next external-resource step is creation or explicit selection of a dedicated CODE1 Supabase STAGING project, followed by applying `0001` through `0004` only to that verified project. That step remains outside the current no-Production/no-external-infra boundary and requires explicit approval before execution.
