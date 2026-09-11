# CODE1 CODING BATON

Updated: 2026-09-12 05:16 KST
PLANNING_DELTA_SEQ_SEEN = 20260911-003
CROSS_TRACK_BUS_LAST_SEEN = MSG-20260912-0025

LAST_VERIFIED_ACTION: Cloudflare Pages Preview -> Supabase STAGING -> private R2 integration/inventory are CLOSED PASS, and the follow-up runtime semantics defect is also CLOSED PASS in live Preview. Single controlled deployment commit `a6556d46948ccc1a9936eacaea4867de97647a43` succeeded; both known soft-deleted test media IDs now return exact `HTTP 404 / error=NOT_FOUND`, with `REMOTE_MUTATION=NONE` and `R2_OBJECT_WRITE=NONE`.

CURRENT_WORK: measure same-action read-only STAGING latency before attempting any optimization. Prepared benchmark performs sequential Preview RPC measurements for `bootstrap` and `getSubmission`, with 3 warmups + 30 measured runs each and reports p50/p95/mean/min/max. No performance threshold is invented; this is measurement-only.

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
- `MSG-20260912-0025`: P0 scope correction APPLIED; existing Cloudflare/Supabase/R2/runtime-backend work continues unchanged.

## Runtime semantics correction: LIVE PASS

Observed integration defect was generic `HTTP 400 / REQUEST_FAILED` for a soft-deleted media read even though the domain error was `NOT_FOUND`.

Correction now deployed and independently verified:

```text
NOT_FOUND -> HTTP 404 / error=NOT_FOUND
unknown unmapped error -> HTTP 400 / REQUEST_FAILED
```

Evidence:

- mapping commit `3b825e67a07bfc739651df449dbaa256da434800`
- unit regression commit `f79e11045a92c5dbe667c7860e74b61faf8073e5`
- verifier commit `1f276ac2f9d6c8b26f74ec40ee71ce6768a75a53`
- single Preview deployment trigger `a6556d46948ccc1a9936eacaea4867de97647a43` -> SUCCESS
- visible local verifier wrapper `backend/staging/scripts/run-deleted-media-not-found.ps1`

Live Preview result:

```text
SIGNED_SESSION=PASS
DELETED_MEDIA_NOT_FOUND=PASS mediaId=M_32c63189358249c2844869a4 status=404 error=NOT_FOUND
DELETED_MEDIA_NOT_FOUND=PASS mediaId=M_6132c51925d449b2b5b2e402 status=404 error=NOT_FOUND
DELETED_MEDIA_NOT_FOUND_VERIFY=PASS
REMOTE_MUTATION=NONE
R2_OBJECT_WRITE=NONE
```

## Read-only latency benchmark prepared

Files:

- `backend/staging/scripts/benchmark-pages-staging-readonly.mjs`
- `backend/staging/scripts/run-pages-staging-readonly-benchmark.ps1`

Contract:

```text
Preview stable alias only
signed existing STAGING session
bootstrap: 3 warmups + 30 measured sequential runs
getSubmission: 3 warmups + 30 measured sequential runs
report: p50/p95/mean/min/max
PERFORMANCE_THRESHOLD=NOT_SET_MEASUREMENT_ONLY
REMOTE_MUTATION=NONE
R2_OBJECT_WRITE=NONE
```

No tuning or architectural conclusion is allowed before the measured evidence is recorded.

## Local input preference

Do not use hidden/SecureString prompts and do not rely on clipboard-paste instructions. If a local secret is technically required, use ordinary visible input and never ask the operator to place the value in chat.

## NEXT_ATOMIC_ACTION

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File backend/staging/scripts/run-pages-staging-readonly-benchmark.ps1
```

Required evidence shape:

```text
SIGNED_SESSION=PASS
bootstrapBackend=SUPABASE_STAGING
BENCH_CASE=bootstrap runs=30 p50_ms=... p95_ms=... mean_ms=... min_ms=... max_ms=...
BENCH_CASE=getSubmission runs=30 p50_ms=... p95_ms=... mean_ms=... min_ms=... max_ms=...
STAGING_READONLY_LATENCY_BENCH=PASS cases=2
REMOTE_MUTATION=NONE
R2_OBJECT_WRITE=NONE
```

After measurement, compare the two action distributions and choose the next runtime-backend stabilization item from evidence only.

ROLLBACK: Apps Script/Sheet/Drive remains live. Production has no R2 binding.
