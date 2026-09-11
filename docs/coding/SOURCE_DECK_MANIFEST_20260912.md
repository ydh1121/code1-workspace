# CODE1 Aza Mall Deck — SOURCE_DECK_MANIFEST 2026-09-12

Frozen: 2026-09-12 06:28 KST
Track: CODING
Branch: `coding/runtime-backend-staging`
Planning work order: `MSG-20260912-0028` / `WO-20260912-CODING-DECK-001`
Planning delta: `20260912-004`
Architecture decision: OPTION B — migrate Preview Deck read/write to Supabase STAGING + existing private STAGING storage.

## 0. Safety boundary / snapshot method

This manifest was produced without invoking the live Apps Script web deployment and without mutating the live Apps Script project, source Sheet, Drive media, Production, or Preview runtime.

Read-only evidence used:

1. repository copies of Cloudflare bridge/access/performance adapters and current browser client contract;
2. Google Drive/Sheets read-only API reads of the live rollback workbook;
3. a read-only Drive raw export of the Apps Script project JSON, used only to inspect source text and embedded seed assets;
4. read-only raw download of the one uploaded Deck image referenced by the committed Deck revisions.

```text
LIVE_APPS_SCRIPT_INVOCATION=NONE
LIVE_SHEET_MUTATION=NONE
LIVE_DRIVE_MUTATION=NONE
PRODUCTION_MUTATION=NONE
R2_MUTATION=NONE
SOURCE_DECK_MANIFEST=FROZEN
```

The live Apps Script/Sheet/Drive system remains the rollback source. This manifest does not authorize cutover or source deletion.

## 1. Exact source identities

### 1.1 Apps Script project

```text
Drive file ID: 1AoMVWNQIsUxIQc7QjBoHkKPWGgPhOiLWdxFlTYnCWe2t8eFbtmHfavrb
Title: CODE1 Internal Workspace
Created: 2026-09-06T16:44:11.048Z
Modified: 2026-09-09T19:30:10.179Z
Parent: 0AJhBoMkeXI9gUk9PVA
Read-only raw-export bytes: 4,368,887
Read-only raw-export SHA-256: 3d554e1b05d545c7f22e486c93d468cd8cfc3f53e181aa8648a67d460a62ad4a
```

The raw export made `Deck`, `Media`, helpers, `SEED_ASSETS_`, and the current source constants inspectable without calling a live Apps Script function.

### 1.2 Live rollback workbook / Deck database

```text
Spreadsheet ID: 1WxKdITSdyysWM-eTqwww2JvcWvQGaQnTUyq9MwKVe8A
Title: 04_CODE1 농가 기본정보·입점 검증 입력양식 v0.1
MIME: application/vnd.google-apps.spreadsheet
Drive-reported size: 71,361
Created: 2026-08-31T19:54:16.146Z
Modified at freeze read: 2026-09-11T09:03:17.905Z
Parent: 1fvr8fCyMFcXlt7h6eK7F3KjXTW-YC01y
Shared: false
Owner: master.solly.art@gmail.com
```

Deck source tabs:

```text
15_DECKS         commit marker / version metadata / content hash / request id
16_DECK_SLIDES   normalized slide rows
17_DECK_ELEMENTS normalized element rows
18_DECK_HISTORY  exact serialized Deck JSON chunks
12_WEB_미디어큐  non-seed Deck media metadata
```

The canonical current Deck ID is exactly `CODE1_AZA_INTERNAL`.

## 2. Existing API/browser contract to preserve

### 2.1 Lazy read path

The main workspace bootstrap intentionally does not load the Deck. Opening the Deck calls `deckBootstrap`.

Legacy `performanceDeckBootstrap_` returns:

```js
{
  deck,
  assets,
  canEditDeck
}
```

- `deck`: exact Deck model returned by `loadDeck_()`;
- `assets`: map keyed by every `mediaRef` referenced by the Deck;
- `canEditDeck`: true only when account Deck permission is `edit`.

`deckAssets` is the asset map portion of the same logical read path.

The browser expects `bundle.deck`, `bundle.assets`, and `bundle.canEditDeck`, validates the Deck with `Code1Core.validateDeck`, then stores `deck.version` as its optimistic-concurrency base version.

### 2.2 Save request and response

Browser request:

```js
{
  deck,
  baseVersion,
  newVersion,
  summary,
  requestId
}
```

Normal response:

```js
{
  version,
  versionLabel,
  savedAt
}
```

The legacy retry fast-path returns `{version,savedAt}` without `versionLabel`; the browser already treats `versionLabel` as optional.

### 2.3 Authorization contract

- OWNER/admin-equivalent accounts can read and edit Deck according to account permissions.
- `deck:view` may read but must not save/upload.
- `deck:none` must be denied.
- DECK media access also requires Deck page access.
- current Preview `OWNER` is SUPER_ADMIN and has `deck:edit`.

Target STAGING implementation must preserve permission semantics rather than bypass them.

### 2.4 Validation / durable Deck model

`Code1Core.validateDeck` is part of the existing browser/server contract:

```text
deck_id required; canonical deck_id = CODE1_AZA_INTERNAL
version numeric
version_label <= 30 chars
status normalized to INTERNAL WORKING COPY
slides: 1..40
slide size: exactly 1920 x 1080
background: color/opacity/overlayColor/overlayOpacity/fit/position/zoom, optional mediaRef
elements per slide <= 180
element types: text | image | shape
unique slide and element IDs
x/y/width/height/z/locked/style preserved
text content <= 10,000 chars
image elements require mediaRef
total elements <= 2,500
serialized Deck JSON <= 1,200,000 chars
```

The migration must not editorially change Deck content while copying it.

## 3. Exact legacy revision/read semantics

Legacy `loadDeck_()`:

1. selects `15_DECKS` rows for `CODE1_AZA_INTERNAL` with `state='COMMITTED'`;
2. chooses the latest committed row;
3. selects and orders matching `18_DECK_HISTORY` chunks by numeric `chunk`;
4. joins `payload` chunks;
5. requires the joined JSON hash to equal the commit record `content_hash`;
6. parses and returns the exact JSON;
7. if no committed row exists, falls back to `SEED_DECK_`.

A missing/incomplete or hash-mismatched revision fails with `DECK_REVISION_INCOMPLETE`.

The target STAGING read path must preserve fail-closed committed-revision semantics. It must not silently read a partially written revision.

## 4. Exact legacy save semantics

Legacy `saveDeck_()` has these invariants:

```text
staging_() safety guard must pass
caller must be allowed to edit Deck
requestId must pass ID validation
summary is bounded to 1000 chars
idempotency key = saved_by + request_id + state=COMMITTED
baseVersion must equal latest.version exactly
deck_id must equal CODE1_AZA_INTERNAL
all mediaRefs must resolve either to SEED_ASSETS_ or DECK media rows
new version = latest.version + 1
newVersion=true -> version_label = v0.<new version>
newVersion=false -> version_label remains the current label
status = INTERNAL WORKING COPY
saved_by and updated_at are persisted
```

Legacy write order is:

```text
16_DECK_SLIDES
17_DECK_ELEMENTS
18_DECK_HISTORY
15_DECKS (COMMITTED commit marker last)
```

The final `15_DECKS` row contains `content_hash` of exact serialized JSON. This is a logical commit marker, but the Google Sheet implementation is not an atomic database transaction. The STAGING target must improve this with one transactional commit boundary / equivalent partial-failure protection.

Version conflict is fail-closed and surfaced as a `CONFLICT` error instructing the user to reload before saving.

## 5. PDF / print / export dependency

The current workspace does not depend on a separate server-side Deck PDF source. Both `PDF로 내보내기` and `인쇄` use the browser's `preparePrint()` flow:

1. render all validated Deck slides from the current model;
2. resolve every image from the current `assets` map;
3. wait for web font / images;
4. fail on missing images or detected text overflow;
5. call `window.print()`.

Therefore the migration must preserve the exact Deck model and valid private asset URLs. A separate PowerPoint/PDF canonical source must not be invented.

## 6. Committed revision manifest

### 6.1 Revision v1

```text
revision_id: R_b0a1887f67b940f58c626669
deck_id: CODE1_AZA_INTERNAL
version: 1
version_label: v0.1
saved_at: 2026-09-06T18:30:24.125Z
saved_by: master.solly.art@gmail.com
change_summary: 현재 작업본 수정
request_id: 42aae0d78334403b9cc0fb44d6f597dc
state: COMMITTED
content_hash: 9i5dZQvE_YRCUbRyDVY9p8lYVlyPJXVYDGKyxHpGIeM
slides: 12
normalized elements: 205
```

All 12 backgrounds use `asset_sky`. The v1 element-media reference set is identical to v2.

### 6.2 Revision v2 — current latest committed source

```text
revision_id: R_82aeeccce12c4f4381934a7a
deck_id: CODE1_AZA_INTERNAL
version: 2
version_label: v0.1
saved_at: 2026-09-07T16:52:10.299Z
saved_by: master.solly.art@gmail.com
change_summary: 현재 작업본 수정
request_id: 2d0b4c69181d4422b8b44d51ec80e86b
state: COMMITTED
content_hash: VeMG4FmTIMCr-jfNquPaC4tNhJLizzaS3mlwGvNT5gY
slides: 12
normalized elements: 205
history chunks: 2
```

All 12 backgrounds use `asset_sky`.

The latest v2 content must be copied byte/field faithfully. Example: current S05 contains `20,000+` daily and `600,000개 이상` monthly copy. Migration is not an editorial reconciliation step.

## 7. Current Deck media dependency manifest

Both committed revisions use the same 15 unique media references.

Seed assets (14):

```text
asset_114348
asset_388585
asset_409271
asset_48223
asset_651917
asset_656360
asset_657342
asset_661254
asset_farm
asset_grass
asset_handshake
asset_sky
asset_sorting_main
asset_sorting_wide
```

Uploaded Deck media (1):

```text
M_35f86cfcbc9f4c93aa6870ac
```

No other media ID is required to render v1 or v2.

## 8. Exact embedded seed-asset binary manifest

The current Apps Script project contains all 14 seed assets as embedded `data:image/webp;base64,...` bytes under `SEED_ASSETS_`. These bytes are the current runtime binary truth and can be copied without calling external URLs or modifying Drive.

| asset_id | bytes | SHA-256 hex | source lineage | note |
|---|---:|---|---|---|
| `asset_114348` | 12356 | `a708f1c8041275565bb7d51743de33ed42a2ac10a1cc1929e93a776649a6b914` | `CURRENT v0.2 HTML webdeck / assets/products/114348.webp` | 아자몰 기존 상품 · CODE1 상품 이미지가 아님 |
| `asset_388585` | 8872 | `ba83fe016ee327c6e8f3efb8fc81c7e05f1098fd7b39e3747169a05e27a5b68d` | `.../assets/products/388585.webp` | existing product reference |
| `asset_409271` | 10520 | `35605e96b6506d77d548888e34431b154cb945df4162a194e9e517d38033bdf0` | `.../assets/products/409271.webp` | existing product reference |
| `asset_48223` | 14000 | `dcb7a35e4ac43708aee43e6236d5489707f97a192f6969fdcb96c6153fd5a7c8` | `.../assets/products/48223.webp` | existing product reference |
| `asset_651917` | 31046 | `6b374cb6d50b096bc2c38928d76dba65b5065f75c735cd89b9358c78f04bcbfe` | `.../assets/products/651917.webp` | existing product reference |
| `asset_656360` | 20690 | `1c9ce8d90020dcded1222abaae5c41c6b35510d9f47f57451c8da3782cb57289` | `.../assets/products/656360.webp` | existing product reference |
| `asset_657342` | 10494 | `fc5cbbf82f909d2776d73ef8bfcdaad79650f1dde1845b60079276b04ee296e0` | `.../assets/products/657342.webp` | existing product reference |
| `asset_661254` | 13180 | `3cfed1c7b630a8c7b6671521a73222ee5b129505c7f43c574e2cdff257f1afbc` | `.../assets/products/661254.webp` | existing product reference |
| `asset_farm` | 132278 | `523152f50c8c3d28f34d3b0ccc1f5b0f0be0a272ce81782cd6675996c7787ea5` | `.../assets/internal/farm.webp` | 기존 내부 현장 이미지 |
| `asset_grass` | 115800 | `625418dc316d384d808242706b3c52c2ea085ad23ba505c829da4b6167200c03` | `.../assets/ref/grass.webp` | 기존 참고 디자인 자산 |
| `asset_handshake` | 133754 | `9227053acf1a827b07de01f55398ee341fee78cad605c77f93e429fdad7f9491` | `.../assets/ref/handshake.webp` | 기존 참고 디자인 자산 |
| `asset_sky` | 57740 | `9baa475728ad5ed1333ae4336fbe79b82e0e53c7978e61889df679ecd4856582` | `.../assets/ref/sky.webp` | 기존 참고 디자인 자산 |
| `asset_sorting_main` | 131886 | `a3e850f0cb2a385ce352f703ba3e70ed5a3d32798bc479cf5bdb833333e37575` | `.../assets/internal/sorting-main.webp` | 기존 내부 현장 이미지 |
| `asset_sorting_wide` | 211874 | `81036d587efbac5ebc87374855dbc4abfd1fc458971f65fef241bf72b73746c5` | `.../assets/internal/sorting-wide.webp` | 기존 내부 현장 이미지 |

Seed asset metadata consistently marks the assets for internal reference/design use and requires review before external submission. The migration must preserve those rights/usage notes; copying an asset to private STAGING storage is not a new rights approval.

Supporting provenance exists in the older private `ydh1121/code1` Aza webdeck branch and Drive image/layer inventories, but those sources are lineage evidence only. The exact current binary truth is the embedded `SEED_ASSETS_` bytes listed above.

## 9. Referenced uploaded Deck media manifest

### `M_35f86cfcbc9f4c93aa6870ac`

Live row in `12_WEB_미디어큐`:

```text
submitted_at: 2026-09-06T18:23:48.915Z
submitted_by: master.solly.art@gmail.com
media_group: DECK
shot_code: DECK
shot_label: 아자몰 이미지
file_name: KakaoTalk_20260828_174309854_01.jpg
mime_type: image/jpeg
file_size_bytes: 228502
drive_file_id: 1BzpFao2iMPQnSqB_IOYDsFTCBTQfK9_c
caption: 아자몰 작업본 이미지
rights_owner: 테스트
b2b_use: 미확인
status: REVIEW_REQUIRED
review_note: 업로드는 사용권 승인이 아닙니다.
submission_id: DECK
request_id: 2e7725197f0f486c9d5ebbf92f82eeaf
```

Drive readback:

```text
Drive file: M_35f86cfcbc9f4c93aa6870ac_KakaoTalk_20260828_174309854_01.jpg
MIME: image/jpeg
actual bytes: 228502
actual SHA-256: b6ca69b8e389fa1523cac1c0fc31e2c7369f7b780028746cdf4f807e898d9fac
parent: 1yhnTYcU0KttvTLQy9RwL5D6i9MzsY4PT
shared: false
owner: master.solly.art@gmail.com
```

The current Deck uses this media ID on S01. The current v1/v2 lineage does not require any other uploaded Deck-media row.

## 10. Supporting image/source lineage — not target authority

Read-only source inventories give human provenance for several current embedded assets:

```text
Drive image inventory: 10YAXCRkbAyrd2zULqNDt053BNN3Xl-tiZisFXl1uKQg
INT-002 2.png -> farm hero lineage
INT-008 KakaoTalk_20260828_174447075_01.jpg -> primary sorting lineage
INT-010 KakaoTalk_20260828_174447075_03.jpg -> secondary/wide sorting lineage
```

Older private repository `ydh1121/code1`, branch `agent/aza-proposal-webdeck-v0.1`, independently records the same farm/sorting source lineage. The layer inventory `1-QIiZTRl_f43zEFiRHA7FZl-dAC_n-k6wFxTgCPUvYk` records the eight Aza product IDs and the farm/sorting crop intent.

These are provenance/supporting records. They do not override the exact current committed Deck JSON or current embedded binary asset hashes.

## 11. Migration preservation rules derived from the source contract

The next phase must preserve, at minimum:

- exact Deck ID and current revision model;
- both existing committed revisions as immutable copied lineage where feasible;
- version/version-label behavior;
- exact baseVersion optimistic conflict behavior;
- idempotent retry by actor/saved-by + requestId;
- exact mediaRef IDs so existing slide JSON need not be rewritten;
- private asset delivery only;
- rights/status/note metadata without upgrading approval status;
- read/view/edit permission semantics;
- exact current browser `deckBootstrap`, `deckAssets`, and `saveDeck` shape;
- print/PDF behavior that depends on successful private image resolution;
- append-only save/audit evidence;
- fail-closed behavior on missing revisions/assets or version conflicts.

The target must improve transactional safety. It must not reproduce the legacy multi-tab partial-write risk merely for structural similarity.

## 12. Out-of-scope source rows

A second legacy `DECK` media row exists but is not referenced by committed v1/v2. It is not part of the current render dependency set and must not be migrated merely because it exists. Any broader historical/orphan-media migration requires separate evidence and intent.

The four previously imported legacy farm media rows also remain outside this Deck migration and must not be auto-migrated/deleted.

## 13. PHASE A close condition

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

NEXT: PHASE B only — audit current Supabase STAGING schema and design the minimal transactional Deck target + private asset mapping. Do not copy source bytes or apply DDL until that target contract is reviewed by tests/preflight.