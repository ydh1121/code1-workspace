# CODE1 Deck STAGING read cutover deployment marker

Work Order: `WO-20260912-CODING-DECK-001`
Date: 2026-09-12 KST
Target: `coding/runtime-backend-staging` Preview only

Purpose: deploy the independently imported and verified Aza Mall Deck read path to Supabase STAGING + private STAGING R2 before enabling any Deck write path.

Safety state at deployment:

- source migration readback: 15 active assets / 2 committed revisions / 30 revision-asset links;
- current pointer: v2 / `R_82aeeccce12c4f4381934a7a`;
- v1/v2 stored payload hashes independently recomputed and matched the source manifest;
- `deckAssets` and `deckBootstrap` route to STAGING;
- live read verification has already returned v2, 15 assets, and all 15 private R2 objects totaling 1,132,992 bytes;
- `DECK_WRITE_GATE_OPEN=false`;
- `saveDeck`, `upload(kind=DECK)`, and `linkDrive(kind=DECK)` fail closed with stable HTTP `503 / DECK_WRITE_GATE_CLOSED`;
- the explicit gate response is intentional and distinguishable from malformed-payload or generic runtime failures;
- one-time source import action is retired from the edge allowlist and active dispatcher;
- no Deck action falls back to live Apps Script/Sheet/Drive while Supabase STAGING mode is enabled;
- Production/main/live mutation is not authorized.

Next gate: re-run the live stable Preview read verifier and require all three write probes to return exact `503 / DECK_WRITE_GATE_CLOSED`. Only after that PASS may PHASE D write-path work continue.
