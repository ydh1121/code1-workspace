# CODE1 CODING BATON

Updated: 2026-09-12 KST
PLANNING_DELTA_SEQ_SEEN = 20260912-008
CROSS_TRACK_BUS_LAST_SEEN = MSG-20260912-0060
LAST_PLANNING_INBOUND_CONSUMED = MSG-20260912-0059
LAST_CODING_OUTBOUND = MSG-20260912-0060

LAST_VERIFIED_ACTION: Planning `MSG-20260912-0059` dispatched `WO-20260912-CODING-OPS-QA-001`. CODING implemented and deployed a narrow authenticated OWNER-only, SUPABASE_STAGING-only fixed QA fixture create/cleanup capability. Complete staging CI and stable Preview read-only smoke are PASS. Implementation evidence was appended to Planning as `MSG-20260912-0060` and read back successfully. Actual authenticated OWNER visual/click QA has not been claimed and remains the closure gate.

## Durable implementation refs

- OPS base implementation: `6ad4773365466277319961329757c1df3f33c230`
- OWNER QA capability source: `59dc7fa33ebdd8fbe76c229a6985a776dbe3e7a8`
- Preview deployment marker: `b7c949ba6999ee8e37da4ce33f443fe8b59a6f6d`
- live read-only smoke trigger: `d31d5bd7f1ca110985795e46e189c40707bc5d63`
- evidence: `docs/coding/OPS_OWNER_QA_FIXTURE_DEPLOY_20260912.md`
- cross-track implementation evidence: `MSG-20260912-0060`

## Capability contract

Browser actions:

- `admin.ops.qa.fixture.create`
- `admin.ops.qa.fixture.cleanup`

Guards:

- same-origin/session boundary retained
- OWNER/SUPER_ADMIN required
- SUPABASE_STAGING required; non-STAGING action cannot fall through to legacy bridge
- empty/fixed payload only; no arbitrary browser-supplied event fields
- fixed namespace `OWNER_QA_FIXTURE / WO-20260912-CODING-OPS-QA-001`
- source fixture is synthetic `OPS_DATA_ONLY` with `mutationApplied:false`
- deterministic create request ID gives at most one active root fixture
- existing `admin.ops.review` creates the causal `PLANNING_IMPACT` child; QA root uses deterministic review request ID
- repeated review is idempotent
- cleanup accepts only exact root + exact causal review lineage and fails closed on namespace conflicts
- event delete cascades only matching outbox rows
- no real farm/account/business mutation
- no new DB migration or browser DB privilege
- no service-role/credential material in browser bundle
- no direct worker command and no fake DONE

## Verification

Stable Preview smoke run `34676193695`, job `103506377060` passed:

```text
/ops-relay.html 200
/assets/ops-relay.js 200
/assets/ops-relay.css 200
/api/session configured=true authenticated=false
admin.ops.events unauthenticated -> 401
admin.ops.qa.fixture.create unauthenticated -> 401
admin.ops.qa.fixture.cleanup unauthenticated -> 401
remoteMutation=NONE
```

Pre-user-QA Supabase residue readback:

```text
ops_change_events=0
ops_outbox=0
OWNER_QA_FIXTURE residue=0
```

CODING TRACK_STATE after Bus readback:

```text
last_message_seen=MSG-20260912-0059
pending_inbound=0
pending_outbound=1
outbound=MSG-20260912-0060
```

Production/main/live legacy Google mutation remains 0.

## Remaining user-authorized QA

In the user's existing OWNER session:

1. Refresh `/ops-relay.html`.
2. Click `QA 이벤트 준비`.
3. Select the fixed OWNER_QA fixture and verify detail/correlation/outbox.
4. Click `기획 검토 필요`.
5. Verify one causal `PLANNING_IMPACT` child, correct correlation/causation, no direct UIUX/CODING command and no fake DONE.
6. Capture/confirm visual evidence.
7. Click `QA 이벤트 정리`.
8. CODING performs independent read-only residue verification = 0 and reports final evidence to Planning.

Do not read/reset/synthesize OWNER credentials/session material to perform this step.

## Reserved / non-executable

- `WO-20260912-CODING-PRODUCTIONIZATION-001` — RESERVED / NOT_DISPATCHED
- `WO-20260912-PLATFORM-REUSE-001` — RESERVED / DEFERRED / NOT_DISPATCHED

## NEXT HANDOFF

1. Await the user's existing authorized OWNER session visual/click QA.
2. After the user confirms review-child behavior, run the fixed cleanup only.
3. Independently verify QA event/outbox residue=0 and report final acceptance to Planning.
4. Fresh-read Planning Bus before any further implementation.
5. Do not self-start Productionization or Platform Reuse.
