# CODE1 CODING CURRENT

Updated: 2026-09-12 KST
Status: OPS CHANGE RELAY TECHNICAL ACCEPTANCE PASS / PREVIEW DEPLOY PASS / READONLY LIVE SMOKE PASS / OWNER VISUAL QA BLOCKED_USER_APPROVAL
Branch: `coding/runtime-backend-staging`
Implementation head: `6ad4773365466277319961329757c1df3f33c230`
Base main: `a71a71eae73706862308e194110f4fcc2d25db01`
Supabase STAGING: `bsintmkyhptizrjoizfb`
Stable Preview: `https://coding-runtime-backend-stagi.code1-workspace.pages.dev`
Production/main mutation: 0
Live legacy Google mutation: 0
PLANNING_DELTA_SEQ_SEEN = 20260912-008
CROSS_TRACK_BUS_LAST_SEEN = MSG-20260912-0050

## Active work order

`WO-20260912-CODING-OPS-001` — CODE1 OPS CHANGE RELAY v0.1.

Source implementation and technical acceptance are complete. Final CODING→PLANNING implementation evidence is the next durable cross-track action. Authenticated OWNER visual/click acceptance remains an explicit user-session gate and is not fabricated.

Primary evidence: `docs/coding/OPS_CHANGE_RELAY_EVIDENCE_20260912.md`.

## OPS implementation state

Applied Supabase STAGING migrations:

- `0018_ops_change_relay.sql` / migration `ops_change_relay_0018`
- `0019_ops_change_relay_acceptance.sql` / migration `ops_change_relay_acceptance_0019`

Implemented:

- `ops_change_events`
- `ops_outbox`
- transactional mutation + event + outbox wrappers
- six canonical classifications
- correlation / causation / idempotency / payload hash contract
- claim / ack / retry lifecycle
- explicit Planning-review child event
- temporary `/ops-relay.html` Admin surface
- server-only least-privilege boundary

Acceptance PASS covers atomic rollback, idempotency/reuse conflict, six classifications, policy fail-closed, incident P0, unsafe evidence rejection, Planning child event, retry, lifecycle, and browser-role RBAC denial.

Post-acceptance residue:

```text
ops_change_events = 0
ops_outbox = 0
synthetic OPS_TEST_FARM rows = 0
```

## Preview verification

Cloudflare Pages deployment for commit `3e5b3188ff64f3e788fd88c6eccbac360444fa21` = SUCCESS.

Read-only live smoke at implementation head `6ad4773365466277319961329757c1df3f33c230` = SUCCESS:

```text
GET /ops-relay.html = 200
GET /assets/ops-relay.js = 200
GET /assets/ops-relay.css = 200
GET /api/session = configured:true / authenticated:false
POST admin.ops.events without session = 401 UNAUTHENTICATED
remote mutation = NONE
```

Ordinary staging CI at the same head = SUCCESS.

## Honest blocker

`BLOCKED_USER_APPROVAL` only for authenticated OWNER visual/click QA of `/ops-relay.html`.

Do not retrieve/reset/synthesize OWNER credentials or SESSION_SECRET merely to manufacture browser evidence. Database acceptance, UI contract tests, deployment, and live unauthenticated fail-closed smoke are already PASS.

## Deck state

`WO-20260912-CODING-DECK-001` = COMPLETE/CLOSED. Planning accepted final closeout via `MSG-20260912-0048`. Do not rerun Deck copy/import/write/browser work solely to recreate evidence.

## Planning architecture decisions seen

Delta `20260912-008` is noninterruptive to current OPS work.

Reserved, NOT_DISPATCHED:

- `WO-20260912-CODING-PRODUCTIONIZATION-001`
- `WO-20260912-PLATFORM-REUSE-001`

Do not start either reserved WO until Planning explicitly dispatches/activates it.

Future approved topology concept remains:

- staging branch = permanent pre-production
- main = future current-stack Admin Production after separate productionization gate
- Public Frontend = separate Pages project
- Google backend = legacy; no new production dependency

## NEXT_ATOMIC_ACTION

1. Append one consolidated CODING→PLANNING `IMPLEMENTATION_EVIDENCE` Bus report for `WO-20260912-CODING-OPS-001` after fresh target-row reconciliation.
2. State the OWNER visual QA gate honestly as `BLOCKED_USER_APPROVAL`; do not claim technical failure.
3. After report, fresh-read Planning Bus/Ledger and execute only the next already-DISPATCHED CODING work order. Reserved productionization/reuse WOs are not executable yet.
