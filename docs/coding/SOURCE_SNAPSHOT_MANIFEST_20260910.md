# CODE1 STAGING Source Snapshot Manifest — 2026-09-10

Status: VERIFIED_SOURCE_BOUNDARY / PRIVATE_PAYLOAD_NOT_COMMITTED
Track: CODING
Branch: `coding/runtime-backend-staging`
Canonical source Sheet: `1WxKdITSdyysWM-eTqwww2JvcWvQGaQnTUyq9MwKVe8A`
Snapshot SHA-256: `bde8f0671fd59bc125573129db7d4391bf0987380effcb50e91e43019eeb8f5b`
Snapshot byte size: `200458`

## Security boundary

The actual migration `source.json` contains credential-derived account fields and operational access-log data. It is intentionally not committed to Git, copied into browser code, or embedded in this document. This manifest records only non-secret source boundaries, counts, and integrity metadata.

## Canonical source ranges

The private snapshot was generated from the native Google Sheet/API-equivalent values for these source surfaces:

- `01_농가_Master`: canonical farm records are rows 2–13 only (`A1:AT13`, header + 12 records).
- `19_WEB_ACCOUNTS`: 2 account records.
- `13_WEB_질문카탈로그`: 231 active question records.
- `11_WEB_제출큐`: 8 source rows = 5 answer revisions + 3 `__COMMIT__` sentinels.
- `12_WEB_미디어큐`: 6 source rows = 4 farm-runtime media + 2 DECK media excluded from farm runtime migration.
- `22_WEB_질문정책`: 0 policy records.
- `23_WEB_질문정책_이력`: 0 history records.
- `20_WEB_ACCESS_LOG`: 29 records.
- `21_WEB_LOGIN_GUARD`: 3 records.
- `24_WEB_미디어정리_이력`: 5 records.

## Farm duplicate-block anomaly

`01_농가_Master` also contains a stale sparse duplicate block at rows 501–512 with the same `GF-ORIGIN-01` through `GF-ORIGIN-12` IDs and `자료요청` state. Direct live-Sheet read confirmed those rows exist.

They are excluded from the migration snapshot because:

- rows 2–13 are the current 12-record working set and include the richer verified/in-progress data;
- including rows 501–512 would create duplicate `farm_id` values and make source normalization fail closed;
- migration must not silently merge or overwrite conflicting duplicate source records;
- the source Sheet itself is left unchanged. Source cleanup requires a separate explicit decision.

Any regenerated migration snapshot must preserve this boundary until the source Sheet is deliberately cleaned and re-verified.

## Normalized migration counts

Expected normalized state before write:

- farms: 12
- workspace accounts: 2
- active questions: 231
- submissions: 2
- answer revisions: 5
- commit sentinels: 3
- farm runtime media: 4, all current status `DELETED`
- DECK media excluded: 2
- media history events: 5
- access logs: 29
- login guard rows: 3
- question policies/history: 0 / 0
- housing-environment records: 12, all `UNCONFIRMED`
- planning capabilities/brief versions/source artifacts: 0 / 0 / 0

## Required semantic sentinels

- Preserve the explicit blank `C-02` answer at revision 2.
- Convert `__COMMIT__` rows into submission revision state, never answer rows.
- Preserve both ORGANIZED and later TRASHED events for legacy media `M_4934...`.
- Exclude DECK media from farm-runtime migration.
- Do not default housing-environment code to `1`; `미확인`/blank remains NULL and all migrated records remain `UNCONFIRMED`.
- Do not auto-grant Planning capabilities.

## Retry identity

Append-only legacy `media_events` and `audit_log` must retain `metadata.source` plus the original sheet-row ordinal as `metadata.source_row`. Retry deduplication is based on that pair/scope; it must not depend on generated destination IDs.

Code fix: `2fa67873bc16c573cb48c4bb674f2fb5f63ad698`.
Retry regression test: `backend/staging/test/import-idempotency.test.mjs` added by `d8888ada09e7e9b85e99fdb606d6a8a929ccbc71`.
GitHub Actions run `34494835092`: SUCCESS.

## Import boundary

The snapshot is ready for a first import only after service-role preflight reports `FIRST_IMPORT` and all durable target counts are zero. The service-role key and private snapshot payload must remain outside Git/docs/browser output.
