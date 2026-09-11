# CODE1 CODING CURRENT

Updated: 2026-09-12 06:28 KST
Status: CORE STAGING GATES PASS / BROWSER AUTH PASS / DECK MIGRATION OPTION B / PHASE A SOURCE AUDIT PASS / PHASE B TARGET DESIGN ACTIVE
Branch: `coding/runtime-backend-staging`
Base main: `a71a71eae73706862308e194110f4fcc2d25db01`
Live cutover: NOT APPROVED
Production: PROHIBITED
PLANNING_DELTA_SEQ_SEEN = 20260912-004
CROSS_TRACK_BUS_LAST_SEEN = MSG-20260912-0028

## Hard boundaries

- CODING/STAGING only. Do not modify `main`, CODE1 Production, live Public Frontend, formal Admin, Planning/UIUX SSOT, HOOOO, INDX, or IndiaDesk.
- Apps Script/Sheet/Drive remains the live rollback source until separate cutover approval.
- Supabase FIRST_IMPORT is complete; do not rerun it.
- R2 remains private: no `r2.dev`, no custom R2 domain, no browser-visible credential.
- Production variables/secrets/bindings remain READ_ONLY.
- Never copy Production `BRIDGE_URL` / `BRIDGE_SECRET` into Preview by assumption.
- No live Apps Script/Sheet/Drive mutation during Deck migration.
- No secret value in Git, Message Bus, Drive documents, or chat.
- Local Orchestrator is OUT OF SCOPE here and remains in its separate ORCHESTRATOR track.

## Verified STAGING baseline — retained

Supabase STAGING ref: `bsintmkyhptizrjoizfb`. FIRST_IMPORT remains `VERIFIED_COMPLETE`.

```text
Preview branch = coding/runtime-backend-staging only
Production branch = main
Stable Preview = https://coding-runtime-backend-stagi.code1-workspace.pages.dev
Preview R2 = CODE1_MEDIA_BUCKET -> code1-staging-media
Production R2 = NONE
R2_STAGING_INTEGRATION=PASS
R2 intentional objects=2 / 11,665,408 bytes
unexpected R2 objects=0
soft-deleted media NOT_FOUND -> HTTP 404 LIVE PASS
npm audit total=0
staging tests=62/62 PASS before Deck migration work
browser owner password login/session restore=PASS
Production mutation=0
legacy Drive migration=0
```

Recorded read-only latency baseline remains:

```text
bootstrap      n=30 p50=51.8ms p95=64.3ms
getSubmission n=30 p50=53.6ms p95=67.5ms
PERFORMANCE_THRESHOLD=NOT_SET_MEASUREMENT_ONLY
```

Do not rerun destructive/integration gates merely to re-prove them.

## Planning decision — Deck Option B

`MSG-20260912-0028` / `WO-20260912-CODING-DECK-001` is the current P0 CODING work order. Planning accepted CODING evidence 0026/0027 and selected:

> Migrate Preview Deck read/write to Supabase STAGING + existing private STAGING storage.

Explicit prohibitions remain:

- no Production bridge secret reuse;
- no Preview Deck write to live Apps Script/Sheet/Drive;
- no destructive source migration;
- copy-first and reversible only;
- exact current Deck contract/content must be preserved before Preview routing changes.

The F5 login-screen auth flash remains a separate defect after a safe Deck checkpoint.

## Deck PHASE A — exact source/contract audit: CLOSED PASS

Immutable source manifest:

`docs/coding/SOURCE_DECK_MANIFEST_20260912.md`

Manifest commit: `eef7acda3fafa25cd4163e82ee8a455ce3e1757b`

### Source access method

The live Apps Script deployment was not invoked. A read-only Drive raw export exposed the project source JSON and embedded seed assets without executing live code.

```text
Apps Script Drive ID = 1AoMVWNQIsUxIQc7QjBoHkKPWGgPhOiLWdxFlTYnCWe2t8eFbtmHfavrb
raw export bytes = 4,368,887
raw export SHA-256 = 3d554e1b05d545c7f22e486c93d468cd8cfc3f53e181aa8648a67d460a62ad4a
LIVE_APPS_SCRIPT_INVOCATION=0
LIVE_SOURCE_MUTATION=0
```

### Exact Deck source-of-record

Live rollback workbook:

```text
Spreadsheet = 1WxKdITSdyysWM-eTqwww2JvcWvQGaQnTUyq9MwKVe8A
Title = 04_CODE1 농가 기본정보·입점 검증 입력양식 v0.1
shared=false
owner=master.solly.art@gmail.com
```

Deck storage tabs:

```text
15_DECKS         commit/version/hash/request metadata
16_DECK_SLIDES   normalized slides
17_DECK_ELEMENTS normalized elements
18_DECK_HISTORY  exact serialized JSON chunks
12_WEB_미디어큐  non-seed Deck media metadata
```

Canonical Deck ID: `CODE1_AZA_INTERNAL`.

### Committed lineage frozen

Two committed revisions exist and are preserved as source lineage:

```text
v1 R_b0a1887f67b940f58c626669 / content_hash 9i5dZQvE_YRCUbRyDVY9p8lYVlyPJXVYDGKyxHpGIeM
v2 R_82aeeccce12c4f4381934a7a / content_hash VeMG4FmTIMCr-jfNquPaC4tNhJLizzaS3mlwGvNT5gY
```

Both have 12 slides, 205 normalized elements, all slide backgrounds reference `asset_sky`, and both use the same 15 unique media refs.

Current latest is v2; migration must preserve it exactly. It is not an editorial correction step.

### Current asset dependency

15 exact refs:

- 14 embedded WebP seed assets under live `SEED_ASSETS_`;
- 1 private uploaded Deck JPEG `M_35f86cfcbc9f4c93aa6870ac`.

All 14 seed assets were extracted/read-only hashed from the Apps Script raw source. The referenced JPEG was independently downloaded/read-only and hashed. Exact byte counts, SHA-256 values, source lineage, ownership, rights/status notes, and Drive identity are frozen in the manifest.

No unreferenced legacy Deck media is automatically included.

### Legacy contract frozen

Read path:

- lazy `deckBootstrap` -> `{deck, assets, canEditDeck}`;
- `deckAssets` -> same asset map contract;
- committed history chunks are joined and verified against commit `content_hash` before parse;
- incomplete/hash-mismatched revision fails closed.

Save path:

- request `{deck,baseVersion,newVersion,summary,requestId}`;
- response `{version,versionLabel,savedAt}` (`versionLabel` optional on legacy retry fast-path);
- exact optimistic concurrency on `baseVersion`;
- idempotency by saved actor + requestId + COMMITTED state;
- `deck_id` must be `CODE1_AZA_INTERNAL`;
- all media refs must resolve to approved seed/deck-media identities;
- each save increments version exactly once;
- current browser/server `Code1Core.validateDeck` constraints must remain enforced;
- current PDF/print path is browser-rendered Deck + asset resolution, not a separate canonical PDF/PPT source.

Legacy write order uses normalized slide/element/history rows then a COMMITTED marker. STAGING must improve this to an atomic transaction/equivalent partial-failure guard rather than reproduce the Sheet partial-write risk.

PHASE A close:

```text
DECK_SOURCE_ACCESS=PASS_READ_ONLY
SOURCE_OF_RECORD=GROUNDED
COMMITTED_REVISIONS=2
LATEST_VERSION=2
LATEST_SLIDES=12
LATEST_ELEMENTS=205
CURRENT_ASSET_REFS=15
SEED_ASSET_BYTES_HASHED=14/14
UPLOADED_REFERENCED_MEDIA_HASHED=1/1
LIVE_BRIDGE_INVOCATION=0
LIVE_SOURCE_MUTATION=0
PRODUCTION_MUTATION=0
PHASE_A_SOURCE_DECK_MANIFEST=PASS
```

## Browser auth and current Deck behavior

Browser password/session E2E remains CLOSED PASS. F5 briefly displays initial login markup before async session restore; auth is not lost.

Before migration, Aza Deck still fails closed with `SETUP_REQUIRED` because `functions/api/rpc.js` routes `deckAssets`, `deckBootstrap`, and `saveDeck` to legacy bridge while Preview intentionally has no bridge credentials. Do not alter this routing until the STAGING read path is built, imported, and independently verified.

## Known pre-existing root baseline

Five root-suite failures remain unchanged from before this backend work: deck UI fixture, legacy media-organizer naming expectation, two media UX expectations, and legacy migration fetch fixture. Do not opportunistically mix those into the Deck backend migration unless the work order directly requires it.

## Local input preference

No hidden/SecureString prompts and no clipboard-dependent secret workflow. Visible local input only if technically unavoidable; no secret in chat/durable docs.

## Cross-track sync

- `MSG-20260912-0026`: CODING evidence accepted by Planning.
- `MSG-20260912-0027`: Deck architecture request accepted; Planning selected Option B.
- `MSG-20260912-0028`: P0 Deck migration work order received/read; PHASE A is complete and PHASE B is active.
- Planning delta `20260912-004` is read/applied to CODING scope.

## NEXT_ATOMIC_ACTION — PHASE B

1. Audit the currently applied Supabase STAGING schema and existing media/audit primitives.
2. Design the minimum additive Deck schema/RPC contract for immutable revisions + current pointer, actor/request idempotency, optimistic concurrency, transactional commit, and append-only audit.
3. Design private Deck asset mapping that preserves all 15 current `mediaRef` IDs and uses existing private STAGING storage without public exposure.
4. Add schema/contract/preflight tests first. Do not apply DDL or copy R2 bytes until the PHASE B contract passes local/CI validation.
5. Keep current Preview Deck legacy routing fail-closed until PHASE C read-copy verification succeeds.

ROLLBACK: Apps Script/Sheet/Drive remains live. Production has no R2 binding.