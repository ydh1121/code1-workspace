# CODE1 CODING BATON

Updated: 2026-09-11
PLANNING_DELTA_SEQ_SEEN = 20260910-002
CROSS_TRACK_BUS_LAST_SEEN = MSG-20260911-0002

LAST_VERIFIED_ACTION: CODE1 Supabase STAGING source import completed successfully through the verified Windows operator path. Preflight was all-zero / FIRST_IMPORT, apply returned FIRST_IMPORT_APPLIED, runner post-write counts matched expected, and an independent Supabase read reconfirmed the same durable counts. Security Advisor remains WARN 0; Performance Advisor remains INFO only at 23 unindexed FKs and 11 unused indexes.

CURRENT_WORK: move from DB source-import gate to isolated R2/private-media migration preparation. Current live Internal Workspace remains Cloudflare -> Apps Script -> Sheet/Drive. No dual-write and no live cutover exist.

VERIFIED_CODE_STATE:
- branch: `coding/runtime-backend-staging`
- base main: `a71a71eae73706862308e194110f4fcc2d25db01`
- visible service-role input implementation: `fc947797f8ec34527c105ca6d35b437cc46fce96`
- corresponding CI run: `34502664526` / SUCCESS
- latest documentation commit before this BATON update: `f6d7ca6e68723e40e270b72be2c2839603ada0eb`
- staging tests: 41/41 PASS at latest code-bearing gate
- root regression gate: 35 PASS / 5 known pre-existing FAIL only
- build: PASS

POST_IMPORT_DB_GATE:
- project ref: `bsintmkyhptizrjoizfb`
- target: CODE1 STAGING only
- source SHA-256: `bde8f0671fd59bc125573129db7d4391bf0987380effcb50e91e43019eeb8f5b`
- source bytes: `200458`
- preflight mode: `FIRST_IMPORT`
- apply mode: `FIRST_IMPORT_APPLIED`
- accounts 2
- farms 12
- questions 231
- submissions 2
- answer versions 5
- media assets 4
- media events 5
- audit log 29
- login guard 3
- housing environment 12
- question policies/history 0/0
- planning capabilities/brief versions/artifacts 0/0/0
- migration registry 268

INDEPENDENT_SUPABASE_VERIFICATION:
- exact durable counts above independently reconfirmed after import
- Security Advisor WARN 0
- only `rls_enabled_no_policy` INFO remains by intentional server-only design
- Performance Advisor INFO: 23 unindexed foreign keys / 11 unused indexes
- do not alter indexes solely to silence advisor INFO before workload measurement

OPERATOR_SECRET_INPUT RULE:
- user explicitly prefers normal visible terminal paste for service-role/secret input
- do not default to SecureString, masked `*`, clipboard auto-read, or hidden input when preparing manual operator commands for this user
- secret values themselves must never be persisted in Git, Drive docs, logs, or chat records
- this preference has been recorded in CODE1 and cross-project Harness documents

SOURCE_BOUNDARY:
- private source snapshot remains outside Git in `[PRIVATE] CODE1 STAGING MIGRATION`
- stale `01_농가_Master` rows 501-512 remain unmodified and excluded from the verified snapshot
- DECK media 2 remain excluded from farm runtime
- farm media 4 remain legacy Drive-backed pending R2 phase
- housing unknown/blank remains NULL / UNCONFIRMED
- Planning capabilities remain 0

CROSS_TRACK_SYNC:
- `MSG-20260910-0004` is APPLIED
- prior CODING final-handoff message `MSG-20260911-0002` is now technically stale because it said actual import was still waiting
- publish a new CODING -> PLANNING implementation-evidence/final-state message superseding `MSG-20260911-0002` after this post-import verification is recorded

OPEN_WAITING:
- R2/private-media migration: NEXT / verify actual CODE1 R2 bucket + Worker binding before implementation
- runnable Supabase-backed staging performance p50/p95: WAITING runtime adapter path
- stale source duplicate cleanup: OPEN_SEPARATE_DECISION
- npm 3 high + 1 critical: OPEN_SEPARATE_HARDENING
- live cutover: NOT APPROVED
- CODE1 Production: NOT CREATED / NOT CONNECTED by this workstream

NEXT_ATOMIC_ACTION:
1. verify existing CODE1 R2 bucket and staging Worker binding/config without touching live deployment;
2. implement/test isolated STAGING private-media adapter and migration path;
3. keep Google Drive legacy source metadata as rollback evidence;
4. do not include DECK media in farm runtime migration;
5. do not perform live cutover or Production work without separate approval.

ROLLBACK: live remains unchanged. Until an approved cutover, existing Apps Script/Sheet/Drive remains the live runtime and source evidence.
