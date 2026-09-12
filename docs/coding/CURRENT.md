# CODE1 CODING CURRENT

Updated: 2026-09-12 KST
Status: OWNER QA FIXTURE CAPABILITY DEPLOYED / LIVE READONLY PASS / AUTHENTICATED OWNER CLICK QA READY
Branch: `coding/runtime-backend-staging`
OPS base implementation head: `6ad4773365466277319961329757c1df3f33c230`
OWNER QA capability source head: `59dc7fa33ebdd8fbe76c229a6985a776dbe3e7a8`
OWNER QA deployment marker: `b7c949ba6999ee8e37da4ce33f443fe8b59a6f6d`
Live smoke head: `d31d5bd7f1ca110985795e46e189c40707bc5d63`
Base main: `a71a71eae73706862308e194110f4fcc2d25db01`
Supabase STAGING: `bsintmkyhptizrjoizfb`
Stable Preview: `https://coding-runtime-backend-stagi.code1-workspace.pages.dev`
Production/main mutation: 0
Live legacy Google mutation: 0
PLANNING_DELTA_SEQ_SEEN = 20260912-008
CROSS_TRACK_BUS_LAST_SEEN = MSG-20260912-0059
LAST_PLANNING_INBOUND_CONSUMED = MSG-20260912-0059

## Active work orders

Parent: `WO-20260912-CODING-OPS-001` — CODE1 OPS CHANGE RELAY v0.1 — technical checkpoint accepted, final OWNER visual/click closure still pending.

Current dispatched child: `WO-20260912-CODING-OPS-QA-001` — narrow fixed-template OWNER QA fixture capability, dispatched by Planning `MSG-20260912-0059` to resolve prior blocker `MSG-20260912-0058`.

## Implemented under MSG-0059

No new DB migration or privilege widening was required. The existing server-side service-role OPS contract is reused behind the current same-origin/session/OWNER boundary.

New fixed actions:

- `admin.ops.qa.fixture.create`
- `admin.ops.qa.fixture.cleanup`

Contract:

- SUPABASE_STAGING only; non-STAGING hard-fails before legacy bridge fallback
- authenticated OWNER/SUPER_ADMIN only
- browser supplies no arbitrary fixture payload
- fixed synthetic namespace `OWNER_QA_FIXTURE / WO-20260912-CODING-OPS-QA-001`
- fixed PII-free evidence refs
- `code1_ops_record_manual_event` creates the root with `OPS_DATA_ONLY` and `mutationApplied:false`
- deterministic root request ID makes create idempotent / max one active root
- QA root `기획 검토 필요` uses existing canonical `code1_ops_request_planning_review`
- deterministic review request ID makes repeated review clicks idempotent
- review child is `PLANNING_IMPACT` only, with correlation preserved and causation=root event ID
- cleanup validates exact synthetic root/review lineage; unexpected namespace rows fail closed before delete
- cleanup removes only the fixed lineage; existing FK cascade removes its outbox rows
- no real farm/account/business entity mutation
- no direct UIUX/CODING worker command and no fake DONE

Temporary `/ops-relay.html` now exposes only `QA 이벤트 준비` and `QA 이벤트 정리` as fixed controls; there is no free-form input/debug surface.

## Verification

Complete staging CI is PASS after a negative-test fixture correction. Final validated source and deployment marker passed syntax, unit/contract tests, npm audit, root baseline comparator and workspace build.

Stable Preview read-only smoke run `34676193695`, job `103506377060` = PASS:

```text
GET /ops-relay.html = 200
GET /assets/ops-relay.js = 200
GET /assets/ops-relay.css = 200
GET /api/session = configured:true / authenticated:false
POST admin.ops.events without session = 401 UNAUTHENTICATED
POST admin.ops.qa.fixture.create without session = 401 UNAUTHENTICATED
POST admin.ops.qa.fixture.cleanup without session = 401 UNAUTHENTICATED
remote mutation = NONE
```

Post-deploy/pre-user-QA read-only Supabase readback:

```text
ops_change_events = 0
ops_outbox = 0
OWNER_QA_FIXTURE residue = 0
```

Primary child-WO evidence: `docs/coding/OPS_OWNER_QA_FIXTURE_DEPLOY_20260912.md`.

## Remaining OWNER QA closure gate

CODING does not possess or synthesize the user's authorized OWNER browser session. Therefore authenticated click PASS is not claimed.

In the existing authorized OWNER browser session:

1. Refresh `/ops-relay.html`.
2. Click `QA 이벤트 준비`.
3. Select `OWNER_QA_FIXTURE · WO-20260912-CODING-OPS-QA-001`.
4. Verify event detail, correlation and outbox state; source must be synthetic `OPS_DATA_ONLY` and not DONE.
5. Click `기획 검토 필요`.
6. Verify exactly one causal `PLANNING_IMPACT` child; correlation preserved, causation=root ID, no direct UIUX/CODING command, no fake DONE.
7. After screenshot/confirmation, click `QA 이벤트 정리`.
8. CODING must independently read back QA event/outbox residue=0 and report final acceptance to Planning.

Parent OPS WO remains NOT CLOSED until that sequence is completed and Planning accepts the final evidence.

## Reserved work — NOT DISPATCHED

- `WO-20260912-CODING-PRODUCTIONIZATION-001`
- `WO-20260912-PLATFORM-REUSE-001`

No Production/main/Production Supabase/Production R2/live legacy Google mutation is authorized.

## NEXT_ATOMIC_ACTION

1. Publish child-WO implementation/live-smoke evidence to Planning after fresh Bus reconciliation.
2. Update CODING TRACK_STATE only after Bus readback.
3. Await/collect the user's authenticated OWNER click QA; do not fabricate it.
4. After the user clicks cleanup, independently verify QA event/outbox residue=0.
5. Do not self-start Productionization or Platform Reuse.
