# CODE1 Deck PHASE C guarded import deployment

Purpose: one controlled Preview deployment to expose the temporary OWNER-only `deckMigration.importSource20260912` action after its CI gate passed.

Safety invariants:
- branch: `coding/runtime-backend-staging` only
- Production/main mutation: prohibited
- normal Deck read/write actions remain on the pre-cutover legacy fail-closed routing
- import action requires authenticated OWNER / SUPER_ADMIN
- immutable Work Order, project ref, bucket, Deck ID, source bundle SHA-256, 15 exact asset identities/checksums, and two exact legacy revision hashes are hard-gated
- Worker re-reads and SHA-256 verifies all 15 private R2 objects before revision import
- action is temporary and will be removed after independent Supabase readback closes PHASE C

Triggered after CI run 34655966690 succeeded.
