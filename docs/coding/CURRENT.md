# CODE1 CODING CURRENT

Updated: 2026-09-11
Status: PHASE 0 VERIFIED / PHASE 1 CONTRACT FIXED / PHASE 2 ISOLATED IMPLEMENTATION ACTIVE / SUPABASE STAGING SCHEMA+SECURITY+SOURCE IMPORT PASS / POST-IMPORT DB GATE PASS / R2 PRIVATE-MEDIA GATE NEXT
Branch: `coding/runtime-backend-staging`
Base main: `a71a71eae73706862308e194110f4fcc2d25db01`
Live cutover: NOT APPROVED
Production: PROHIBITED
PLANNING_DELTA_SEQ_SEEN = 20260910-002
CROSS_TRACK_BUS_LAST_SEEN = MSG-20260911-0002

## Current verified state

CODE1 Supabase STAGING project `bsintmkyhptizrjoizfb` has now received the verified private source snapshot through the Windows operator import path. The operator preflight returned exact project ref, exact snapshot SHA-256 `bde8f0671fd59bc125573129db7d4391bf0987380effcb50e91e43019eeb8f5b`, exact size `200458`, all durable target counts zero, and mode `FIRST_IMPORT` before the write.

The apply then completed as `FIRST_IMPORT_APPLIED`. The import runner's post-write verification and an independent Supabase read both agree on the durable counts:

- workspace accounts: 2
- farms: 12
- question catalog: 231
- intake submissions: 2
- submission answer versions: 5
- media assets: 4
- media events: 5
- audit log: 29
- login guard: 3
- housing environment records: 12
- question policies/history: 0 / 0
- planning capabilities/brief versions/source artifacts: 0 / 0 / 0
- migration registry: 268

No partial import mismatch was observed.

## Security / performance post-import verification

Supabase Security Advisor after import reports WARN 0. The only security finding remains `rls_enabled_no_policy` INFO on 20 tables, which is intentional for the current server-only authorization boundary.

Supabase Performance Advisor after import remains INFO only:

- unindexed foreign keys: 23
- unused indexes: 11

No index change is authorized solely to silence these INFO notices. Query/index tuning remains gated on actual imported-workload measurements.

## Import tooling state

`backend/staging/scripts/run-private-import.ps1` is the Windows operator entrypoint. At explicit user request, service-role input is now a normal visible `Read-Host` paste so the operator can see exactly what was pasted. The key is not stored in Git or documentation and remains process-only for the import execution. This visible-input preference was also promoted into the CODE1 and cross-project Harness as an operator workflow rule; actual secret values are never recorded.

Git implementation commit for visible service-role input: `fc947797f8ec34527c105ca6d35b437cc46fce96`.
GitHub Actions run `34502664526` for that commit completed SUCCESS.

## Source boundary retained

The verified private snapshot remains outside Git in Drive folder `[PRIVATE] CODE1 STAGING MIGRATION`. The source Sheet itself was not silently changed.

`01_농가_Master` rows 501-512 remain a stale sparse duplicate `GF-ORIGIN-01..12` block. The verified migration snapshot used rows 2-13 only. Source cleanup remains a separate explicit decision.

Legacy DECK media rows 2 were excluded from the farm runtime import by contract. Legacy farm media remain Google-Drive-backed until the separate R2 phase.

Housing environment blank/`미확인` values remain NULL / UNCONFIRMED; code 1 was not auto-filled. Existing admin roles were not auto-granted Planning capabilities.

## Runtime / environment boundary

Current live Internal Workspace remains the existing Cloudflare -> Apps Script -> Google Sheet/Drive runtime. No live cutover or dual-write has been enabled.

No Public Frontend, formal Admin, main, CODE1 Production, HOOOO Supabase/Cloudflare/Git, INDX, or IndiaDesk environment was changed by this import.

## OPEN / WAITING

- R2/private-media migration: NEXT / WAITING R2 bucket-binding verification and staging-only implementation gate
- actual same-action performance baseline/new p50/p95 measurement: WAITING runnable Supabase-backed staging path
- stale source duplicate rows 501-512 cleanup: OPEN_SEPARATE_DECISION
- npm dependency findings 3 high + 1 critical: OPEN_SEPARATE_HARDENING
- live cutover: NOT APPROVED
- Production creation/deploy: PROHIBITED

## Next atomic action

Verify the existing CODE1 R2 bucket/binding name and current staging Cloudflare configuration without changing live deployment. Then implement the isolated STAGING private-media storage adapter and migration path, keeping legacy Drive source references as rollback evidence. Do not migrate or expose DECK media as farm runtime media. Do not perform actual live cutover without separate user approval.
