# CODE1 CODING CURRENT

Updated: 2026-09-12 05:52 KST
Status: SUPABASE STAGING + PRIVATE R2 EXTERNAL GATE PASS / NOT_FOUND 404 LIVE PASS / READONLY LATENCY BASELINE RECORDED / NPM SECURITY HARDENING PASS / BROWSER PASSWORD LOGIN CLOSED PASS / DECK LEGACY-BRIDGE BLOCKED
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

Previous root audit reproduced `3 high + 1 critical`, reduced to two dependency axes and fixed:

- `jspdf` -> `^4.2.1`;
- `wrangler` -> `^4.131.1`, clearing transitive `miniflare`/`sharp` advisories.

Atomic manifest upgrade commit: `2d7eb63374b61072ce2d132d4efe566508664aa2`.

```text
staging tests = 62/62 PASS (includes jsPDF runtime smoke)
npm ci = found 0 vulnerabilities
npm audit = info 0 / low 0 / moderate 0 / high 0 / critical 0
known root baseline = exactly the same pre-existing 5 failures
build = PASS
```

Final dependency CI run `34644776006` = SUCCESS. Security/CI/docs hardening commits did not mutate Production.

## Browser password login E2E: CLOSED PASS

Preview has a STAGING-only `PASSWORD_PEPPER`. No secret value is recorded in Git, Bus, docs, or chat.

Supabase STAGING imported account credential state before reset:

```text
OWNER / username=owner / role=SUPER_ADMIN / active
U_c57fa35e82c240a0897da89a / username=art_67 / role=ADMIN / active
scheme=pbkdf2-sha256-pepper-v1 / iterations=100000 / salt+hash present
```

Operator bootstrap result against stable Preview:

```text
STAGING_OWNER_PASSWORD_RESET=PASS newSessionVersion=3
PASSWORD_LOGIN=PASS account=OWNER sessionVersion=3
SESSION_RESTORE=PASS googleEnabled=false
AUTHENTICATED_BOOTSTRAP=PASS backend=SUPABASE_STAGING
LOGOUT=PASS
STAGING_WEB_LOGIN_E2E=PASS
PRODUCTION_MUTATION=NONE
LEGACY_DRIVE_MUTATION=NONE
R2_OBJECT_WRITE=NONE
```

Manual browser verification also PASS:

- `owner` ID/password login opened the authenticated workspace.
- SUPER_ADMIN identity and account-management navigation were visible.
- Farm workspace loaded real Supabase STAGING farms/questions/submission data.
- Question-policy management opened successfully.
- F5 caused a short login-screen flash and then returned automatically to the authenticated workspace, confirming cookie/session restore succeeds in the real browser path.

The brief login-screen flash is a UX defect, not an authentication failure. Current `public/assets/app.js` calls asynchronous `restoreSession()` after the login section is already visible in initial HTML. Do not conflate this with session loss. Route/fix only within the appropriate UI ownership or an explicit atomic coding task.

## Deck integration blocker: PLANNING DECISION REQUIRED

Manual browser verification reproduced `SETUP_REQUIRED` when opening the Aza Mall proposal deck.

Root cause is explicit in `functions/api/rpc.js`:

```text
legacyDeckActions = deckAssets, deckBootstrap, saveDeck
SUPABASE_STAGING + legacyDeckAction -> existing bridge(env, user, action, body)
```

The Preview environment intentionally has no `BRIDGE_URL` or `BRIDGE_SECRET`; therefore the deck fails closed with `SETUP_REQUIRED`.

Do NOT copy Production `BRIDGE_URL/BRIDGE_SECRET` into Preview by assumption. Doing so could make STAGING Preview deck writes reach the live Apps Script/Sheet/Drive rollback source.

Planning/architecture must choose one bounded path before CODING proceeds on Deck:

1. approve a specifically isolated/read-only or staging-safe legacy bridge contract for Preview; or
2. migrate Deck read/write runtime into Supabase STAGING/private staging storage before enabling it.

Until that decision, farm/question/account/password flows continue on Supabase STAGING and Deck remains intentionally blocked.

## Known pre-existing root baseline

Five root-suite failures remain exactly unchanged from before this STAGING work:

1. deck text side-panel/toast fixture failure;
2. legacy Drive media-organizer naming expectation;
3. media upload UX grouped-card expectation;
4. media shot-search expectation;
5. legacy migration test fetch fixture.

Do not opportunistically change these as part of backend hardening. UI-facing items require their owning track; legacy Apps Script/Drive changes require an explicit atomic task. Stale source duplicate rows 501-512 remain a Planning/data decision.

## Local input preference

Do not use hidden/SecureString prompts or clipboard-dependent secret instructions. If local secret entry is technically unavoidable, use ordinary visible input and never put the value in chat or durable project documents.

## Cross-track sync

- `MSG-20260912-0026`: CODING -> PLANNING consolidated implementation evidence, PENDING at last readback.
- `MSG-20260912-0025`: scope correction APPLIED; Local Orchestrator remains outside CODING.
- Browser password-login/session-restore gate is now CLOSED PASS.
- Deck legacy-bridge strategy now requires a Planning decision; CODING must not attach Preview to Production bridge values by assumption.

## NEXT_ATOMIC_ACTION

1. Publish/route the browser-login CLOSED PASS plus Deck `SETUP_REQUIRED` blocker to Planning.
2. Await an explicit Deck architecture decision: isolated staging-safe bridge vs Supabase STAGING deck migration.
3. Keep Production/main/live Apps Script/Sheet/Drive unchanged while waiting.
4. Auth-flash UX issue may be routed separately; do not mix it into the Deck architecture decision.

ROLLBACK: Apps Script/Sheet/Drive remains live. Production has no R2 binding.
