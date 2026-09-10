# CODE1 native Sheet migration dry-run — 2026-09-10

Status: `READ_ONLY_DRY_RUN / NO_DATABASE_WRITE / NO_R2_WRITE / NO_LIVE_CHANGE`

Source: canonical `04_CODE1 농가 기본정보·입점 검증 입력양식 v0.1` (`1WxKdITSdyysWM-eTqwww2JvcWvQGaQnTUyq9MwKVe8A`). Values below were verified through native Google Sheets API reads. No raw account hashes, emails, farm contact fields, Drive URLs, or source rows are committed here.

## Extractor authority

The Google-native XLSX export was also produced as snapshot evidence, but an isolated parser check interpreted some blank XLSX cells as a spurious string value. The migration therefore uses native Google Sheets API values as authority. The XLSX file is evidence only until that parser discrepancy is resolved.

## Observed source inventory

| Source | Source rows | Dry-run result |
| --- | ---: | --- |
| `01_농가_Master` | 12 stable farm rows | 12 `farms` rows; stable `GF-ORIGIN-*` IDs preserved |
| `13_WEB_질문카탈로그` | 231 active items | 231 `question_catalog` rows; stable `item_key` preserved |
| `11_WEB_제출큐` | 8 rows | 2 submissions, 5 answer-version rows, 3 `__COMMIT__` sentinels excluded from answers |
| `12_WEB_미디어큐` | 6 rows | 4 farm media rows; 2 DECK media rows excluded from farm runtime cutover |
| `19_WEB_ACCOUNTS` | 2 active accounts | 2 account IDs preserved; no account creation |
| `22_WEB_질문정책` | 0 policy rows | 0 current policies |
| `23_WEB_질문정책_이력` | 0 history rows | 0 policy history rows |
| `20_WEB_ACCESS_LOG` | 29 log rows | 29 audit migration rows |
| `21_WEB_LOGIN_GUARD` | 3 guard rows | 3 guard rows; epoch-ms window start converted to timestamptz input |
| `24_WEB_미디어정리_이력` | 5 history rows | 5 append-only media events; repeated media IDs preserved |

## Stable-ID and relationship checks

- Two observed submissions keep their existing `SUB_*` IDs and resolve to existing master farm IDs.
- Five answer revisions resolve to existing question `item_key` values.
- An explicit empty answer at the newer revision is retained as an empty value; it is not discarded as a missing row.
- Four farm media records resolve to the existing farm/submission relation. Their current source state is `DELETED`; migration does not resurrect them.
- Two DECK media records are intentionally outside the farm runtime media migration.
- The five media-history rows refer to the four farm media IDs; one media ID has both `ORGANIZED` and later `TRASHED` events, which is valid append-only history.
- No row number is used as an identity.

## Housing-environment source observation

The current master source itself is not uniformly `1`: one farm has source value `1`, three farms contain an unconfirmed/unknown text value, and eight are blank. This dry-run does **not** convert unknown or blank values to `1`, and it does not treat the observed `1` as independently verified evidence. The isolated schema extension must support housing-environment codes 1–4 without describing them as quality grades.

## Result

`DRY_RUN_INTEGRITY = PASS_FOR_OBSERVED_NATIVE_SOURCE`

This means the currently observed rows can be normalized without ID collision or observed orphan relations under the stated exclusions. It does **not** mean a Supabase migration was executed. No CODE1 Supabase project exists yet, no SQL migration has been applied to an external database, no R2 object has been created, and no Cloudflare/live endpoint has been changed.
