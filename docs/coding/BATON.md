# CODE1 CODING BATON

Updated: 2026-09-14 KST
PLANNING_DELTA_SEQ_SEEN = 20260913-041
CROSS_TRACK_BUS_LAST_SEEN = MSG-20260913-0092
LAST_PLANNING_INBOUND_CONSUMED = MSG-20260912-0065
LAST_CODING_OUTBOUND = MSG-20260912-0064

LAST_VERIFIED_ACTION: `WO-20260913-CODING-MATERIAL-INGEST-001 / REV B` reached STAGING technical PASS. Applied migrations `planning_material_workspace_0021`, `planning_material_acceptance_0022`, `planning_material_transactional_acceptance_0023` are present in Supabase STAGING; synthetic acceptance residue is 0; Cloudflare Pages Preview deploy and credential-free read-only live smoke passed. Durable evidence is `docs/coding/PLANNING_MATERIAL_REV_B_EVIDENCE_20260914.md`.

## Active authority

Planning `MSG-20260913-0092 / Delta041` is the controlling Work Order authority.

`MSG-20260913-0091 / Delta040` is SUPERSEDED.

The domain is a separate internal `경영·기획` Planning Material workspace, not farm questionnaire intake.

Exact tab contract:

`기획문서` -> `상세페이지 및 제안서 파일` -> `해야 할 일`

## Technical checkpoint

Pre-work base: `a2a5a097dc27bf841ffe16c6c041ac08470011f9`.

Preview deployment commit: `cea50d617566c1243f86874b7868ce4014e77112`.

Read-only smoke technical checkpoint: `4b28c22a7efa64c348649d18018cd80e4f1a7ee7`.

Durable evidence commit starts at `7012b64406b88d9abd24c28f40ebe34e1129bb96`; CURRENT/BATON closeout commits follow on the same staging branch.

## Implemented REV B boundaries

- additive Planning Material schema, not farm questionnaire model reuse
- exact seven default material labels
- versioned template mutations with immutable request snapshots
- SUPER_ADMIN template add/rename/reorder/required/archive controls
- separate PARTNER role with assigned-request-only upload access
- unassigned access denied
- private R2 original-byte authority
- checksum/object-key/idempotency/version history
- review/audit history
- deterministic Planning manifest and checksum
- non-public Planning source artifact
- deduplicated Planning-impact OPS event/outbox on submission/review-ready transition
- no public delivery by default
- no Drive hot-path dual-write

## Live acceptance read-back

Supabase STAGING migrations:

- `planning_material_workspace_0021`
- `planning_material_acceptance_0022`
- `planning_material_transactional_acceptance_0023`

Synthetic residue after transactional acceptance:

- QA accounts 0
- QA template 0
- QA media 0
- QA request 0
- Planning Material QA OPS events 0

Cloudflare Pages deployment `cea50d61...`: SUCCESS.

Atomic Preview: `https://4f46d39c.code1-workspace.pages.dev`.

Stable Preview: `https://coding-runtime-backend-stagi.code1-workspace.pages.dev`.

Read-only Preview smoke PASS:

- root and required JS/CSS assets 200
- dynamic module loader contract PASS
- session configured=true, authenticated=false
- unauthenticated Planning Material bootstrap/get/upload-begin/submit RPCs -> 401 `UNAUTHENTICATED`
- remote mutation NONE

GitHub isolated-node-checks at final technical checkpoint: SUCCESS.

## Remaining acceptance gate

Authenticated OWNER/PARTNER visual/click browser acceptance is not claimed. CODING did not read, reset, synthesize or expose credentials to fabricate this gate.

Planning may accept the technical closeout as-is, request explicit authorized browser acceptance, or dispatch a follow-on Work Order. CODING must not infer that decision.

## Hard boundaries

- Production/main/live mutation = 0
- Production Supabase/R2 mutation = 0
- credentials = unchanged
- paid resources = none
- Drive hot-path write = none
- automatic VERIFIED/APPROVED_CURRENT/public delivery = none
- DESIGN/Figma/HOME/UIUX = untouched
- retention freeze/purge = none

## NEXT HANDOFF

1. Fresh-read Message Bus immediately before mutation.
2. Append one CODING -> PLANNING implementation evidence row for REV B.
3. Update CODING TRACK_STATE to technical-pass / Planning-review-pending and read back both mutations.
4. Stop until Planning response; do not auto-start Drive mirroring, Productionization, or unrelated work.
