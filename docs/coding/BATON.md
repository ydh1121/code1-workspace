# CODE1 CODING BATON

Updated: 2026-09-12 06:28 KST
PLANNING_DELTA_SEQ_SEEN = 20260912-004
CROSS_TRACK_BUS_LAST_SEEN = MSG-20260912-0028

LAST_VERIFIED_ACTION: P0 Deck migration Work Order `WO-20260912-CODING-DECK-001` was read in full. Planning selected Option B: Preview Deck read/write moves to Supabase STAGING + existing private STAGING storage. PHASE A exact source/contract audit is CLOSED PASS with immutable `SOURCE_DECK_MANIFEST_20260912.md` at commit `eef7acda3fafa25cd4163e82ee8a455ce3e1757b`.

CURRENT_WORK: PHASE B target design. Audit the applied Supabase STAGING schema/media/audit primitives, then design and test the minimum additive transactional Deck revision/current-pointer/private-asset contract. Do not apply DDL or copy asset bytes until the target contract/preflight passes. Current Preview Deck remains fail-closed through the legacy routing; do not add Production bridge credentials.

## Fixed boundaries

- branch: `coding/runtime-backend-staging`
- base main: `a71a71eae73706862308e194110f4fcc2d25db01`
- Supabase target: STAGING ref `bsintmkyhptizrjoizfb` only
- live cutover: NOT APPROVED
- CODE1 Production: PROHIBITED
- Apps Script/Sheet/Drive: live rollback source, READ_ONLY for this migration
- no Production `BRIDGE_URL` / `BRIDGE_SECRET` reuse in Preview
- no main/history rewrite/force push
- no Public Frontend / formal Admin / Planning SSOT / UIUX SSOT mutation
- no public R2 endpoint
- no HOOOO/INDX/IndiaDesk mutation
- no legacy farm-media auto migration/deletion
- no secret value in Git/Bus/Drive docs/chat
- Local Orchestrator remains separate ORCHESTRATOR scope only

## Retained verified backend baseline

```text
Preview branch = coding/runtime-backend-staging only
Production branch = main
stable Preview = https://coding-runtime-backend-stagi.code1-workspace.pages.dev
Preview R2 = CODE1_MEDIA_BUCKET -> code1-staging-media
Production R2 = NONE
R2 external integration/inventory = PASS
intentional R2 objects = 2 / 11,665,408 bytes
NOT_FOUND -> HTTP 404 = LIVE PASS
browser OWNER password/session restore = CLOSED PASS
npm audit = 0
pre-Deck staging tests = 62/62 PASS
Production mutation = 0
legacy Drive migration = 0
```

## PHASE A source manifest — PASS

Exact source-of-record:

```text
Apps Script project Drive ID:
1AoMVWNQIsUxIQc7QjBoHkKPWGgPhOiLWdxFlTYnCWe2t8eFbtmHfavrb
raw-export bytes: 4,368,887
raw-export SHA-256: 3d554e1b05d545c7f22e486c93d468cd8cfc3f53e181aa8648a67d460a62ad4a

live workbook:
1WxKdITSdyysWM-eTqwww2JvcWvQGaQnTUyq9MwKVe8A
Deck ID: CODE1_AZA_INTERNAL
Deck tabs: 15_DECKS / 16_DECK_SLIDES / 17_DECK_ELEMENTS / 18_DECK_HISTORY
media metadata: 12_WEB_미디어큐
```

The Apps Script raw source was read through Drive export only; the live deployment was not invoked.

Committed lineage:

```text
v1 R_b0a1887f67b940f58c626669
v2 R_82aeeccce12c4f4381934a7a (latest)
12 slides each
205 elements each
same 15 unique media refs
```

Asset dependency:

```text
14 exact embedded WebP SEED_ASSETS_ binaries, each byte-size + SHA-256 frozen
1 exact uploaded Deck JPEG M_35f86cfcbc9f4c93aa6870ac, 228,502 bytes + SHA-256 frozen
```

Manifest close evidence:

```text
DECK_SOURCE_ACCESS=PASS_READ_ONLY
SOURCE_OF_RECORD=GROUNDED
COMMITTED_REVISIONS=2
CURRENT_ASSET_REFS=15
SEED_ASSET_BYTES_HASHED=14/14
UPLOADED_REFERENCED_MEDIA_HASHED=1/1
LIVE_BRIDGE_INVOCATION=0
LIVE_SOURCE_MUTATION=0
PRODUCTION_MUTATION=0
PHASE_A_SOURCE_DECK_MANIFEST=PASS
```

## Contract that PHASE B/C must preserve

Read:

- `deckBootstrap -> {deck,assets,canEditDeck}`
- `deckAssets -> asset map`
- only committed, hash-valid revision is readable
- lazy Deck load remains separate from main bootstrap

Save:

- request `{deck,baseVersion,newVersion,summary,requestId}`
- response `{version,versionLabel,savedAt}`
- exact baseVersion conflict protection
- actor + requestId idempotent retry
- `CODE1_AZA_INTERNAL` only
- all media refs validated
- increment version exactly once
- preserve `version_label` behavior
- preserve browser/server `Code1Core.validateDeck` limits
- append-only audit
- target must improve legacy multi-tab partial-write risk with a transaction/equivalent atomic commit

Media:

- preserve the existing 15 mediaRef identifiers so current JSON need not be rewritten
- private delivery only
- preserve rights/status/note metadata; storage migration is not rights approval
- no migration of unrelated/orphan Deck media merely because it exists

Print/PDF:

- current PDF/print is browser rendering of Deck + assets followed by `window.print()`
- no separate canonical PPT/PDF source should be invented

## Current Preview behavior

Aza Deck remains intentionally blocked with `SETUP_REQUIRED` because `functions/api/rpc.js` still sends `deckAssets/deckBootstrap/saveDeck` to the legacy bridge and Preview has no bridge credentials.

Do not change the routing until PHASE C has copied/imported the source, independently verified it, and the STAGING read path passes.

## Planning routing

- `MSG-20260912-0026`: accepted by Planning
- `MSG-20260912-0027`: accepted; resulted in Option B
- `MSG-20260912-0028`: P0 current Deck migration work order; read and execution started
- Planning Delta `20260912-004`: read/applied

The F5 auth-flash defect remains separate and is deferred until a safe Deck checkpoint.

## NEXT_ATOMIC_ACTION — PHASE B

1. Read applied STAGING schema and identify reusable audit/idempotency/media primitives.
2. Draft minimal additive Deck tables/RPCs and private asset mapping.
3. Add tests for transactional save, conflict, retry, permission denial, invalid media ref, incomplete revision fail-closed behavior, and exact legacy response shapes.
4. CI/preflight first; no Supabase DDL apply and no R2 object copy yet.
5. After PHASE B PASS, proceed to PHASE C copy-first import + independent readback.

ROLLBACK: live Apps Script/Sheet/Drive remains untouched; Production has no R2 binding.