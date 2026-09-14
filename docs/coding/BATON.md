# CODE1 CODING BATON

Updated: 2026-09-14 KST
PLANNING_DELTA_SEQ_SEEN = 20260914-048
CROSS_TRACK_BUS_LAST_SEEN = MSG-20260914-0101
LAST_PLANNING_INBOUND_CONSUMED = MSG-20260914-0099
LAST_CODING_OUTBOUND = MSG-20260914-0101

LAST_VERIFIED_ACTION: `MSG-20260914-0099 / WO-20260914-CODING-MATERIAL-FIELD-TYPES-001 / Delta048` was implemented on STAGING. Field types, immutable request snapshots, typed required validation, explicit DRAFT→PREVIEW→PUBLISH, safe draft delete and published-history preservation are technically PASS. Supabase 0024/0025, CI, Cloudflare deployment and typed stable-Preview read-only smoke all passed. Mandatory real authenticated OWNER + assigned PARTNER desktop/390 browser QA remains `BLOCKED_AUTH_SESSION` and was not fabricated.

## Active authority

`WO-20260914-CODING-MATERIAL-FIELD-TYPES-001`

Latest Planning authority consumed: `MSG-20260914-0099 / Delta048 / P0`.

CODING outbound: `MSG-20260914-0101` = technical evidence + exact auth-session blocker.

No newer PLANNING -> CODING authority was present in the final pre-outbound Bus read.

## Implemented contract

Planning Material template items now carry explicit `response_kind`:

- TEXT
- LONG_TEXT
- FILE
- TEXT_FILE

New request items snapshot that value immutably from the published template revision. Existing pre-0024 request items remain legacy-compatible with NULL `response_kind_snapshot`; no retrofit/history rewrite was performed.

Required validation:

- TEXT/LONG_TEXT => text channel
- FILE => current file channel
- TEXT_FILE => both channels

TEXT items reject Planning Material file containers; FILE items reject normal text submission.

Browser rendering follows the same response kind. `제품명` TEXT is text-only, FILE evidence is dropzone-only, and TEXT_FILE exposes both only when explicitly selected.

## Lifecycle

- template save = DRAFT
- internal exact-surface preview
- no draft exposure to submitter/new request
- explicit publish moves `published_revision`
- request creation snapshots PUBLISHED revision only
- never-published draft item may be physically deleted
- previously published removed item becomes archived/inactive for future requests while old request snapshots remain

## Preserved MSG-0096 behavior

- clickable/keyboard drop zone
- real drag/drop event handling and feedback
- multi-file queue
- filename/size/remove-before-upload
- progress/per-file result
- retry/reupload/new-version path
- internal review separated from submitter flow
- private R2, RBAC, audit, immutable file history, deterministic manifest, PLANNING_IMPACT preserved

## Supabase STAGING

Project: `bsintmkyhptizrjoizfb`

Applied:

- `planning_material_field_types_lifecycle_0024`
- `planning_material_field_types_acceptance_0025`

Legacy request-item invariant after both migrations:

- 14 rows
- 14 NULL legacy response-kind snapshots
- fingerprint `0badfd86ac001a1dcd9441a7868c8f3a`

0025 privileged acceptance PASS covered the required TEXT/FILE/TEXT_FILE and draft/publish/remove-history scenarios. Synthetic residue = 0.

Browser DB roles remain denied direct execution of the material service RPCs.

## Git / deploy checkpoints

- interaction checkpoint: `70f582b8ef896ca470038426d211efd2774c1d1c`
- acceptance source: `aa55258a27c18c00810ae0061e24338515a5b304`
- deployed application commit: `795243ddf5d0880481fca616e7e3b7ea93c4ab16`
- atomic Preview: `https://dcd66a17.code1-workspace.pages.dev`
- stable Preview: `https://coding-runtime-backend-stagi.code1-workspace.pages.dev`
- typed live-smoke checkpoint: `7da7017fbcd6ac48f2cabeb6c0d1c329e2f6d6ed`
- durable evidence: `docs/coding/PLANNING_MATERIAL_FIELD_TYPES_EVIDENCE_20260914.md`

Cloudflare deploy = SUCCESS.
Final typed read-only smoke = SUCCESS:

- static app/assets 200
- field-type bundle contract PASS
- draft/publish bundle contract PASS
- 390px CSS contract present
- session configured=true/authenticated=false
- unauth material bootstrap/get/upload/submit/publish = 401 UNAUTHENTICATED
- remote mutation NONE

Final smoke checkpoint isolated-node-checks = SUCCESS. Earlier full STAGING field-type tree = 199/199 PASS and npm audit 0.

## Current blocker

`BLOCKED_AUTH_SESSION`

Do not mark the WO CLOSED until real authenticated browser acceptance is run.

Facts read back:

1. Current chat execution has no interactive Computer/Cloud Browser carrying the user's staging session.
2. No Playwright/Puppeteer authenticated runner with a pre-authorized session exists in the repository.
3. `bootstrap-owner-web-login-staging.mjs` requires `CODE1_OPERATOR_SESSION_SECRET` and a new staging OWNER password, resets OWNER password/session version, and therefore is prohibited for manufacturing this QA.
4. Current STAGING account readback has active OWNER but no active PARTNER account/session.
5. No credentials were read/reset/synthesized and no QA account was created.

Remaining acceptance once existing authorized sessions are available:

OWNER desktop + 390px:
- TEXT only / FILE only / explicit TEXT_FILE both
- draft preview only and pre-publish delete
- publish -> subsequent request snapshot
- remove published item -> future exclusion + old history retained
- drag/drop + queue/remove/progress/reupload
- internal review separated
- no horizontal overflow
- page/console errors 0

Assigned PARTNER desktop + 390px:
- assigned-request-only access
- typed published controls
- no draft/template/internal-review surface
- actual drag/drop
- no horizontal overflow
- page/console errors 0

## Hard boundaries

- Production/main/live mutation = 0
- Production Supabase/R2 mutation = 0
- credentials unchanged/not accessed
- Drive hot-path write = 0
- no fabricated auth/browser evidence
- no unrelated cross-track work

## NEXT HANDOFF

1. Fresh-read Harness/CURRENT/Baton/Message Bus/Delta before resuming.
2. Process a newer PLANNING -> CODING message first if one exists.
3. Otherwise keep the WO at `BLOCKED_AUTH_SESSION` until existing authorized OWNER + assigned PARTNER browser sessions are available in an interactive browser-capable execution context.
4. Run desktop + 390px authenticated browser QA, fixing only concrete bounded defects.
5. After truthful PASS, append final CODING -> PLANNING completion evidence and request closure.
