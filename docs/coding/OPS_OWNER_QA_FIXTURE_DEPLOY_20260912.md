# CODE1 OWNER QA fixture Preview deploy

Work Order: `WO-20260912-CODING-OPS-QA-001`
Planning dispatch: `MSG-20260912-0059`
Target: `coding/runtime-backend-staging` only
Predeploy validated source head: `59dc7fa33ebdd8fbe76c229a6985a776dbe3e7a8`
Deployment marker: `b7c949ba6999ee8e37da4ce33f443fe8b59a6f6d`
Live-smoke trigger head: `d31d5bd7f1ca110985795e46e189c40707bc5d63`

## Implemented capability

The deployed `/ops-relay.html` exposes two authenticated OWNER controls only:

- `QA 이벤트 준비` -> `admin.ops.qa.fixture.create`
- `QA 이벤트 정리` -> `admin.ops.qa.fixture.cleanup`

The server contract is deliberately narrow:

- fixed synthetic template only; arbitrary payload fields are rejected
- entity namespace `OWNER_QA_FIXTURE / WO-20260912-CODING-OPS-QA-001`
- source class `OPS_DATA_ONLY`, `mutationApplied:false`
- fixed PII-free safe evidence reference
- deterministic source idempotency key: at most one active root fixture
- `기획 검토 필요` on the QA root uses the existing canonical review RPC and a deterministic review idempotency key, creating only one causal `PLANNING_IMPACT` child
- cleanup validates the exact root/child lineage and refuses unexpected rows before deleting
- deleting the fixed event lineage cascades only its `ops_outbox` rows through the existing FK
- OWNER authorization and same-origin/session gates are reused
- QA create/cleanup hard-fail when runtime is not `SUPABASE_STAGING`; they never fall through to the legacy bridge

No new DB migration, browser DB privilege, generic debug endpoint, service-role exposure, credential operation, Production/main mutation or live legacy Google mutation was introduced.

## CI acceptance

After one test-fixture-only correction, the complete staging CI is green. The correction changed a negative test from invalid role `EDITOR` to valid non-OWNER role `ADMIN`; implementation code was not weakened.

Final predeploy source CI at `59dc7fa33ebdd8fbe76c229a6985a776dbe3e7a8` and deployment-marker CI at `b7c949ba6999ee8e37da4ce33f443fe8b59a6f6d` both passed:

- staging/Cloudflare syntax checks
- Windows PowerShell parse checks
- all staging unit + contract tests
- locked dependency install
- npm audit with 0 vulnerabilities
- root regression baseline comparator
- existing workspace build

Acceptance coverage includes OWNER-only authorization, fixed-template enforcement, non-STAGING fail-closed, deterministic create/review idempotency, namespace-conflict cleanup refusal, no arbitrary browser payload surface, and no browser secret material.

## Live Preview read-only acceptance

Workflow run `34676193695`, job `103506377060` = PASS against the stable branch Preview:

```text
PASS GET /ops-relay.html 200
PASS GET /assets/ops-relay.js 200
PASS GET /assets/ops-relay.css 200
PASS GET /api/session configured=true authenticated=false
PASS POST /api/rpc admin.ops.events -> 401 UNAUTHENTICATED
PASS POST /api/rpc admin.ops.qa.fixture.create -> 401 UNAUTHENTICATED
PASS POST /api/rpc admin.ops.qa.fixture.cleanup -> 401 UNAUTHENTICATED
remoteMutation = NONE
```

This proves the deployed static surface contains the new QA controls and that all QA write actions still fail closed without an authenticated session.

## Authenticated OWNER visual/click acceptance

The user exercised the deployed stable Preview from the existing authorized OWNER browser session and supplied visual evidence. CODING independently read back the corresponding STAGING rows.

Root fixture after `QA 이벤트 준비`:

```text
event_id       = OCE_b52fcb855c464fe2850615637c52ef66
entity          = OWNER_QA_FIXTURE / WO-20260912-CODING-OPS-QA-001
action          = owner.qa.fixture.prepare
event_class     = OPS_DATA_ONLY
planning        = false
priority        = P1
relay_status    = NO_PLANNING_ACTION
correlation_id  = OCE_b52fcb855c464fe2850615637c52ef66
causation_id    = null
outbox_state    = NO_ACTION
outbox_attempts = 0
actor_ref       = OWNER
changed_fields  = [qa.fixture]
```

After the user clicked `기획 검토 필요`, exactly one canonical causal child was present:

```text
event_id       = OCE_18bc5d4699c64853928e8c419b465746
action          = planning.review.request
event_class     = PLANNING_IMPACT
planning        = true
priority        = P0
relay_status    = RECORDED
correlation_id  = OCE_b52fcb855c464fe2850615637c52ef66
causation_id    = OCE_b52fcb855c464fe2850615637c52ef66
outbox_state    = PENDING
outbox_attempts = 0
actor_ref       = OWNER
changed_fields  = [qa.fixture]
```

The browser UI and independent database read-back matched. No UIUX/CODING direct command event was created, and no fake `DONE` was synthesized.

## Cleanup acceptance

After visual/click evidence was confirmed, the user clicked `QA 이벤트 정리` once. CODING then independently performed read-only STAGING verification:

```text
ops_change_events = 0
ops_outbox = 0
OWNER_QA_FIXTURE residue = 0
```

Therefore the synthetic root, its causal Planning child and all associated outbox residue were removed. No real farm/account/business entity was used or mutated for this QA.

## Verdict

`WO-20260912-CODING-OPS-QA-001` acceptance = PASS from CODING evidence perspective.

The parent `WO-20260912-CODING-OPS-001` now has its previously outstanding authenticated OWNER visual/click closure evidence plus final cleanup verification. CODING may report the parent ready for Planning closeout, but does not self-close it and does not self-start Productionization.

Productionization and Platform Reuse remain `RESERVED / NOT_DISPATCHED` until a new explicit Planning dispatch.