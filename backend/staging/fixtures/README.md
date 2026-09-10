# Fixtures

Only synthetic fixtures may be committed here. Never commit real farm contacts, legal data, account credential hashes, session cookies, Drive URLs, media originals, or runtime secrets.

## Private source contract

The real migration source is created outside Git from the canonical Google Sheet using the native Google Sheets API. The normalizer accepts these arrays:

- `accounts` <- `19_WEB_ACCOUNTS`
- `farms` <- `01_농가_Master`
- `questionCatalog` <- `13_WEB_질문카탈로그`
- `submissionQueue` <- `11_WEB_제출큐`
- `mediaQueue` <- `12_WEB_미디어큐`
- `questionPolicies` <- `22_WEB_질문정책`
- `questionPolicyHistory` <- `23_WEB_질문정책_이력`
- `accessLog` <- `20_WEB_ACCESS_LOG`
- `loginGuard` <- `21_WEB_LOGIN_GUARD`
- `mediaHistory` <- `24_WEB_미디어정리_이력`

The raw JSON and normalized JSON remain private local migration artifacts and are never committed. `__COMMIT__` rows are revision sentinels, not answer records. Explicit empty answer revisions must be preserved because they represent a user clearing an earlier value. Repeated history rows for the same media or policy ID are valid and must remain append-only.

The exported XLSX may be retained only as snapshot evidence. A 2026-09-10 parser check surfaced a blank-cell interpretation anomaly in the local workbook parser, so XLSX-parsed values are not migration authority. Native Sheets API values are the extraction authority until that parser discrepancy is resolved.
