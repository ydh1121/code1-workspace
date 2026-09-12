# CODE1 CODING BATON

Updated: 2026-09-12 KST
PLANNING_DELTA_SEQ_SEEN = 20260912-008
CROSS_TRACK_BUS_LAST_SEEN = MSG-20260912-0058
LAST_PLANNING_INBOUND_CONSUMED = MSG-20260912-0057
LAST_CODING_OUTBOUND = MSG-20260912-0058

LAST_VERIFIED_ACTION: Planning inbound `MSG-20260912-0057` was processed under `WO-20260912-CODING-OPS-001`. User OWNER visual QA is partial: the authenticated `/ops-relay.html` surface renders, but zero events prevent detail/status/review interaction. Planning requested exactly one synthetic reversible STAGING QA event using the existing server-side OPS contract and forbade real-business mutation, credential manipulation, Production/main/legacy mutation, or unsafe bypass.

## Fixture capability result

The existing DB contract is suitable without product-data mutation:

- `code1_ops_record_manual_event(...)` records a synthetic event and returns `mutationApplied:false`.
- `code1_ops_request_planning_review(...)` creates the causal `PLANNING_IMPACT` child event used by the existing `admin.ops.review` action.

STAGING preflight and post-attempt readback:

```text
ops_change_events=0
ops_outbox=0
OWNER_QA synthetic residue=0
OWNER/SUPER_ADMIN contract row ready=true
```

The available Supabase connector SQL identity is `supabase_read_only_user`. It has no EXECUTE on `code1_ops_record_manual_event`, is not a member of `service_role` or `postgres`, and has no INSERT privilege on the OPS event/outbox tables. `service_role` alone retains function execution as designed.

One call through this read-only SQL channel was rejected with `permission denied for function code1_ops_record_manual_event`. No write occurred.

The current Preview server contract exposes `admin.ops.events` and `admin.ops.review`, but no manual-event creation action. This execution environment does not possess the user's authorized OWNER browser session.

Result = `BLOCKED_CAPABILITY`.

CODING -> PLANNING blocker report `MSG-20260912-0058` was appended after fresh target-row reconciliation and read back successfully. CODING TRACK_STATE was updated to `last_message_seen=MSG-0057`, `pending_inbound=0`, `pending_outbound=1`.

Do not resolve this by:

- widening anon/authenticated/read-only privileges
- adding an ad-hoc unauthenticated fixture route or RPC
- invoking data writes through migration-owner privilege as a bypass
- reading/resetting/synthesizing OWNER credentials or session secrets
- mutating any real farm/account/business entity just to manufacture QA evidence

## Existing accepted OPS checkpoint

Implementation head remains `6ad4773365466277319961329757c1df3f33c230`.
Supabase STAGING migrations `ops_change_relay_0018` and `ops_change_relay_acceptance_0019` remain applied.
Cloudflare Preview deployment `3e5b3188ff64f3e788fd88c6eccbac360444fa21` remains accepted.
CI/build/read-only live smoke remain PASS.
Production/main/live legacy Google mutation remains 0.

Canonical cross-track evidence:

- `MSG-20260912-0053` — final technical implementation evidence
- `MSG-20260912-0054` — decision request, APPLIED
- `MSG-20260912-0056` — OWNER QA closure gate
- `MSG-20260912-0057` — partial OWNER QA + one-fixture continuation, consumed
- `MSG-20260912-0058` — CODING blocker report, pending Planning disposition

## Remaining OWNER QA

If Planning supplies or authorizes a safe existing-server write capability for the one synthetic fixture, verify:

- All / Planning / Incident / Failed / Done filters
- event detail
- correlation / causation
- relay + outbox status
- `기획 검토 필요` -> one causal `PLANNING_IMPACT`
- no direct UIUX/CODING command
- no fake DONE

After user QA, delete only the synthetic fixture lineage/outbox and independently read back residue=0.

## Reserved / non-executable

- `WO-20260912-CODING-PRODUCTIONIZATION-001` — RESERVED / NOT_DISPATCHED
- `WO-20260912-PLATFORM-REUSE-001` — RESERVED / DEFERRED / NOT_DISPATCHED

## NEXT HANDOFF

1. Fresh-read CURRENT and the latest Planning -> CODING inbound.
2. Wait for an explicit Planning disposition responding to `MSG-20260912-0058` before any additional fixture implementation or write-path change.
3. Do not self-start Productionization or Platform Reuse.
