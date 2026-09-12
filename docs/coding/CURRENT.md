# CODE1 CODING CURRENT

Updated: 2026-09-12 KST
Status: OPS CHANGE RELAY TECHNICAL ACCEPTED / OWNER QA PARTIAL / QA FIXTURE BLOCKED_CAPABILITY
Branch: `coding/runtime-backend-staging`
Implementation head: `6ad4773365466277319961329757c1df3f33c230`
Base main: `a71a71eae73706862308e194110f4fcc2d25db01`
Supabase STAGING: `bsintmkyhptizrjoizfb`
Stable Preview: `https://coding-runtime-backend-stagi.code1-workspace.pages.dev`
Production/main mutation: 0
Live legacy Google mutation: 0
PLANNING_DELTA_SEQ_SEEN = 20260912-008
CROSS_TRACK_BUS_LAST_SEEN = MSG-20260912-0057

## Active work order

`WO-20260912-CODING-OPS-001` — CODE1 OPS CHANGE RELAY v0.1.

Planning inbound `MSG-20260912-0057` is consumed. Existing authorized-browser visual QA is partial PASS: `/ops-relay.html` renders the STAGING state and required filters, but the dataset is empty so event detail/status and `기획 검토 필요` interaction cannot yet be exercised.

Planning requested exactly one synthetic/reversible STAGING QA event under the existing OPS contract, with no real business mutation and no credential/RBAC bypass.

## MSG-0057 fixture preflight

Existing code already contains the correct no-business-mutation contract:

- `public.code1_ops_record_manual_event(...)`
- result JSON includes `mutationApplied:false`
- `public.code1_ops_request_planning_review(...)` creates the causal `PLANNING_IMPACT` child event used by `admin.ops.review`

Preflight STAGING readback:

```text
ops_change_events = 0
ops_outbox = 0
OWNER_QA synthetic residue = 0
OWNER SUPER_ADMIN contract row = ready
```

The available Supabase connector SQL session is `supabase_read_only_user`.

Readback proves:

```text
current role EXECUTE code1_ops_record_manual_event = false
service_role EXECUTE = true
current role member of service_role = false
current role member of postgres = false
current role INSERT ops_change_events = false
current role INSERT ops_outbox = false
```

A single attempted invocation through that read-only SQL session was denied by PostgreSQL with `permission denied for function code1_ops_record_manual_event`; no event/outbox/business row was created.

Current Preview server actions expose `admin.ops.events` and `admin.ops.review`, but do not expose a generic manual-event creation action. The current execution environment also does not possess the user's authorized OWNER browser session.

Therefore fixture preparation is `BLOCKED_CAPABILITY` under `MSG-0057`. Do not work around this by granting browser/read-only roles new privileges, adding an ad-hoc unauthenticated RPC/route, using a migration-owner path as a data-write bypass, or reading/resetting/synthesizing OWNER credentials/session secrets.

## OPS technical checkpoint

Primary evidence: `docs/coding/OPS_CHANGE_RELAY_EVIDENCE_20260912.md`.
Canonical final evidence: `MSG-20260912-0053`.
Planning closure-gate decision: `MSG-20260912-0056`.
Planning partial-QA continuation: `MSG-20260912-0057`.

Applied Supabase STAGING migrations:

- `0018_ops_change_relay.sql` / `ops_change_relay_0018`
- `0019_ops_change_relay_acceptance.sql` / `ops_change_relay_acceptance_0019`

Technical acceptance remains PASS for atomicity/rollback, idempotency, six classifications, policy fail-closed, incident priority, unsafe-evidence rejection, Planning child event, retry/lifecycle, browser-role RBAC denial, CI/build, Preview deployment and read-only live smoke.

## OWNER QA closure gate

The Work Order remains NOT CLOSED.

Once a safe authorized server-side fixture creation capability is available, OWNER QA must verify:

- All / Planning / Incident / Failed / Done filters
- event detail
- correlation / causation
- relay status + outbox status
- `기획 검토 필요` creates `PLANNING_IMPACT` only
- no direct UIUX/CODING command
- no fake `DONE`

After QA, all synthetic fixture lineage/outbox residue must be removed and read back as zero before closeout.

## Reserved work — NOT DISPATCHED

- `WO-20260912-CODING-PRODUCTIONIZATION-001`
- `WO-20260912-PLATFORM-REUSE-001`

No Production/main/Production Supabase/Production R2/live legacy Google mutation is authorized.

## NEXT_ATOMIC_ACTION

1. Report `MSG-0057` fixture creation as `BLOCKED_CAPABILITY` to Planning with the exact privilege/readback evidence.
2. Do not add an unsafe bypass or widen RBAC.
3. Fresh-read the Planning Bus after the blocker report and execute only a new explicit Planning disposition.
4. Productionization and Platform Reuse remain non-executable.
