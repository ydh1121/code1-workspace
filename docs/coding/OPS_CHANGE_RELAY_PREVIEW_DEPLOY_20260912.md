# CODE1 OPS Change Relay Preview Deploy — 2026-09-12

Scope: WO-20260912-CODING-OPS-001 / STAGING ONLY.

This marker intentionally triggers one Cloudflare Pages Preview deployment after the OPS source-side implementation reached a green predeploy checkpoint.

Included source contract:
- additive `0018_ops_change_relay.sql` transactional event/outbox schema and RPC boundary
- applied STAGING migration `ops_change_relay_0018`
- applied STAGING acceptance migration `ops_change_relay_acceptance_0019`
- atomic mutation + event + outbox rollback/idempotency/classification/RBAC acceptance PASS
- temporary `/ops-relay.html` owner-facing status/history surface with All / Planning / Incident / Failed / Done filters
- `admin.ops.events` read boundary and explicit `admin.ops.review` Planning-impact child-event action
- no service-role/R2/bridge secret material in browser bundle

Predeploy evidence:
- GitHub staging CI PASS through syntax, staging unit/contract tests, locked npm audit, root baseline comparator and build
- Supabase acceptance cleanup read-back: ops_change_events=0, ops_outbox=0, synthetic OPS_TEST_FARM rows=0
- Production/main/live legacy mutation: 0

External Orchestrator consumer is not assumed connected. Until a real consumer claims an outbox item, UI/status must remain honest (`RECORDED`/pending relay or other actual lifecycle value) and must never synthesize DONE.
