# CODE1 CODING BATON

Updated: 2026-09-12 05:52 KST
PLANNING_DELTA_SEQ_SEEN = 20260911-003
CROSS_TRACK_BUS_LAST_SEEN = MSG-20260912-0027

LAST_VERIFIED_ACTION: CODE1 Preview/Supabase STAGING/private-R2 external integration is CLOSED PASS; deleted-media `NOT_FOUND -> HTTP 404` is LIVE PASS; read-only latency baseline is recorded; dependency security hardening is CLOSED PASS; real browser `owner` ID/password login and session restore are CLOSED PASS.

CURRENT_WORK: browser auth is verified. Farm/question-policy/account flows run on Supabase STAGING. Aza Mall Deck is blocked because `deckAssets/deckBootstrap/saveDeck` still intentionally route through the legacy bridge while Preview has no `BRIDGE_URL/BRIDGE_SECRET`. Do not attach Preview to Production bridge values by assumption. Planning decision request is published as `MSG-20260912-0027` and is PENDING.

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
- Production vars/secrets/bindings READ_ONLY
- no secret value in Git/Bus/Drive docs/chat
- Local Orchestrator is separate ORCHESTRATOR scope only.

## Verified external backend gate

```text
Preview branch = coding/runtime-backend-staging only
Production branch = main
Preview R2 = CODE1_MEDIA_BUCKET -> code1-staging-media
Production R2 = NONE
stable Preview = https://coding-runtime-backend-stagi.code1-workspace.pages.dev
R2_STAGING_INTEGRATION=PASS
BUCKET_OBJECT_COUNT=2
VERIFIED_OBJECT_TOTAL_BYTES=11665408
unexpected objects=0
Production mutation=0
legacy Drive migration=0
```

Do not rerun actual upload integration merely to re-prove this gate.

## Runtime semantics: LIVE PASS

Single Preview trigger `a6556d46948ccc1a9936eacaea4867de97647a43` succeeded. Both known soft-deleted R2 test media return exact `HTTP 404 / error=NOT_FOUND`; verification performed no DB/R2 write.

## Read-only latency baseline

```text
bootstrap      n=30 p50=51.8ms p95=64.3ms mean=53.2ms min=48.6ms max=65.5ms
getSubmission n=30 p50=53.6ms p95=67.5ms mean=59.8ms min=48.3ms max=218.3ms
REMOTE_MUTATION=NONE
R2_OBJECT_WRITE=NONE
PERFORMANCE_THRESHOLD=NOT_SET_MEASUREMENT_ONLY
```

The p50/p95 distributions align closely. With the project percentile implementation and 30 samples, only one `getSubmission` sample lies above the 67.5 ms p95 boundary. Treat 218.3 ms as an isolated observed outlier unless later evidence proves recurrence. Do not optimize from this run alone.

## Dependency security hardening: PASS

- `jspdf` -> `^4.2.1`
- `wrangler` -> `^4.131.1`, clearing transitive `miniflare`/`sharp` advisories.

Atomic manifest upgrade commit: `2d7eb63374b61072ce2d132d4efe566508664aa2`.

```text
npm ci
62/62 staging tests PASS
npm audit total=0
known root baseline remains exact pre-existing 5 failures
build PASS
```

PDF major-version smoke uses real `public/assets/RequestFont.ttf`, executes CODE1 `requestDocument()`, and validates `%PDF-` output. Final CI run `34644776006` SUCCESS.

## Browser password login: CLOSED PASS

Preview has a STAGING-only `PASSWORD_PEPPER`; value is not recorded.

Operator E2E:

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

Manual browser verification:

- `owner` login succeeded;
- SUPER_ADMIN identity/account management visible;
- Farm workspace loaded Supabase STAGING data;
- Question-policy management loaded;
- F5 briefly showed login then automatically returned to the authenticated workspace, proving real browser cookie/session restore.

The brief login-screen flash is a UX issue caused by asynchronous `restoreSession()` after initial login markup is already visible. It is not session loss. Route separately under appropriate UI ownership or an explicit atomic coding task.

## Deck blocker: PLANNING DECISION REQUIRED

Manual browser Deck entry reproduces `SETUP_REQUIRED`.

`functions/api/rpc.js` explicitly keeps `deckAssets`, `deckBootstrap`, and `saveDeck` outside Supabase STAGING ownership and routes them through `bridge(...)`. Preview intentionally has no `BRIDGE_URL/BRIDGE_SECRET`.

Do not copy Production bridge values into Preview by assumption; that could expose the live Apps Script/Sheet/Drive rollback source to STAGING deck writes.

Planning must choose:

1. a specifically isolated/staging-safe legacy bridge contract; or
2. Deck migration to Supabase STAGING/private staging storage.

Until then Deck remains fail-closed.

## Planning routing

- `MSG-20260912-0021`: superseded; do not execute Orchestrator in CODING.
- `MSG-20260912-0024`: ORCHESTRATOR-only, separate chat/track.
- `MSG-20260912-0025`: P0 CODING scope correction APPLIED.
- `MSG-20260912-0026`: CODING -> PLANNING consolidated implementation evidence PENDING at last readback.
- `MSG-20260912-0027`: CODING -> PLANNING architecture decision request PENDING; browser auth CLOSED PASS + Deck legacy-bridge blocker, requesting staging-safe bridge vs Supabase STAGING Deck migration decision.

## Known baseline / ownership

Five root failures remain pre-existing and unchanged: deck UI fixture, legacy media-organizer naming expectation, two media UX expectations, legacy migration fetch fixture. Do not fold them into backend hardening without an explicit owner/task decision. Stale source duplicate rows 501-512 remain Planning/data decision.

## Local input preference

No hidden/SecureString prompts and no clipboard-dependent secret workflow. Visible local input only if technically required; no secret in chat/durable docs.

## NEXT_ATOMIC_ACTION

1. Await Planning response to `MSG-20260912-0027` before enabling Deck in Preview.
2. Do not copy Production bridge values into Preview while waiting.
3. Hold Production/main/live Apps Script/Sheet/Drive unchanged.
4. Keep auth-flash UX issue separate from the Deck architecture decision.

ROLLBACK: Apps Script/Sheet/Drive remains live. Production has no R2 binding.
