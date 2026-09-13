# CODE1 CODING CURRENT

Updated: 2026-09-14 KST
Status: MATERIAL WORKSPACE REV B TECHNICAL ACCEPTED / AUTH OWNER QA CONTINUATION / UX POLISH DEPLOYED / STAGING ONLY
Branch: `coding/runtime-backend-staging`
Base main: `a71a71eae73706862308e194110f4fcc2d25db01`
Supabase STAGING: `bsintmkyhptizrjoizfb`
Stable Preview: `https://coding-runtime-backend-stagi.code1-workspace.pages.dev`
Production/main mutation: 0
Production Supabase/R2 mutation: 0
Live legacy Google mutation: 0
PLANNING_DELTA_SEQ_SEEN = 20260914-044
CROSS_TRACK_BUS_LAST_SEEN = MSG-20260914-0094
LAST_PLANNING_INBOUND_CONSUMED = MSG-20260914-0094
LAST_CODING_OUTBOUND = MSG-20260914-0093

## Current Planning authority

Planning `MSG-20260914-0094 / Delta044 / AUTH_BROWSER_QA_CONTINUATION` is the latest CODING authority for `WO-20260913-CODING-MATERIAL-INGEST-001 / REV B`, STAGING ONLY.

Planning already marked the REV B implementation `TECHNICAL_ACCEPTED`. `MSG-0094` does not authorize schema expansion or migration replay. It authorizes authenticated OWNER/PARTNER browser QA on stable STAGING Preview and bounded fixes only for concrete QA defects.

`MSG-20260913-0091 / Delta040` remains SUPERSEDED. `MSG-20260913-0092 / Delta041` remains the controlling REV B domain correction underneath the QA continuation.

Exact internal tab order remains:

1. `기획문서`
2. `상세페이지 및 제안서 파일`
3. `해야 할 일`

## Technical implementation status

Applied Supabase STAGING migrations remain unchanged and read back live:

- `planning_material_workspace_0021`
- `planning_material_acceptance_0022`
- `planning_material_transactional_acceptance_0023`

No migration was replayed for UX polish.

Core REV B implementation remains unchanged: separate Planning Material domain, exact seven defaults, SUPER_ADMIN versioned template controls, PARTNER assigned-request-only access, private R2 multipart/checksum/idempotency, immutable request snapshots, review/audit history, deterministic Planning manifest, and deduplicated `PLANNING_IMPACT` OPS event/outbox.

## Authenticated OWNER QA defect intake and bounded UX fix

User-provided authenticated OWNER screenshots exposed concrete interface defects on stable STAGING Preview:

- request tile width collapsed and Korean title text wrapped vertically one character at a time
- generic farm/account KPI cards were contextually wrong inside the Planning Material tab
- all seven request items were expanded at once, producing excessive scroll and repeated controls
- browser-native file selection gave weak selected-file feedback
- upload-item manager modal required horizontal scrolling and clipped classification controls
- internal classification codes were exposed directly to users

Bounded frontend-only correction was applied. Data model, RPC actions, Supabase schema, R2 contracts, RBAC, manifest and OPS contracts were not changed.

UX polish commits/checkpoints:

- JS UX correction: `c3b6e70cc834065413442eca1e01198158e0ab8d`
- CSS responsive/layout correction: `ae6fefa86dbb49372b1cf0237775340b164cf330`
- focused UX regression test: `70900c7e81ec4d798bed2dd22002378cc2790b31`
- Cloudflare Preview deployment: `69d78f5258df6e221cefb7a4b52723a0d3f6252a`
- deployed atomic Preview: `https://265aa4a1.code1-workspace.pages.dev`
- stable Preview: `https://coding-runtime-backend-stagi.code1-workspace.pages.dev`
- smoke trigger/docs checkpoint: `5ecce9f6f7877c7673a650d7eb98bf83aae8c208`

Implemented UI changes:

- full-width operational request rows instead of collapsing card grid
- material-specific summary metrics: 전체 요청 / 요청 중 / 제출 완료 / 검토 대기
- compact `<details>` accordion for request items with submission/review/file-count summaries
- clearer progress summary including file count, verified count and needs-info/rejected count
- improved file picker with selected file names/sizes and drag/drop affordance; existing upload RPCs retained
- wider upload-item manager with no horizontal scrolling, human classification labels, ↑/↓ ordering controls and sticky save/cancel footer
- explicit 390px no-horizontal-overflow responsive rules retained

## QA / Preview

Focused pre-deploy `isolated-node-checks` at `70900c7e...` = SUCCESS.

Cloudflare Pages deployment at `69d78f52...` = SUCCESS.

Credential-free stable Preview smoke at `5ecce9f6...` = SUCCESS:

- `/` 200
- `/assets/accounts.js` 200
- `/assets/planning-materials.js` 200
- `/assets/planning-materials.css` 200
- session configured=true / authenticated=false
- unauthenticated `planning.material.bootstrap` -> 401 `UNAUTHENTICATED`
- unauthenticated `planning.material.request.get` -> 401 `UNAUTHENTICATED`
- unauthenticated `planning.material.upload.begin` -> 401 `UNAUTHENTICATED`
- unauthenticated `planning.material.request.submit` -> 401 `UNAUTHENTICATED`
- dynamic loader contract PASS
- remote mutation NONE

Final docs-only checkpoint `5ecce9f6...` isolated-node-checks = SUCCESS.

## Remaining acceptance gate

The user has an existing authorized OWNER browser session and supplied pre-fix screenshots. Post-fix authenticated visual/click acceptance is still pending and must be based on fresh user-visible evidence; CODING must not invent a PASS.

Next visual checks on the stable Preview:

- material-specific metrics replace generic farm/account metrics in this tab
- request title no longer collapses vertically
- request detail uses compact accordion rows
- upload item manager has no horizontal scroll and shows human classification labels
- desktop page/console errors = 0
- 390px horizontal overflow = 0

PARTNER authenticated QA remains separately required by `MSG-0094` unless Planning later narrows or accepts evidence.

## Hard boundaries preserved

- STAGING ONLY
- Drive hot-path dual-write = 0
- public delivery default = false
- automatic VERIFIED / APPROVED_CURRENT = none
- Production/main/live mutation = 0
- Production Supabase/R2 mutation = 0
- credential mutation/access = 0
- paid resource activation = 0
- DESIGN/Figma/HOME/UIUX modification = 0
- retention freeze/purge = 0

## NEXT_ATOMIC_ACTION

1. Ask the user to hard-refresh the stable Preview in the existing authorized OWNER session and provide post-fix desktop screenshots; also collect a 390px view when practical.
2. Assess only the visible/click paths actually demonstrated; do not fabricate OWNER/PARTNER QA.
3. Fix only concrete bounded defects discovered by that QA and rerun impacted tests/smoke.
4. After the authorized QA gate is complete, publish one CODING -> PLANNING implementation evidence message referencing `MSG-0094`.
5. Do not auto-start Drive mirroring, Productionization, retention freeze/purge, or unrelated cross-track work.
