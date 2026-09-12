# CODE1 OWNER QA fixture Preview deploy

Work Order: `WO-20260912-CODING-OPS-QA-001`
Planning dispatch: `MSG-20260912-0059`
Target: `coding/runtime-backend-staging` only
Predeploy validated source head: `59dc7fa33ebdd8fbe76c229a6985a776dbe3e7a8`
Deployment marker: `b7c949ba6999ee8e37da4ce33f443fe8b59a6f6d`

This deployment publishes the narrow authenticated OWNER-only STAGING QA fixture create/cleanup capability for `/ops-relay.html`.

Security constraints remain:

- fixed synthetic template only
- no real business entity mutation
- no browser service-role material
- no database RBAC widening
- no credential read/reset/synthesis
- no Production/main/live Google mutation
- no arbitrary debug/event endpoint
- no fake DONE or direct worker command

A separate `[CF-Pages-Skip]` commit triggers the repository read-only Preview smoke after the deployment marker. That smoke may only GET static/session routes and issue unauthenticated RPC probes that must return 401; it performs no remote mutation.

Final OWNER visual/click QA remains a distinct user-authorized step after live smoke PASS.
