# CODE1 CODING BATON

Updated: 2026-09-14 KST
PLANNING_DELTA_SEQ_SEEN = 20260914-046
CROSS_TRACK_BUS_LAST_SEEN = MSG-20260914-0096
LAST_PLANNING_INBOUND_CONSUMED = MSG-20260914-0096
LAST_CODING_OUTBOUND = MSG-20260914-0093

LAST_VERIFIED_ACTION: Planning `MSG-20260914-0096 / WO-20260914-CODING-MATERIAL-UX-001 / Delta046` was fresh-read and executed as an information-architecture/user-flow correction. The rebuilt Planning Material UI passed 187/187 STAGING tests including DOM interaction tests, deployed successfully to Cloudflare Pages STAGING, and credential-free stable Preview smoke passed. Required real authenticated OWNER and assigned submitter/PARTNER desktop + 390px browser QA is still open and must not be fabricated.

## Active authority

`WO-20260914-CODING-MATERIAL-UX-001`

Latest Planning authority: `MSG-20260914-0096 / Delta046 / P0`.

`MSG-0096` supersedes the remaining UX work under `MSG-0094`. REV B backend technical acceptance remains valid.

No newer PLANNING -> CODING message was present in the final Bus read before this handoff.

## Backend/schema checkpoint — preserved

No migration was added or replayed.

Supabase STAGING remains on:

- `planning_material_workspace_0021`
- `planning_material_acceptance_0022`
- `planning_material_transactional_acceptance_0023`

Fresh schema read confirmed existing `classification_hint + item_key + immutable request-item snapshot + files/file_versions` can represent the corrected IA without schema expansion.

Unchanged contracts:

- private R2 originals and multipart/checksum/idempotency/recovery
- RBAC and assigned-request authorization
- immutable request/template snapshots
- file revision/current/superseded history
- deterministic Planning manifest
- deduplicated `PLANNING_IMPACT` OPS event/outbox
- review/currentness/public-claim separation
- public delivery remains false by default

## MSG-0096 UI contract now deployed

### Request item

- one coherent `자료 제출` compose surface
- text and attachments coexist within that surface
- `추후 제출 / 자료 없음 / 해당 없음` are secondary collapsed exception actions
- internal review is a separate collapsed internal-only panel, absent from assigned submitter/PARTNER mode
- developer-facing English eyebrow labels removed from ordinary operator UI

### File UX

- whole drop zone clickable + keyboard accessible
- normal file picker preserved
- dragenter/dragover/dragleave/drop with visual feedback
- multi-file select/drop
- pre-upload filename + size queue
- per-file remove before upload
- per-file progress/state/success/failure
- failures do not erase other file results
- current-file `새 버전` opens a revision uploader with the same drop interaction and preserves history

### 요청 항목 관리

- one consistent name: `요청 항목 관리`
- outline-first classification/item structure
- first non-empty category open; other non-empty categories collapsed
- empty categories summarized/de-emphasized
- dense required/active/classification/guidance controls removed from outline
- secondary item edit dialog exposes label/guidance/classification/required/active
- existing add/reorder/archive/template revision semantics retained

### New request

- one template => selector hidden and default auto-applied
- multiple templates => explicit configuration selector remains
- internal/external active assignment candidates preserved subject to existing server authorization

## Checkpoints

- JS: `ef90b1e3c2bae014320f58d5876928ed013c73e9`
- CSS: `91f14a9569b54fa28f6ac7e46ea65132651cf957`
- source guards: `5cdbefb8a75d805385c0257091d88cf12db2a93b`
- interaction-test checkpoint: `17ede232e9b6c625c0c63a77f4302a1b9486f46d`
- Preview deploy checkpoint: `58054a55c56d49bb03c821f6c523257c7920050c`
- atomic Preview: `https://a636445e.code1-workspace.pages.dev`
- stable Preview: `https://coding-runtime-backend-stagi.code1-workspace.pages.dev`
- stable smoke checkpoint: `9d560b01a1956f312130883447a50a1f88f02658`

## Verification read-back

At the validated tree:

- STAGING tests = 187 total / 187 pass / 0 fail
- isolated-node-checks = SUCCESS
- locked npm audit = 0 vulnerabilities

The new `happy-dom` interaction suite dispatches actual DOM click/drag/drop events and validates:

1. OWNER one-compose/secondary-exception/collapsed-review/outline-first/single-template flow.
2. Whole drop-zone click, dragover state, two-file drop, file queue, pre-upload removal, multipart RPC flow and success state.
3. Assigned submitter/PARTNER compose/drop flow with internal review absent.

This interaction suite is regression evidence, not a substitute for `MSG-0096` real authenticated browser acceptance.

Cloudflare Pages `58054a55...` = SUCCESS.

Stable Preview smoke `9d560b01...` = SUCCESS:

- root + accounts/material JS/CSS = 200
- session configured=true / authenticated=false
- material bootstrap/get/upload-begin/submit fail closed with 401 when unauthenticated
- dynamic loader contract PASS
- remote mutation NONE

## Remaining authenticated browser QA

Do not claim completion until the following is demonstrated through existing authorized sessions.

OWNER desktop + 390px:

- coherent `자료 제출` flow
- actual multi-file drag/drop and queue/removal/progress/results
- `새 버전` drag/drop path
- exception actions secondary
- internal review separated/collapsed
- `요청 항목 관리` outline-first and secondary edit detail
- one-template selection hidden
- horizontal overflow 0
- page/console errors 0

Assigned submitter/PARTNER desktop + 390px:

- only assigned requests visible
- same coherent compose/drop behavior
- no internal review controls
- actual drag/drop gesture
- horizontal overflow 0
- page/console errors 0

If an authorized session is unavailable, stop at the auth-session blocker; never read/reset/synthesize credentials.

## Hard boundaries

- Production/main/live mutation = 0
- Production Supabase/R2 mutation = 0
- STAGING schema/migration mutation for this UX WO = 0
- credentials unchanged/not accessed
- Drive hot-path write = 0
- paid resources = none
- automatic VERIFIED/APPROVED_CURRENT/public delivery = none
- DESIGN/Figma/HOME/UIUX = untouched
- retention freeze/purge = none

## NEXT HANDOFF

1. Complete real authenticated OWNER + assigned submitter/PARTNER desktop/390 browser QA using existing sessions, including real drag/drop and console/overflow checks.
2. Fix only concrete bounded defects, if any, and rerun affected checks.
3. After truthful authenticated PASS, publish one CODING -> PLANNING `IMPLEMENTATION_EVIDENCE` for `MSG-0096` containing before/after visual evidence, click paths/results, drag/drop results, commit/Preview refs and mutation audit.
4. Do not auto-start Drive mirroring, Productionization or unrelated work.
