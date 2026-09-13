# CODE1 CODING BATON

Updated: 2026-09-14 KST
PLANNING_DELTA_SEQ_SEEN = 20260914-044
CROSS_TRACK_BUS_LAST_SEEN = MSG-20260914-0094
LAST_PLANNING_INBOUND_CONSUMED = MSG-20260914-0094
LAST_CODING_OUTBOUND = MSG-20260914-0093

LAST_VERIFIED_ACTION: Planning `MSG-20260914-0094 / AUTH_BROWSER_QA_CONTINUATION` was consumed. User-provided authenticated OWNER screenshots exposed bounded Planning Material UI defects. Frontend-only UX polish was implemented, regression-tested, deployed to Cloudflare Pages STAGING and credential-free stable Preview smoke passed. Supabase migrations/schema, R2 contracts, RBAC, manifest and OPS contracts were not changed. Post-fix authenticated OWNER visual QA is now the immediate gate.

## Active authority

`WO-20260913-CODING-MATERIAL-INGEST-001 / REV B`

Latest Planning authority: `MSG-20260914-0094 / Delta044`.

REV B is already `TECHNICAL_ACCEPTED`. Do not replay migrations or expand scope. Fix only concrete bounded authenticated-browser QA defects.

Underlying REV B domain correction remains `MSG-20260913-0092 / Delta041`; `MSG-20260913-0091 / Delta040` is SUPERSEDED.

Exact internal tab contract remains:

`기획문서` -> `상세페이지 및 제안서 파일` -> `해야 할 일`

## Backend checkpoint — unchanged

Supabase STAGING migrations:

- `planning_material_workspace_0021`
- `planning_material_acceptance_0022`
- `planning_material_transactional_acceptance_0023`

Synthetic acceptance residue previously read back 0. No database migration or Production resource change occurred during UX polish.

## UX defect correction checkpoint

Authenticated OWNER pre-fix screenshots showed:

- request card/title width collapse
- irrelevant generic farm/account KPIs inside Planning Material tab
- all request items fully expanded
- weak file-selection affordance
- upload-item manager horizontal scroll/clipped controls
- raw internal classification codes visible

Bounded correction checkpoints:

- JS: `c3b6e70cc834065413442eca1e01198158e0ab8d`
- CSS: `ae6fefa86dbb49372b1cf0237775340b164cf330`
- focused UX test: `70900c7e81ec4d798bed2dd22002378cc2790b31`
- Preview deploy: `69d78f5258df6e221cefb7a4b52723a0d3f6252a`
- atomic Preview: `https://265aa4a1.code1-workspace.pages.dev`
- stable Preview: `https://coding-runtime-backend-stagi.code1-workspace.pages.dev`
- stable Preview smoke trigger/checkpoint: `5ecce9f6f7877c7673a650d7eb98bf83aae8c208`

New UI contract:

- full-width request rows
- material-specific operational metrics
- item accordions with file/submission/review summary
- improved selected-file/drag-drop affordance while retaining existing private-R2 upload RPCs
- wide upload-item manager without horizontal scrolling
- human-readable classification labels
- ↑/↓ ordering controls
- sticky save/cancel footer
- 390px no-horizontal-overflow responsive contract

## Verification read-back

`70900c7e...` isolated-node-checks = SUCCESS.

Cloudflare Pages `69d78f52...` = SUCCESS.

Credential-free stable Preview smoke at `5ecce9f6...` = SUCCESS:

- root + accounts/material JS/CSS 200
- dynamic loader PASS
- session configured=true / authenticated=false
- material bootstrap/get/upload-begin/submit fail closed with 401 when unauthenticated
- remote mutation NONE

`5ecce9f6...` isolated-node-checks = SUCCESS.

## Remaining authenticated QA

OWNER post-fix visual/click QA must be performed through the user's existing authorized session. Do not read/reset/synthesize credentials and do not infer PASS from credential-free smoke.

Required immediate visual checks:

1. Material tab shows material-specific metrics instead of generic farm/account metrics.
2. Request title/row no longer collapses vertically.
3. Request detail renders compact accordion items.
4. Upload item manager fits without horizontal scroll; classification labels are human-readable; save actions remain reachable.
5. Desktop page/console errors = 0.
6. 390px horizontal overflow = 0 when evidence is available.

PARTNER authenticated access/denial click QA remains pending under `MSG-0094` unless a newer Planning disposition changes that gate.

## Hard boundaries

- Production/main/live mutation = 0
- Production Supabase/R2 mutation = 0
- credentials unchanged/not accessed
- Drive hot-path write = 0
- paid resources = none
- automatic VERIFIED/APPROVED_CURRENT/public delivery = none
- DESIGN/Figma/HOME/UIUX = untouched
- retention freeze/purge = none

## NEXT HANDOFF

1. Get fresh post-fix screenshots from the existing authorized OWNER session after hard refresh.
2. Evaluate visible defects/click paths only; fix only bounded defects and rerun impacted checks.
3. Complete required OWNER/PARTNER auth QA or explicitly report remaining gate.
4. Publish CODING -> PLANNING evidence for `MSG-0094` only after the authenticated QA status is truthfully known.
5. Do not auto-start Drive mirroring, Productionization or unrelated work.
