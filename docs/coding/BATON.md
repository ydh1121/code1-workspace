# CODE1 CODING BATON

Updated: 2026-09-12 KST
PLANNING_DELTA_SEQ_SEEN = 20260912-008
CROSS_TRACK_BUS_LAST_SEEN = MSG-20260912-0050

LAST_VERIFIED_ACTION: `WO-20260912-CODING-OPS-001` source-side implementation reached technical acceptance PASS on `coding/runtime-backend-staging`. Supabase STAGING migrations `ops_change_relay_0018` and `ops_change_relay_acceptance_0019` are applied. Cloudflare Pages Preview deployment `3e5b3188ff64f3e788fd88c6eccbac360444fa21` succeeded. Final implementation head `6ad4773365466277319961329757c1df3f33c230` has ordinary staging CI SUCCESS and live read-only OPS Preview smoke SUCCESS. Production/main/live legacy Google mutation remains 0.

CURRENT_WORK: Durable final CODING→PLANNING implementation evidence for `WO-20260912-CODING-OPS-001`. Authenticated OWNER visual/click acceptance of `/ops-relay.html` remains `BLOCKED_USER_APPROVAL`; do not manufacture a login/session or alter credentials for QA.

Primary evidence: `docs/coding/OPS_CHANGE_RELAY_EVIDENCE_20260912.md`.

## OPS Relay closeout state

Implemented backend/domain contract:

- `public.ops_change_events`
- `public.ops_outbox`
- transaction wrappers for account-capability save, empty-farm delete, account archive
- `admin.ops.events`
- `admin.ops.review`
- outbox claim/ack/retry lifecycle
- correlation/causation/idempotency/payload hashes
- safe evidence refs

Canonical event classes:

- `OPS_DATA_ONLY`
- `PLANNING_IMPACT`
- `UIUX_IMPACT`
- `CODING_IMPACT`
- `POLICY_APPROVAL_REQUIRED`
- `INCIDENT`

Transactional DB acceptance PASS proves:

- mutation + event + outbox atomic success
- forced outbox failure full rollback
- idempotent replay and conflicting reuse rejection
- all six classifications
- policy fail-closed
- incident P0
- unsafe evidence fail-closed
- Planning causal child event
- retry and failed-recoverable state
- legal relay lifecycle and illegal transition rejection
- anon/authenticated table/RPC denial

Acceptance cleanup read-back:

```text
ops_change_events=0
ops_outbox=0
synthetic OPS_TEST_FARM rows=0
```

## Temporary Admin

Route: `https://coding-runtime-backend-stagi.code1-workspace.pages.dev/ops-relay.html`

Provides All / Planning / Incident / Failed / Done filters, event detail, entity/action/classification/time, correlation/causation, relay/outbox/retry status, evidence refs, and explicit `기획 검토 필요` action.

That action creates a `PLANNING_IMPACT` child event; it never directly commands UIUX/CODING and does not make temporary Admin the Planning SSOT.

Live read-only smoke PASS:

```text
/ops-relay.html 200
/assets/ops-relay.js 200
/assets/ops-relay.css 200
/api/session configured=true authenticated=false
same-origin admin.ops.events without session -> 401 UNAUTHENTICATED
remote mutation NONE
```

Authenticated OWNER visual/click QA remains a human authorized-session gate.

## CI / deployment

```text
Predeploy UI head ecd5fa3... CI = PASS
Deployment marker 3e5b318... = Cloudflare Pages SUCCESS
Final implementation head 6ad4773... staging CI = PASS
Final implementation head 6ad4773... readonly Preview smoke = PASS
npm audit = PASS
build = PASS
root baseline comparator = PASS
```

## Previous Deck work

`WO-20260912-CODING-DECK-001` is COMPLETE/CLOSED and final evidence was accepted via `MSG-20260912-0048`. Do not rerun Deck migration steps.

## Boundaries

- STAGING only under current OPS WO.
- `main` / Production / Production Supabase / Production R2 mutation = 0.
- legacy Apps Script/Sheet/Drive mutation = 0.
- no Production bridge secret reuse.
- no secret in Git/Drive/Bus/chat/browser bundle.
- Local Orchestrator is a separate ORCHESTRATOR track.

## Planning Delta 20260912-008

Seen and noninterruptive. It does not activate Production or platform-reuse implementation.

Reserved only / NOT_DISPATCHED:

- `WO-20260912-CODING-PRODUCTIONIZATION-001`
- `WO-20260912-PLATFORM-REUSE-001`

## NEXT HANDOFF

1. Fresh reconcile Bus append target.
2. Append consolidated CODING→PLANNING `IMPLEMENTATION_EVIDENCE` for `WO-20260912-CODING-OPS-001`, including exact branch/head, files, migrations, atomicity, six classes, live Preview smoke, retry/idempotency/RBAC/build/audit and mutation=0.
3. Report authenticated OWNER visual QA as `BLOCKED_USER_APPROVAL`, not as a fabricated PASS or technical failure.
4. Fresh-read Planning Bus/Ledger after reporting and continue only an actually DISPATCHED CODING WO.
