# CODE1 CODING BATON

Updated: 2026-09-12 05:08 KST
PLANNING_DELTA_SEQ_SEEN = 20260911-003
CROSS_TRACK_BUS_LAST_SEEN = MSG-20260912-0025

LAST_VERIFIED_ACTION: the full Cloudflare Pages Preview -> Supabase STAGING -> private R2 integration and independent inventory close are PASS. The R2 bucket contains exactly two intentional private test objects: 131072 bytes and 11534336 bytes, total 11665408 bytes; unexpected objects = 0; Production mutation = 0; legacy Drive migration = 0. Planning P0 scope correction `MSG-20260912-0025` is consumed: Local Orchestrator is NOT a CODING task and is handled only in the separate ORCHESTRATOR track/chat.

CURRENT_WORK: deploy and independently verify the staging runtime semantics correction `NOT_FOUND -> HTTP 404`. Unit/contract CI is already PASS. This BATON commit is intentionally the single non-skip Preview deployment trigger carrying the previously `[CF-Pages-Skip]` mapping/test/verifier commits.

## Fixed boundaries

- branch: `coding/runtime-backend-staging`
- base main: `a71a71eae73706862308e194110f4fcc2d25db01`
- Supabase target: STAGING ref `bsintmkyhptizrjoizfb` only
- live cutover: NOT APPROVED
- CODE1 Production: PROHIBITED
- no main/history rewrite/force push
- no Public Frontend / formal Admin / Planning SSOT / UIUX SSOT mutation
- no public R2 endpoint
- no HOOOO/INDX/IndiaDesk mutation
- no legacy Drive-media auto migration/deletion
- Production vars/secrets/bindings remain READ_ONLY
- no secret value in Git/Bus/Drive documents/chat
- Local Orchestrator work is separate ORCHESTRATOR scope only; do not execute it here.

## R2 / Preview external gate: CLOSED PASS

Pages state:

- exact Preview branch control includes only `coding/runtime-backend-staging`
- Production branch `main`
- Preview R2 `CODE1_MEDIA_BUCKET -> code1-staging-media`
- Production R2 binding NONE
- stable Preview alias `https://coding-runtime-backend-stagi.code1-workspace.pages.dev`
- Preview core runtime read-only verifier PASS

External integration + independent inventory:

```text
R2_STAGING_INTEGRATION=PASS
SMALL object bytes=131072
MULTIPART object bytes=11534336
DB linkage/private GET/retry idempotency=PASS
both test DB rows=DELETED
R2 objects retained private by policy
BUCKET_OBJECT_COUNT=2
VERIFIED_OBJECT_TOTAL_BYTES=11665408
R2_INVENTORY_READONLY_VERIFY=PASS
unexpected objects=0
Production mutation=0
legacy Drive migration=0
```

Do not rerun the upload integration simply to re-prove this gate.

## Planning scope routing

- `MSG-20260912-0021`: superseded; do not execute Orchestrator in CODING.
- `MSG-20260912-0024`: canonical Orchestrator work order, separate ORCHESTRATOR track/chat.
- `MSG-20260912-0025`: P0 scope correction consumed by CODING; existing Cloudflare/Supabase/R2/runtime-backend work continues unchanged.

## Runtime semantics correction staged

Observed defect from the completed integration: a soft-deleted media read was correctly denied, but `NOT_FOUND` fell through to generic `HTTP 400 / REQUEST_FAILED`.

Staged fix:

```text
NOT_FOUND -> HTTP 404 / error=NOT_FOUND
unknown unmapped error -> HTTP 400 / REQUEST_FAILED (unchanged)
```

Evidence:

- mapping commit `3b825e67a07bfc739651df449dbaa256da434800`
- unit regression commit `f79e11045a92c5dbe667c7860e74b61faf8073e5`
- CI `34642527599` SUCCESS
- read-only Preview verifier commit `1f276ac2f9d6c8b26f74ec40ee71ce6768a75a53`
- CI `34642626295` SUCCESS
- verifier checks the two already-soft-deleted media IDs only and performs no DB/R2 write.

This BATON update intentionally has no `[CF-Pages-Skip]` prefix so exactly one Preview deployment carries the staged fix.

## Local input preference

Do not use hidden/SecureString prompts and do not rely on clipboard-paste instructions. If a local secret is technically required, use ordinary visible input and never ask the operator to place the value in chat.

## NEXT_ATOMIC_ACTION

1. Confirm this BATON commit produced one successful Preview deployment on branch `coding/runtime-backend-staging`.
2. Run `backend/staging/scripts/verify-deleted-media-not-found.mjs` against the stable Preview alias using the existing Preview `SESSION_SECRET` locally.
3. Required PASS for both known deleted IDs:

```text
status=404
error=NOT_FOUND
DELETED_MEDIA_NOT_FOUND_VERIFY=PASS
REMOTE_MUTATION=NONE
R2_OBJECT_WRITE=NONE
```

4. After PASS, publish consolidated CODING implementation evidence to Planning and move to the next runtime-backend stabilization item. Same-action staging p50/p95 measurement is the next runnable technical candidate; no optimization before measurement.

ROLLBACK: Apps Script/Sheet/Drive remains live. Production has no R2 binding.
