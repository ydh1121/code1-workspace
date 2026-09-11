# CODE1 CODING CURRENT

Updated: 2026-09-12 05:46 KST
Status: SUPABASE STAGING + PRIVATE R2 EXTERNAL GATE PASS / NOT_FOUND 404 LIVE PASS / READONLY LATENCY BASELINE RECORDED / NPM SECURITY HARDENING PASS / PASSWORD LOGIN E2E IN PROGRESS
Branch: `coding/runtime-backend-staging`
Base main: `a71a71eae73706862308e194110f4fcc2d25db01`
Live cutover: NOT APPROVED
Production: PROHIBITED
PLANNING_DELTA_SEQ_SEEN = 20260911-003
CROSS_TRACK_BUS_LAST_SEEN = MSG-20260912-0026

## Hard boundaries

- CODING/STAGING only. Do not modify `main`, CODE1 Production, live Public Frontend, formal Admin, Planning/UIUX SSOT, HOOOO, INDX, or IndiaDesk.
- Apps Script/Sheet/Drive remains the live rollback source until separate cutover approval.
- Supabase FIRST_IMPORT is complete; do not rerun it.
- Do not migrate/delete the four legacy Drive media rows merely because R2 exists.
- R2 remains private: no `r2.dev`, no custom R2 domain, no browser-visible credential.
- Production variables/secrets/bindings remain READ_ONLY.
- No secret value in Git, Message Bus, Drive documents, or chat.
- Local Orchestrator is OUT OF SCOPE here. `MSG-20260912-0024` belongs only to the separate ORCHESTRATOR track; `MSG-20260912-0025` scope correction is APPLIED.

## Durable STAGING state

Supabase STAGING ref: `bsintmkyhptizrjoizfb` only. FIRST_IMPORT remains `VERIFIED_COMPLETE`.

Pages Preview isolation is PASS:

```text
productionBranch = main
previewDeploymentSetting = custom
previewBranchIncludes = ["coding/runtime-backend-staging"]
previewBranchExcludes = []
Preview R2: CODE1_MEDIA_BUCKET -> code1-staging-media
Production R2 binding: NONE
Stable Preview: https://coding-runtime-backend-stagi.code1-workspace.pages.dev
```

Preview core runtime, actual private-R2 integration, Supabase readback, and independent R2 inventory all PASS. R2 currently contains exactly two intentional private test objects, 131072 bytes and 11534336 bytes, total 11665408 bytes. Unexpected objects = 0; Production mutation = 0; legacy Drive migration = 0. Do not rerun the upload integration merely to re-prove this gate.

## Runtime semantics: CLOSED PASS

Soft-deleted media now maps exact domain `NOT_FOUND` to `HTTP 404 / error=NOT_FOUND`; unknown runtime failures remain generic HTTP 400. Live Preview verification passed for both known soft-deleted test media IDs with `REMOTE_MUTATION=NONE` and `R2_OBJECT_WRITE=NONE`.

Single live Preview trigger carrying this correction: `a6556d46948ccc1a9936eacaea4867de97647a43` -> SUCCESS.

## STAGING read-only latency baseline: RECORDED

Operator ran the stable-Preview read-only benchmark once: 3 warmups + 30 sequential measured requests per action.

```text
SIGNED_SESSION=PASS
bootstrapBackend=SUPABASE_STAGING
bootstrap:      p50=51.8ms  p95=64.3ms  mean=53.2ms  min=48.6ms  max=65.5ms
getSubmission: p50=53.6ms  p95=67.5ms  mean=59.8ms  min=48.3ms  max=218.3ms
STAGING_READONLY_LATENCY_BENCH=PASS
REMOTE_MUTATION=NONE
R2_OBJECT_WRITE=NONE
PERFORMANCE_THRESHOLD=NOT_SET_MEASUREMENT_ONLY
```

Interpretation: the typical and p95 distributions for both reads are approximately 50-70 ms and closely aligned. With 30 samples and the project percentile implementation, p95 is the 29th ordered sample; therefore `getSubmission max=218.3ms` represents one sample above the 67.5 ms p95 boundary, not a sustained slow path. No performance threshold was approved, so no optimization is justified from this measurement alone.

## Dependency security hardening: CLOSED PASS

Previous root audit reproduced `3 high + 1 critical`, which reduced to two dependency axes:

- direct production `jspdf` critical, fixed by `4.2.1`;
- direct dev `wrangler` high plus transitive `miniflare`/`sharp`, fixed by `4.131.1` dependency graph.

Validated upgrade was first tested in an ephemeral CI workspace, then applied atomically to `package.json` + `package-lock.json` by commit `2d7eb63374b61072ce2d132d4efe566508664aa2`.

Current locked manifest:

```text
jspdf   ^4.2.1
wrangler ^4.131.1
```

Strict CI now enforces the locked dependency audit without applying automatic fixes. Final evidence:

```text
staging tests = 62/62 PASS (includes jsPDF runtime smoke)
npm ci = found 0 vulnerabilities
npm audit = info 0 / low 0 / moderate 0 / high 0 / critical 0
known root baseline = exactly the same pre-existing 5 failures
build = PASS
```

The jsPDF major-version runtime smoke uses the actual `public/assets/RequestFont.ttf`, executes CODE1 `requestDocument()`, and verifies a non-trivial `%PDF-` document is produced under jsPDF 4.2.1. First smoke run failed only because the old CI order executed staging tests before `npm ci`; workflow order was corrected and final run `34644776006` is SUCCESS.

All dependency/security commits use `[CF-Pages-Skip]`; no Preview or Production deployment was caused by this hardening.

## Password login E2E: IN PROGRESS

Supabase STAGING readback confirms both imported active accounts have valid password credentials:

```text
OWNER / username=owner / role=SUPER_ADMIN / session_version=2
U_c57fa35e82c240a0897da89a / username=art_67 / role=ADMIN / session_version=1
scheme=pbkdf2-sha256-pepper-v1 / iterations=100000 / salt+hash present
```

The Preview environment now has a STAGING-only `PASSWORD_PEPPER` Secret added by the operator. No value is recorded here. Because password hashes are pepper-bound, the imported OWNER credential will be replaced only in STAGING through the existing authenticated account-password path; Production and legacy Drive remain untouched.

Prepared verification scripts:

```text
backend/staging/scripts/bootstrap-owner-web-login-staging.mjs
backend/staging/scripts/run-owner-web-login-bootstrap.ps1
```

The verifier uses the existing `/api/accounts` password-change path and then exercises real `/api/auth/password` login, session restore, authenticated bootstrap, and logout. Local secret/password prompts are visible plain-text input per operator preference; no values are written to Git or durable docs.

This commit intentionally triggers exactly one new Preview deployment so the newly added Preview `PASSWORD_PEPPER` becomes active.

## Known pre-existing root baseline

Five root-suite failures remain exactly unchanged from before this STAGING work:

1. deck text side-panel/toast fixture failure;
2. legacy Drive media-organizer naming expectation;
3. media upload UX grouped-card expectation;
4. media shot-search expectation;
5. legacy migration test fetch fixture.

Do not opportunistically change these as part of backend hardening. UI-facing items require their owning track; legacy Apps Script/Drive changes require an explicit atomic task. Stale source duplicate rows 501-512 also remain a Planning/data decision.

## Local input preference

Do not use hidden/SecureString prompts or clipboard-dependent secret instructions. If local secret entry is technically unavoidable, use ordinary visible input and never put the value in chat or durable project documents.

## Cross-track sync

- `MSG-20260912-0026`: CODING -> PLANNING consolidated implementation evidence, PENDING.
- No newer PLANNING -> CODING instruction was present immediately after append/readback.
- Password-login E2E is a continuation of the existing STAGING runtime verification scope; no new Planning policy decision is required.

## NEXT_ATOMIC_ACTION

1. Confirm the intentional Preview deployment from this commit succeeds on `coding/runtime-backend-staging`.
2. Run `run-owner-web-login-bootstrap.ps1` with current Preview `SESSION_SECRET`, a new 12-128 character STAGING OWNER password, and current OWNER session version 2.
3. Require password reset -> real `/api/auth/password` -> session restore -> authenticated bootstrap -> logout all PASS.
4. Then perform one manual browser login as `owner` with the new STAGING-only password and verify refresh/session persistence and logout/re-login behavior.
5. Production/main/legacy Drive remain untouched.

ROLLBACK: Apps Script/Sheet/Drive remains live. Production has no R2 binding.
