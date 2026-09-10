# CODE1 CODING CURRENT

Updated: 2026-09-11
Status: PHASE 0 VERIFIED / SUPABASE STAGING SCHEMA+SECURITY+SOURCE IMPORT PASS / POST-IMPORT DB GATE PASS / R2 ACCOUNT INVENTORY VERIFIED EMPTY / R2 STAGING PROVISIONING REQUIRED
Branch: `coding/runtime-backend-staging`
Base main: `a71a71eae73706862308e194110f4fcc2d25db01`
Live cutover: NOT APPROVED
Production: PROHIBITED
PLANNING_DELTA_SEQ_SEEN = 20260910-002
CROSS_TRACK_BUS_LAST_SEEN = MSG-20260911-0006

## Current verified state

CODE1 Supabase STAGING project `bsintmkyhptizrjoizfb` has received the verified private source snapshot through the Windows operator import path. A fresh read at the start of the R2 phase reconfirmed the durable post-import counts without rerunning the import:

- workspace accounts: 2
- farms: 12
- question catalog: 231
- intake submissions: 2
- submission answer versions: 5
- media assets: 4
- media events: 5
- audit log: 29
- login guard: 3
- housing environment records: 12
- question policies/history: 0 / 0
- planning capabilities/brief versions/source artifacts: 0 / 0 / 0
- migration registry: 268

No partial import mismatch was observed. `FIRST_IMPORT` remains complete and must not be rerun.

## Security / performance post-import verification

Supabase Security Advisor after import reports WARN 0. The only security finding remains `rls_enabled_no_policy` INFO on 20 tables, intentional for the current server-only authorization boundary.

Supabase Performance Advisor remains INFO only:

- unindexed foreign keys: 23
- unused indexes: 11

No index change is authorized solely to silence these INFO notices. Query/index tuning remains gated on actual imported-workload measurements.

## R2 / private-media account inventory

The isolated code already defines a logical R2 binding `CODE1_MEDIA_BUCKET`, deterministic private object keys, short-lived upload/read tokens, R2 PUT/GET handlers, farm-access checks before read authorization, and soft-delete semantics.

The operator then ran the fail-closed local Cloudflare inventory runner with Wrangler `4.129.0`. Current authenticated account evidence is now available:

- Cloudflare account id: `7c52434598072e9bce77aa00bafa1ed3`;
- Pages project `code1-workspace` exists and resolves to `code1-workspace.pages.dev`;
- account-level `wrangler r2 bucket list` returned no bucket rows;
- downloaded Pages configuration contained no R2 binding;
- current repository `wrangler.toml` also contains no `r2_buckets` binding;
- no R2 bucket, binding, object, public URL, custom domain, CORS, lifecycle rule, or lock rule was created or changed during the inventory.

Result: the prior ambiguity is resolved as `R2_ACCOUNT_INVENTORY_EMPTY`. There is no existing CODE1 R2 resource to select and no other-project R2 bucket to reuse. The next R2 step is deliberate creation of a new CODE1 STAGING-only private bucket, then immediate read-only verification before adding a Pages binding or writing objects.

Proposed exact bucket identity for that staging-only resource: `code1-staging-media`.

Cloudflare R2 buckets are private by default. Keep the default private state; do not enable r2.dev or a custom public domain for this media path. Binding name remains `CODE1_MEDIA_BUCKET`.

The four imported legacy farm-media rows are all `GOOGLE_DRIVE_LEGACY`, `object_key = NULL`, and currently `DELETED`. Their Drive originals still exist privately, and MIME/byte size match the DB metadata for all four. SHA-256 values were calculated from the actual source bytes and stored only in private Drive manifest `CODE1_SOURCE_MEDIA_MANIFEST_20260911` inside `[PRIVATE] CODE1 STAGING MIGRATION`. These deleted sources are held as `HOLD_DELETED_RETENTION`; they are not migration candidates merely because a new R2 bucket is created.

The code audit also found a cutover compatibility blocker: the current internal-web high-resolution client calls `mediaUpload.begin -> mediaUpload.chunk -> mediaUpload.finish`, while the staging dispatcher does not implement `mediaUpload.chunk`. Retry-idempotency gaps also remain for repeated begin/finalization, and the <=8 MiB path needs orphan-object compensation/reconciliation if DB metadata commit fails after R2 write.

Detailed evidence is in `docs/coding/R2_PRIVATE_MEDIA_AUDIT_20260911.md`.

## R2 contract-test state

Additional isolated contract tests cover media PUT/GET fail-closed behavior, token denial, exact content-length/MIME enforcement, exact private object-key write to a mock binding, missing-object response, and private read headers. These tests do not constitute actual R2 integration or browser PASS.

## Source boundary retained

The verified private source snapshot remains outside Git in Drive folder `[PRIVATE] CODE1 STAGING MIGRATION`. The source Sheet itself was not silently changed.

`01_농가_Master` rows 501-512 remain a stale sparse duplicate `GF-ORIGIN-01..12` block. The verified migration snapshot used rows 2-13 only. Source cleanup remains a separate explicit decision.

Legacy DECK media rows 2 remain excluded from the farm runtime import. Housing environment blank/`미확인` values remain NULL / UNCONFIRMED; code 1 was not auto-filled. Existing admin roles were not auto-granted Planning capabilities.

## Runtime / environment boundary

Current live Internal Workspace remains the existing Cloudflare -> Apps Script -> Google Sheet/Drive runtime. No live cutover or dual-write has been enabled.

No Public Frontend, formal Admin, main, CODE1 Production, HOOOO Supabase/Cloudflare/Git, INDX, or IndiaDesk environment was changed.

## OPEN / WAITING

- CODE1 STAGING R2 bucket: `NOT_YET_CREATED`; proposed exact name `code1-staging-media`
- Pages binding `CODE1_MEDIA_BUCKET`: NOT_YET_CONFIGURED
- `mediaUpload.chunk` staging compatibility: OPEN
- media begin/finish retry idempotency: OPEN
- small-upload orphan-object compensation/reconciliation: OPEN
- actual R2 PUT/HEAD/private GET/security integration: WAITING bucket creation + read-only bucket verification + binding
- actual same-action performance baseline/new p50/p95 measurement: WAITING runnable Supabase/R2-backed staging path; current statement `NO_BASELINE`
- stale source duplicate rows 501-512 cleanup: OPEN_SEPARATE_DECISION
- npm dependency findings 3 high + 1 critical: OPEN_SEPARATE_HARDENING
- Drive root hygiene `MSG-20260911-0005`: NEEDS_REVIEW / connector write authorization blocked; no move occurred
- live cutover: NOT APPROVED
- Production creation/deploy: PROHIBITED

## Next atomic action

Create exactly one new R2 bucket for CODE1 STAGING, proposed name `code1-staging-media`, in the verified Cloudflare account. Do not enable public access and do not upload objects yet. Immediately rerun the read-only audit with `--bucket code1-staging-media` and verify bucket identity/private state, r2.dev/custom-domain state, CORS, lifecycle, lock rules, and empty object state. Only after that bucket gate passes should the branch add `[[r2_buckets]] binding = "CODE1_MEDIA_BUCKET"` and the exact bucket name, then close the `mediaUpload.chunk` compatibility and retry/compensation gaps before any staging object write. Do not migrate the four deleted legacy Drive sources and do not perform live cutover without separate approval.
