# CODE1 CODING BATON

Updated: 2026-09-12 KST
PLANNING_DELTA_SEQ_SEEN = 20260912-004
CROSS_TRACK_BUS_LAST_SEEN = MSG-20260912-0034

LAST_VERIFIED_ACTION: Temporary admin executive/management P0 was implemented on `coding/runtime-backend-staging`, migration `admin_management_planning_audit` was applied to Supabase STAGING, CI `34662279995` passed, and Cloudflare Pages deployed commit `b6460da9da8153ffb5b8ba1fb162844bfbab1048` successfully to the stable branch Preview. Production/main/live Apps Script/Sheet/Drive mutation remains NONE.

CURRENT_WORK: Browser acceptance for the new OWNER-only `경영·기획` surface and delete actions is still required. The separate Deck PHASE E browser/runtime acceptance remains open and must not be lost.

## Temporary admin executive / management P0 — deployed

Durable deploy evidence: `docs/coding/ADMIN_EXECUTIVE_DEPLOY_20260912.md`

Implemented in STAGING/Preview:

- OWNER-only responsive `경영·기획` workspace.
- Executive Brief `v0.1-20260909` PUBLISHED read model with 8 source-grounded sections.
- OWNER planning capabilities: `EXECUTIVE_BRIEF_VIEW`, `FACT_SUBMIT`, `FACT_VERIFY`, `FACT_APPROVE_CURRENT`.
- Fact Inbox create/list/transition UI/API; `DOCUMENT_RECEIVED` evidence is now persisted transactionally.
- empty-farm deletion with history guards and retained audit record.
- account deletion as archive: login/session invalidated, active farm/capability access revoked, history retained.
- OWNER-only consolidated server/domain audit view + structured STAGING state snapshot.
- mobile layouts for executive, Fact, farm, account and audit surfaces.

Explicit user-directed placeholder cleanup is complete:

```text
GF-ORIGIN-05 .. GF-ORIGIN-12 = DELETED
matching HER_FARM_* rows = DELETED
matching migration_registry FARM/HOUSING rows = DELETED
8 audit records = RETAINED
```

Security boundary: no hidden browser screenshot/screen recording, `getDisplayMedia`, canvas capture, keylogging, or covert visual capture was implemented. The owner audit surface uses server-side operation logs, domain event logs and structured current-state snapshots only. It is not exposed to ADMIN/FARMER roles.

Deployment evidence:

```text
migration = admin_management_planning_audit / SUCCESS
pre-deploy CI = 34662161905 / SUCCESS
deploy-trigger commit = b6460da9da8153ffb5b8ba1fb162844bfbab1048
post-trigger CI = 34662279995 / SUCCESS
Cloudflare Pages check = SUCCESS
branch Preview = https://coding-runtime-backend-stagi.code1-workspace.pages.dev
Production mutation = NONE
legacy Drive mutation = NONE
```

## Deck migration — retained state

`WO-20260912-CODING-DECK-001` Option B Deck migration has completed PHASE A/B/C/D. Preview Deck read/write uses Supabase STAGING + private STAGING R2 only. The one-shot PHASE D live verifier passed upload/media/save/idempotency/request-reuse/stale-conflict/Drive-link fail-closed with `PRODUCTION_MUTATION=NONE` and `LIVE_SOURCE_MUTATION=NONE`.

Primary durable evidence:

- `docs/coding/SOURCE_DECK_MANIFEST_20260912.md`
- `docs/coding/DECK_PHASED_CHECKPOINT_20260912.md`
- PHASE E read-only verifier: `backend/staging/scripts/verify-deck-phase-e-readonly-staging.mjs`
- latest verifier-fix commit: `90914bf39367eaca0e7f9c0e21dbd26d0318383f`
- latest verifier-fix CI: `34658583713` = SUCCESS

## Current STAGING Deck state

```text
Deck ID = CODE1_AZA_INTERNAL
current version = 3
current revision = R_84c28cc57e5b474780a17139
current source_kind = STAGING_SAVE
current referenced assets = 15
current referenced private bytes = 1,132,992
all revisions = 3
all revision links = 45
current payload hash recomputation = MATCH
v2 -> v3 slides/content = identical except revision metadata
```

PHASE D isolated proof asset:

```text
M_dddddddddddddddddddddddd
image/png / 68 bytes / STAGING_UPLOAD
ACTIVE but NOT referenced by current Deck
```

## Closed gates

```text
PHASE A exact source/contract audit = PASS
PHASE B additive STAGING schema/RPC design = PASS
PHASE C 15-asset R2 copy + v1/v2 import + independent read cutover = PASS
PHASE D STAGING-native write cutover = PASS
browser owner password login/session restore = PASS
admin executive schema/CI/deploy = PASS
Production bridge credentials in Preview = 0
live Apps Script/Sheet/Drive mutation = 0
FIRST_IMPORT rerun = 0
npm audit = 0
root baseline new regressions = 0
build = PASS
```

Current Deck routes:

- `deckBootstrap`, `deckAssets` -> Supabase STAGING/private R2
- `saveDeck` -> transactional STAGING RPC
- `upload(kind=DECK)` -> private STAGING R2 + `deck_assets`
- `media(id)` -> private tokenized Deck asset read
- `linkDrive(kind=DECK)` -> `DECK_DRIVE_LINK_DISABLED`; live Drive fallback forbidden

Applied Deck migrations:

- `0011_deck_staging_runtime.sql`
- `0012_deck_saved_at_contract.sql`
- `0013_deck_asset_request_idempotency.sql`
- `0014_deck_save_request_idempotency.sql`

Applied admin migration:

- `0015_admin_management_planning_audit.sql`

## Fixed boundaries

- branch: `coding/runtime-backend-staging`
- Supabase target: `bsintmkyhptizrjoizfb` STAGING only
- stable Preview: `https://coding-runtime-backend-stagi.code1-workspace.pages.dev`
- Production/main/live Public Frontend: PROHIBITED
- live Apps Script/Sheet/Drive: rollback source only; no mutation
- no Production `BRIDGE_URL` / `BRIDGE_SECRET` reuse
- R2 private only; no public domain/r2.dev
- no secret in Git/Bus/Drive docs/chat
- Local Orchestrator remains separate ORCHESTRATOR scope

## Browser acceptance remaining

Temporary admin P0:

1. OWNER logs in on stable Preview and confirms `경영·기획` appears; ADMIN/FARMER must not see it.
2. Confirm Executive Brief and `해야 할 일` render on desktop/mobile widths.
3. Create one harmless Fact test entry only if desired, then exercise status flow without claiming real business facts as VERIFIED.
4. Confirm farm management shows only current farms and that the eight requested placeholder IDs are absent.
5. Confirm account-delete control appears only to OWNER; do not delete a real needed account merely to prove the button.
6. Confirm audit page loads existing server/domain records and state snapshot.

Deck PHASE E:

1. Run `verify-deck-phase-e-readonly-staging.mjs` once or repeatedly; it is no-mutation.
2. In stable Preview browser, confirm Aza Deck opens without `SETUP_REQUIRED`, current content/images render, and current state is v3.
3. Perform one actual UI edit/save verification and refresh/session-restore verification. Preserve final intended content; do not use Production/live sources.
4. Confirm private images remain visible after refresh.
5. Confirm PDF/print path reaches the current browser print/export gate and no new Deck migration error appears.
6. Inspect browser console/page for new runtime errors.

Separate deferred task: F5 login-screen auth flash remains outside these P0 changes.

ROLLBACK: legacy Apps Script/Sheet/Drive source remains preserved and untouched.
