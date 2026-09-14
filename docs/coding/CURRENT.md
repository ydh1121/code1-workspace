# CODE1 CODING CURRENT

Updated: 2026-09-14 KST
Status: `MSG-20260914-0099` CONSUMED / MATERIAL FIELD TYPES + DRAFT-PUBLISH TECHNICAL PASS / `BLOCKED_AUTH_SESSION` / STAGING ONLY
Branch: `coding/runtime-backend-staging`
Base main: `a71a71eae73706862308e194110f4fcc2d25db01`
Supabase STAGING: `bsintmkyhptizrjoizfb`
Stable Preview: `https://coding-runtime-backend-stagi.code1-workspace.pages.dev`
Production/main mutation: 0
Production Supabase/R2 mutation: 0
Live legacy Google/Drive hot-path mutation: 0
Credential read/reset/synthesis: 0
PLANNING_DELTA_SEQ_SEEN = 20260914-048
CROSS_TRACK_BUS_LAST_SEEN = MSG-20260914-0101
LAST_PLANNING_INBOUND_CONSUMED = MSG-20260914-0099
LAST_CODING_OUTBOUND = MSG-20260914-0101

## Current Planning authority

Active Work Order: `WO-20260914-CODING-MATERIAL-FIELD-TYPES-001`.

Authority: `MSG-20260914-0099 / Planning Delta 20260914-048 / P0`.

Fresh Bus read immediately before outbound showed no newer PLANNING -> CODING instruction. CODING published `MSG-20260914-0101` with technical evidence and the remaining authenticated-browser blocker.

## Model correction implemented

The existing farm-material submission implementation was directly inspected first. Planning Material remains a separate domain, but reuses its proven domain-neutral pattern: catalog-level input type + immutable response snapshot + non-destructive exposure/history behavior.

Template response kinds:

- `TEXT`
- `LONG_TEXT`
- `FILE`
- `TEXT_FILE`

New request items snapshot `response_kind_snapshot` from the PUBLISHED template revision. Existing request items are not retrofitted; legacy snapshots intentionally remain NULL and preserve pre-0024 behavior/history.

Typed server validation:

- TEXT/LONG_TEXT: text satisfies a required item; planning-material file insertion is rejected.
- FILE: a current file satisfies a required item; normal text submission is rejected.
- TEXT_FILE: both channels are required when the item is required.

Typed browser rendering:

- `제품명` TEXT => text control only, no file zone.
- FILE evidence => file/drop zone only, no normal text field.
- TEXT_FILE => both only when explicitly configured.

## Draft / Preview / Publish lifecycle

Implemented explicit lifecycle:

1. `초안 저장` creates a DRAFT revision.
2. `초안 미리보기` renders the exact submitter control shape internally.
3. Draft items are not visible to real submitters/new requests.
4. `게시` explicitly advances `published_revision`.
5. New requests snapshot only the latest PUBLISHED revision.
6. A never-published draft-only item may be physically deleted before publish.
7. A previously published item removed from the current configuration is archived/inactivated for future requests while existing request snapshots/version history remain immutable.

## MSG-0096 behavior preserved

- entire visible drop zone clickable/keyboard accessible
- dragenter/dragover/dragleave/drop feedback
- multi-file drop/select
- filename + size queue
- per-file remove before upload
- per-file progress/success/error
- retry/reupload/new-version path
- existing file/version history
- internal review separated from submitter compose flow
- private R2/RBAC/idempotency/audit/manifest/PLANNING_IMPACT contracts

## Supabase STAGING verification

Applied:

- `planning_material_field_types_lifecycle_0024`
- `planning_material_field_types_acceptance_0025`

Pre/post legacy request-item readback:

- row count = 14
- legacy NULL `response_kind_snapshot` = 14
- fingerprint = `0badfd86ac001a1dcd9441a7868c8f3a`

The fingerprint and row count remained unchanged after 0024 and after privileged 0025 acceptance.

0025 synthetic acceptance exercised draft isolation/delete, explicit publish, required TEXT, required FILE, explicit TEXT_FILE, type guard failures, required-file blocking, file completion, published-item future removal, and old-request snapshot preservation. All synthetic rows were removed before commit; residue readback = 0.

Relevant material RPC functions remain executable by `service_role` only and denied to browser DB roles `anon` / `authenticated`.

## Git / CI / Preview

- field-type interaction checkpoint: `70f582b8ef896ca470038426d211efd2774c1d1c`
- DB acceptance source: `aa55258a27c18c00810ae0061e24338515a5b304`
- Cloudflare deployment: `795243ddf5d0880481fca616e7e3b7ea93c4ab16`
- atomic Preview: `https://dcd66a17.code1-workspace.pages.dev`
- stable Preview: `https://coding-runtime-backend-stagi.code1-workspace.pages.dev`
- final typed smoke checkpoint: `7da7017fbcd6ac48f2cabeb6c0d1c329e2f6d6ed`
- durable evidence: `docs/coding/PLANNING_MATERIAL_FIELD_TYPES_EVIDENCE_20260914.md`

Verification:

- Cloudflare Pages deploy = SUCCESS
- isolated-node-checks = SUCCESS
- field-type interaction suite included in STAGING tests
- earlier complete STAGING tree = 199/199 PASS / 0 fail
- locked npm audit = 0
- known root baseline failures unchanged

Stable Preview read-only smoke = PASS:

- `/` 200
- accounts JS 200
- Planning Material JS/CSS 200
- typed response bundle contract PASS
- draft/publish bundle contract PASS
- 390px/overflow/upload/review CSS contract PASS
- session configured=true / authenticated=false
- unauthenticated bootstrap/get/upload/submit/publish all 401 `UNAUTHENTICATED`
- remote mutation = NONE

## Remaining mandatory gate — BLOCKED_AUTH_SESSION

Actual authenticated OWNER + assigned submitter/PARTNER desktop + 390px browser QA is still required by MSG-0099 and is **not claimed**.

Readback established:

- this execution context has no interactive Computer/Cloud Browser tool carrying the user's existing staging session;
- the repository has no Playwright/Puppeteer authenticated browser runner with a pre-authorized session;
- `bootstrap-owner-web-login-staging.mjs` is not a session-reuse path: it requires `CODE1_OPERATOR_SESSION_SECRET` and a new `CODE1_STAGING_OWNER_PASSWORD`, resets OWNER password/session version, then logs in;
- that credential-reset path was not executed;
- current STAGING account readback contains active OWNER and no active PARTNER account, so there is no existing assigned PARTNER identity/session to use.

Per the existing-authorized-session safety rule, CODING did not read/reset/synthesize credentials and did not invent a QA PARTNER account. Therefore the WO cannot truthfully be marked CLOSED in this execution context.

Required remaining browser acceptance once authorized sessions exist:

### OWNER desktop + 390px

- exact typed controls: TEXT only / FILE only / explicit TEXT_FILE both
- draft item internal preview only
- delete draft before publish
- publish then verify subsequent new request snapshot
- remove published item then verify new request exclusion + old history preservation
- actual drag/drop, queue/removal/progress/reupload usability
- internal review separation
- horizontal overflow 0
- page/console errors 0

### assigned PARTNER desktop + 390px

- only assigned request access
- typed submitter surfaces identical to published snapshot
- draft/internal controls absent
- actual drag/drop path
- internal review absent
- horizontal overflow 0
- page/console errors 0

## Hard boundaries

- STAGING ONLY
- Production/main/live mutation = 0
- Production Supabase/R2 mutation = 0
- Drive hot-path dual-write = 0
- credentials/session-secret/password mutation = 0
- no fabricated browser evidence
- no automatic VERIFIED / APPROVED_CURRENT / public delivery
- no unrelated DESIGN/UIUX/Productionization work

## NEXT_ATOMIC_ACTION

1. Fresh-read Message Bus first.
2. If Planning issues newer CODING authority, process it before anything else.
3. Otherwise remain `BLOCKED_AUTH_SESSION` until an existing authorized OWNER session and assigned PARTNER session are available in an interactive browser-capable execution context.
4. Run the exact desktop + 390px browser acceptance above; fix only concrete bounded defects if found.
5. Only after truthful browser PASS, publish final CODING -> PLANNING completion evidence and request WO closure.
