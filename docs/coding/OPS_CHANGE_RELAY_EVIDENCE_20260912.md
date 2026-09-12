# CODE1 OPS CHANGE RELAY — IMPLEMENTATION EVIDENCE 2026-09-12

Work Order: `WO-20260912-CODING-OPS-001`
Track: CODING
Scope: STAGING ONLY
Implementation head before durable-doc sync: `6ad4773365466277319961329757c1df3f33c230`
Branch: `coding/runtime-backend-staging`
Supabase STAGING: `bsintmkyhptizrjoizfb`
Stable Preview: `https://coding-runtime-backend-stagi.code1-workspace.pages.dev`

## Verdict

Source-side OPS Change Relay implementation, database transactional acceptance, CI/build/security checks, Preview deployment, and live read-only HTTP smoke are PASS.

Authenticated OWNER visual/click acceptance of `/ops-relay.html` is not claimed: no existing credential/session was read, reset, synthesized, or exposed merely to create QA evidence. That final visual interaction gate remains `BLOCKED_USER_APPROVAL` unless separately exercised with a real authorized OWNER session.

Production/main/live legacy mutation = 0.

## Prior Deck closeout

`WO-20260912-CODING-DECK-001` is already CLOSED/COMPLETE by Planning via `MSG-20260912-0048`. No Deck copy/import/write/browser action was rerun for this OPS work.

## Changed files from OPS baseline `825475e9...`

- `.github/workflows/coding-ops-relay-preview-smoke.yml`
- `backend/staging/schema/0018_ops_change_relay.sql`
- `backend/staging/schema/0019_ops_change_relay_acceptance.sql`
- `backend/staging/scripts/verify-ops-relay-preview-readonly.mjs`
- `backend/staging/src/ops-change-relay.mjs`
- `backend/staging/src/staging-dispatch.mjs`
- `backend/staging/test/ops-change-relay-interface.test.mjs`
- `backend/staging/test/ops-change-relay-routing.test.mjs`
- `backend/staging/test/ops-change-relay-schema.test.mjs`
- `backend/staging/test/ops-change-relay.test.mjs`
- `docs/coding/OPS_CHANGE_RELAY_PREVIEW_DEPLOY_20260912.md`
- `functions/api/rpc.js`
- `public/ops-relay.html`
- `public/assets/ops-relay.js`
- `public/assets/ops-relay.css`

## Database contract

Applied STAGING migrations:

- `ops_change_relay_0018` / repo `0018_ops_change_relay.sql`
- `ops_change_relay_acceptance_0019` / repo `0019_ops_change_relay_acceptance.sql`

Additive source contract:

- `public.ops_change_events`
- `public.ops_outbox`
- service-boundary `code1_ops_*` functions
- transaction wrappers around existing account-capability, empty-farm-delete, and account-archive mutations
- explicit Planning-review child-event RPC
- claim/ack/retry and relay lifecycle RPCs

Entity mutation + OPS event + outbox creation occur in one PostgreSQL transaction/RPC boundary. Browser code does not issue a second event-save request.

## Event classes

Acceptance covers all canonical classes:

1. `OPS_DATA_ONLY`
2. `PLANNING_IMPACT`
3. `UIUX_IMPACT`
4. `CODING_IMPACT`
5. `POLICY_APPROVAL_REQUIRED`
6. `INCIDENT`

`OPS_DATA_ONLY` resolves to `NO_PLANNING_ACTION` / outbox `NO_ACTION`; planning-relevant classes enqueue `PENDING`; policy approval is fail-closed; incidents are P0.

## Transactional acceptance

`0019_ops_change_relay_acceptance.sql` executed successfully in Supabase STAGING and asserted:

- entity + event + outbox atomic commit
- forced outbox failure rolls entity/event/outbox back together
- entity failure produces no event leakage
- idempotent replay returns the same event
- reused idempotency key with different payload is rejected
- six classification samples
- policy fail-closed with mutationApplied=false
- incident P0
- unsafe evidence reference rejection
- Planning child event preserves correlation/causation and receives PENDING outbox
- claim/retry -> FAILED_RETRYABLE / FAILED_RECOVERABLE
- valid lifecycle `RECORDED -> PLANNING_REVIEW -> APPLIED_TO_SSOT -> DISPATCHED -> IN_PROGRESS -> DONE`
- illegal terminal transition rejection
- table/RPC browser-role RBAC denial

Post-acceptance read-back:

```text
ops_change_events = 0
ops_outbox = 0
synthetic OPS_TEST_FARM rows = 0
```

No synthetic acceptance business/event rows remain.

## Least privilege / security

Read-back after 0018:

- RLS enabled on both OPS tables
- `anon` SELECT = false
- `authenticated` SELECT = false
- `service_role` SELECT = true
- `anon/authenticated` EXECUTE on `code1_ops_*` = false
- `service_role` EXECUTE = true
- browser bundle contains no service-role/R2/bridge secret material
- unsafe signed/token-like evidence refs fail closed

Supabase advisor reports the existing service-boundary pattern `RLS enabled / no browser policy` as INFO; this is intentional because browser roles have no table/function access and Cloudflare is the privileged server boundary.

## Temporary Admin UI

Preview route: `/ops-relay.html`

Includes:

- All / Planning needed / Incident / Failed / Done filters
- entity / action / classification / occurrence time
- correlation / causation
- relay status
- outbox state / attempts / safe error code
- evidence refs
- event detail
- explicit `기획 검토 필요` action -> `admin.ops.review`

The button creates a `PLANNING_IMPACT` event. It does not directly issue UIUX/CODING commands and does not make the temporary Admin a Planning SSOT.

## CI / build / deploy

Predeploy implementation/UI head `ecd5fa3fe4699b671977612c92d661fdd70cc52e`:

- syntax PASS
- PowerShell parse PASS
- staging unit/contract tests PASS
- locked npm audit PASS
- root baseline comparator PASS
- build PASS

Preview deployment marker: `3e5b3188ff64f3e788fd88c6eccbac360444fa21`

Cloudflare Pages result: SUCCESS.

- atomic Preview: `https://0b099d98.code1-workspace.pages.dev`
- branch Preview: `https://coding-runtime-backend-stagi.code1-workspace.pages.dev`

Final read-only smoke head `6ad4773365466277319961329757c1df3f33c230`:

- ordinary staging CI SUCCESS
- `/ops-relay.html` -> 200
- `/assets/ops-relay.js` -> 200
- `/assets/ops-relay.css` -> 200
- `/api/session` -> configured=true / authenticated=false
- same-origin POST `admin.ops.events` without session -> 401 `UNAUTHENTICATED`
- remote mutation = NONE

The first smoke attempt against the atomic URL intentionally rejected an unexpected redirect because the verifier used `redirect:error`; the verifier was corrected to use the authoritative branch `APP_ORIGIN` and same-origin redirect checks. Second run PASS. This was a verifier defect, not an application failure.

## Honest relay state

A real external Orchestrator consumer is not assumed connected by CODING. Events therefore remain at their actual recorded/pending status until a real consumer claims/acks them. The UI/backend never fabricate `DONE`.

## Mutation audit

```text
Production/main mutation = 0
Production Supabase/R2 mutation = 0
live Apps Script/Sheet/Drive mutation = 0
legacy bridge credential copy = 0
FIRST_IMPORT rerun = 0
R2 object mutation for OPS = 0
acceptance synthetic residue = 0
```

## Remaining gate

`BLOCKED_USER_APPROVAL`: authenticated OWNER visual/click acceptance of the temporary `/ops-relay.html` surface. This is intentionally separated from the technical/database/live-read-only acceptance above; no credential is reset or extracted just to automate the visual check.
