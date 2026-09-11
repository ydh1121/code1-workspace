# CODE1 Deck STAGING write cutover deployment marker

Work Order: `WO-20260912-CODING-DECK-001`
Target: `coding/runtime-backend-staging` Preview only

Preconditions closed:

- source migration: 15 assets / 2 legacy revisions / 30 revision-asset links;
- live read cutover: PASS, current v2, 15/15 private R2 reads, 1,132,992 bytes;
- `0013` Deck asset exact request-idempotency applied to Supabase STAGING;
- `0014` Deck save logical request-idempotency applied to Supabase STAGING;
- Deck asset/save RPCs remain service-role only; browser roles have no direct database execution;
- staging unit/contract tests, npm audit, known root baseline comparator and build all PASS.

Write cutover behavior:

- `saveDeck` -> Supabase STAGING immutable revision + optimistic current pointer update;
- `upload(kind=DECK)` -> private `code1-staging-media` R2 object + `deck_assets` registration with SHA-256 and compensation on registration failure;
- `media(id)` -> Deck asset private read-token when the ID belongs to Deck, otherwise existing farm-media path;
- `linkDrive(kind=DECK)` -> fail closed as `DECK_DRIVE_LINK_DISABLED`; no live Drive fallback;
- no Deck action falls back to live Apps Script/Sheet/Drive while Supabase STAGING mode is enabled;
- Production/main mutation remains unauthorized.

Next gate is the one-shot live Preview verifier `backend/staging/scripts/verify-deck-write-staging.mjs`. It is locked to current Deck version 2 and may advance STAGING to version 3 exactly once.
