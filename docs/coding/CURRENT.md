# CODE1 CODING CURRENT

Updated: 2026-09-10
Status: PHASE 0 VERIFIED / PHASE 1 CONTRACT DRAFTED / PHASE 2 ISOLATED IMPLEMENTATION ACTIVE
Branch: `coding/runtime-backend-staging`
Base main: `a71a71eae73706862308e194110f4fcc2d25db01`
Live cutover: NOT APPROVED
Production: PROHIBITED

## Verified authority

SESSION_BOOTSTRAP completed against the CODE1 harness, CURRENT SNAPSHOT, global BATON, Master Roadmap, Planning SSOT index, temporary farm-workspace spec, canonical farm input Sheet, actual Git main, and current runtime code. No separate pre-existing coding CURRENT/BATON was found, so this branch creates coding-owned continuation documents without editing planning authority.

## Verified runtime facts

- Canonical temporary Sheet has 25 tabs (00–24) and retains `STAGING_ONLY`, `REVIEW_REQUIRED`, and `PRIVATE_DRIVE` settings.
- Two active workspace accounts exist: OWNER/SUPER_ADMIN and one ADMIN. Credential material exists in the source Sheet but must never be copied into docs/logs.
- Current frontend calls `/api/rpc`; Cloudflare server then calls the signed Apps Script bridge. The Apps Script/Sheet/Drive hot path remains the structural latency source.
- Git main HEAD was verified as the base SHA above.
- Current live Cloudflare deployment revision could not be independently verified from this execution environment. Treat it as `LIVE_DEPLOYMENT_UNVERIFIED`.
- Supabase account currently has no CODE1 project. Existing non-CODE1 projects are excluded and untouched.
- Existing R2 bucket identity/binding cannot be verified with available connectors; no Cloudflare resource change is authorized yet.

## Target contract

Keep current Cloudflare signed-session/password behavior initially; migrate account/permission reads to CODE1 Supabase STAGING rather than introducing Supabase Auth during the first cutover. Use fail-closed RLS with a server-only service-role Worker path. R2 stores private bytes; Supabase stores metadata.

## Performance gate

No PASS and no multiplier claim. Baseline authenticated p50/p95 is still pending. The branch contains a benchmark harness for identical action measurement before cutover.
