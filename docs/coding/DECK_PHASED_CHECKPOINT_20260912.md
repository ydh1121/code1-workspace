# CODE1 Deck Option B — PHASE D checkpoint

Date: 2026-09-12 KST
Work Order: `WO-20260912-CODING-DECK-001`
Branch: `coding/runtime-backend-staging`
Target: Preview / Supabase STAGING / private STAGING R2 only

## Status

- PHASE A exact source/contract audit: CLOSED PASS
- PHASE B STAGING target design/schema: CLOSED PASS
- PHASE C copy-first migration + independent read cutover: CLOSED PASS
- PHASE D isolated STAGING write path: CLOSED PASS
- PHASE E browser/runtime verification: ACTIVE / final manual browser workflow pending

## Current Deck state

Supabase STAGING project: `bsintmkyhptizrjoizfb`
Deck: `CODE1_AZA_INTERNAL`

After the one-shot PHASE D live verifier:

```text
current_version = 3
current_revision_id = R_84c28cc57e5b474780a17139
current source_kind = STAGING_SAVE
current version_label = v0.1
current payload hash recomputation = MATCH
current revision linked assets = 15
all revisions = 3
all revision-asset links = 45
```

The v3 save is a no-op content verification revision. Independent DB comparison confirms:

```text
v2 -> v3 logical content equal = TRUE
v2 -> v3 slides equal = TRUE
slide count = 12
```

Only version/saved timestamp/saved actor metadata changed.

## PHASE D proof asset

A single STAGING-only proof PNG was created by the live upload verifier:

```text
asset_id = M_dddddddddddddddddddddddd
source_kind = STAGING_UPLOAD
mime_type = image/png
file_size_bytes = 68
request_id = dddddddddddddddddddddddddddddddd
state = ACTIVE
```

It is NOT referenced by the current v3 Deck revision. It remains isolated QA evidence and is not part of the migrated 15-asset source snapshot.

## Live write verification

The one-shot verifier completed:

```text
PASSWORD_LOGIN=PASS account=OWNER sessionVersion=3
BEFORE=PASS version=2 assets=15
DECK_UPLOAD=PASS asset=M_dddddddddddddddddddddddd idempotent=true
DECK_MEDIA=PASS bytes=68
DECK_SAVE=PASS version=3 idempotent=true
REQUEST_REUSE_GUARD=PASS status=409
STALE_CONFLICT=PASS status=409
DRIVE_LINK_GATE=PASS status=503
AFTER=PASS version=3 referencedAssets=15
LOGOUT=PASS
DECK_WRITE_CUTOVER=PASS
PRODUCTION_MUTATION=NONE
LIVE_SOURCE_MUTATION=NONE
```

Independent audit readback found exactly one `deck.asset.register` for the proof upload and one `deck.save` for the v3 save. The stale conflict, request-id misuse, retry, and Drive-link denial produced no unintended Deck mutation.

## Write-path safety now active

- `deckBootstrap` / `deckAssets`: Supabase STAGING + private R2
- `saveDeck`: Supabase STAGING transaction/RPC only
- `upload(kind=DECK)`: private `code1-staging-media` R2 + `deck_assets`
- `media(id)` for Deck assets: private read-token URL only
- `linkDrive(kind=DECK)`: explicit `DECK_DRIVE_LINK_DISABLED`; no live Drive fallback
- Production bridge credentials used by Preview: 0
- live Apps Script/Sheet/Drive mutation: 0
- legacy source remains rollback source and was not deleted/overwritten

## Idempotency/conflict/compensation

- Deck asset retry: same actor/request requires exact asset identity/bytes metadata; mismatch -> `REQUEST_ID_REUSE`/conflict.
- Deck save retry: exact logical replay only; changed summary/content/base/linkage with reused request id -> `REQUEST_ID_REUSE`.
- stale `baseVersion` -> `CONFLICT`.
- R2 object written before failed DB registration is compensation-deleted in unit coverage.
- Deck `none` permission is denied before persistence access in unit coverage.

Applied STAGING migrations include:

- `0011_deck_staging_runtime.sql`
- `0012_deck_saved_at_contract.sql`
- `0013_deck_asset_request_idempotency.sql`
- `0014_deck_save_request_idempotency.sql`

## CI

Latest committed PHASE E verifier contract correction before the logout diagnostic:

`90914bf39367eaca0e7f9c0e21dbd26d0318383f`

CI run `34658583713`: SUCCESS across syntax, staging unit/contract tests, npm audit enforcement, accepted root baseline comparator, and build.

## PHASE E read-only live evidence

The repeatable no-mutation verifier reached the following live Preview checkpoints successfully:

```text
UNAUTHENTICATED_RUNTIME=PASS status=401
PASSWORD_LOGIN=PASS account=OWNER sessionVersion=3
SESSION_RESTORE=PASS configured=true authenticated=true googleEnabled=false
DECK_BOOTSTRAP=PASS deck=CODE1_AZA_INTERNAL version=3 assets=15 canEditDeck=true
PRIVATE_ASSET_READ_ALL=PASS count=15 bytes=1132992
LOGOUT=PASS
```

The script then reported `LOGOUT_SESSION_INVALIDATION_FAILED status=200`. This is diagnosed as a verifier false negative, not a runtime logout failure: the script manually replayed the pre-logout `Cookie` header after calling logout. The runtime logout contract clears the browser cookie with `Set-Cookie: __Host-code1=; ... Max-Age=0`; a browser applies that response and no longer sends the cookie. Replaying an explicitly retained old signed cookie tests token replay semantics, not normal browser logout behavior.

Do not rerun PHASE D write verification. The remaining PHASE E acceptance is the actual browser workflow.

## Remaining PHASE E gate

Final manual browser evidence still required by the Work Order:

- stable Preview opens Aza Deck without `SETUP_REQUIRED`;
- existing Deck content and images render;
- edit/save via actual browser UI;
- refresh/session restore shows saved state;
- PDF/print path reaches current browser print/export gate without new Deck migration regression;
- browser logout returns to unauthenticated UI;
- no new page/console runtime errors.

Role denial is covered by the existing Deck runtime/DOM tests; live STAGING currently has only OWNER + ADMIN accounts, both admin-equivalent for Deck permissions, so no existing authenticated viewless account is mutated merely to manufacture a live denial sample.

## Boundaries

Production/main/live Public Frontend: NOT TOUCHED.
Production bridge credentials: NOT USED.
Live Apps Script/Sheet/Drive: READ-ONLY rollback source, mutation 0.
FIRST_IMPORT: NOT RERUN.
Local Orchestrator: separate track, out of scope.

Next: complete the final manual browser workflow. Only after that passes should CODING publish final `IMPLEMENTATION_EVIDENCE` and mark this Work Order complete.