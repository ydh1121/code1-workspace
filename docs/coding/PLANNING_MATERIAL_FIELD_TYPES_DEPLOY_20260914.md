# CODE1 Planning Material Field Types — STAGING deploy checkpoint

Authority: `MSG-20260914-0099` / `WO-20260914-CODING-MATERIAL-FIELD-TYPES-001` / Planning Delta `20260914-048`.

Scope is STAGING only. Production/main/live, Production Supabase/R2, legacy Google/Drive hot-path and credentials are untouched.

## Implemented model

- Explicit template `response_kind`: `TEXT`, `LONG_TEXT`, `FILE`, `TEXT_FILE`.
- Immutable `response_kind_snapshot` on newly created request items.
- Existing request snapshots remain legacy-compatible and are not rewritten.
- Required validation follows response kind.
- Text-only items reject planning-material file containers.
- File-only items reject text as their normal response channel.
- Explicit `DRAFT -> PREVIEW -> PUBLISH` lifecycle.
- New requests snapshot only the current published revision.
- Never-published draft items can be physically deleted.
- Previously published items removed from the current configuration are excluded from future requests while prior request snapshots remain.
- MSG-0096 drag/drop, queue/progress/reupload and internal-review separation are preserved.

## Database checkpoints

Supabase STAGING project: `bsintmkyhptizrjoizfb`.

Applied:
- `planning_material_field_types_lifecycle_0024`
- `planning_material_field_types_acceptance_0025`

Transactional synthetic acceptance covers required TEXT, required FILE, explicit TEXT_FILE, draft isolation/delete, publish-only future request snapshots, and historical preservation after published-item removal. Synthetic residue is zero.

Existing pre-0024 request-item read-back remained 14 rows with all 14 legacy response-kind snapshots NULL and unchanged legacy fingerprint `0badfd86ac001a1dcd9441a7868c8f3a`.

## Code verification before deployment

At pre-deploy source checkpoint `70f582b8ef896ca470038426d211efd2774c1d1c`, isolated STAGING tests passed 199/199 with locked npm audit 0. Acceptance source was then added at `aa55258a27c18c00810ae0061e24338515a5b304`; its isolated-node-checks also passed.

This commit intentionally triggers the normal Cloudflare Pages STAGING deployment so the browser surface can be read back and authenticated role QA can proceed.
