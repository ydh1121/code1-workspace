# CODE1 Private STAGING Import Runbook — 2026-09-11

Status: READY_FOR_OPERATOR_SERVICE_ROLE_INPUT
Track: CODING
Branch: `coding/runtime-backend-staging`
Target: CODE1 STAGING only
Supabase project ref: `bsintmkyhptizrjoizfb`
Live/Public Frontend/Production: DO NOT TOUCH

## Purpose

This runbook performs the first private data import from the verified Google Sheet snapshot into CODE1 Supabase STAGING without placing the service-role key or private source rows in Git, browser code, documentation, terminal command history, or chat-visible configuration.

## Verified source

Private Drive folder:

- `[PRIVATE] CODE1 STAGING MIGRATION`
- folder ID: `1YMiqei4FbYe01V8RdN6x93Vjse4KPftw`

Private source file:

- `CODE1_PRIVATE_SOURCE_SNAPSHOT_20260910.json`
- Drive file ID: `16iBk4-qDfIG1HlLlAzUsaUtOW4DQWJVm`
- SHA-256: `bde8f0671fd59bc125573129db7d4391bf0987380effcb50e91e43019eeb8f5b`
- bytes: `200458`

The source file contains private migration data, including password hashes and access history. Do not commit it or copy its contents into tickets, docs, logs, browser code, or chat.

The snapshot intentionally uses `01_농가_Master` rows 2–13 only. Rows 501–512 are a stale duplicate `GF-ORIGIN-01..12` block and are excluded. The source Sheet itself is not modified by the migration.

## Required local state

1. Windows PowerShell.
2. Node.js available as `node`.
3. Repository checked out locally.
4. Current Git branch exactly `coding/runtime-backend-staging`.
5. The private source JSON downloaded from the private Drive folder to a local non-repository path.
6. CODE1 STAGING `service_role` key available to the operator. Do not paste the key into a PowerShell command, `.env`, Git file, browser code, or chat.

## Update isolated branch

From the repository root:

```powershell
git fetch origin
git checkout coding/runtime-backend-staging
git pull --ff-only origin coding/runtime-backend-staging
```

Do not merge this branch into `main` as part of the import operation.

## Preflight only

Run the PowerShell wrapper. It prompts for the service-role key as a hidden `SecureString`; the key is placed in the process environment only for the child Node call and is removed in `finally`.

```powershell
powershell -ExecutionPolicy Bypass -File .\backend\staging\scripts\run-private-import.ps1 `
  -SourcePath "C:\PRIVATE\CODE1_PRIVATE_SOURCE_SNAPSHOT_20260910.json" `
  -PreflightOnly
```

Expected requirements:

- current branch is exactly `coding/runtime-backend-staging`;
- source SHA-256 and byte size exactly match the verified snapshot;
- normalized source shape matches the expected migration counts;
- target ref is exactly `bsintmkyhptizrjoizfb`;
- target durable import tables are all zero;
- preflight mode is `FIRST_IMPORT`;
- no service-role value appears in output.

If any check fails, stop. Do not use `IDEMPOTENT_RETRY` to bypass a first-import preflight failure.

## First import

Only after the preflight above returns `ok: true` and `mode: FIRST_IMPORT`, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\backend\staging\scripts\run-private-import.ps1 `
  -SourcePath "C:\PRIVATE\CODE1_PRIVATE_SOURCE_SNAPSHOT_20260910.json"
```

The wrapper runs preflight again, then requires the operator to type the exact project ref:

```text
bsintmkyhptizrjoizfb
```

Only then does it apply the import.

Expected post-import counts:

- accounts: 2
- farms: 12
- questions: 231
- submissions: 2
- answerVersions: 5
- media: 4
- mediaEvents: 5
- auditLog: 29
- loginGuard: 3
- housingEnvironment: 12
- questionPolicies: 0
- questionPolicyHistory: 0
- planningCapabilities: 0
- planningBriefVersions: 0
- planningSourceArtifacts: 0

The runner also checks the destination counts after write and exits non-zero on any mismatch.

## Retry rule

`-IdempotentRetry` is only for a controlled retry after a known interrupted/ambiguous first import. It must not be used merely because the target is non-empty.

```powershell
powershell -ExecutionPolicy Bypass -File .\backend\staging\scripts\run-private-import.ps1 `
  -SourcePath "C:\PRIVATE\CODE1_PRIVATE_SOURCE_SNAPSHOT_20260910.json" `
  -IdempotentRetry
```

Append-only legacy `media_events` and `audit_log` use stable `metadata.source_row` keys so a retry does not duplicate those source rows. Upserted entities use stable conflict keys.

## Required verification after import

After a successful first import, verify before any R2/media phase:

- exact destination counts above;
- `C-02` explicit blank revision 2 remains an answer revision;
- `__COMMIT__` rows are not answer rows and only determine submission revision state;
- DECK media remains excluded from farm runtime media;
- legacy deleted media remains `GOOGLE_DRIVE_LEGACY` and has no R2 object key;
- the same legacy media can retain both ORGANIZED and later TRASHED source events;
- actor IDs resolve to stable workspace account IDs where possible;
- housing environment source `미확인`/blank maps to NULL code and all migrated records remain `UNCONFIRMED`;
- planning capability count remains 0;
- browser roles still cannot directly read server-only tables;
- Security Advisor remains WARN 0;
- imported-data query measurements are taken before changing indexes for performance INFO findings.

## Stop conditions

Stop immediately if any of the following occurs:

- wrong branch;
- wrong project ref;
- source SHA or shape mismatch;
- first-import target is non-empty;
- any destination count mismatch;
- browser-role direct table access appears;
- service-role value is printed or written to a file;
- any HOOOO/Production/main/live resource is implicated.

Do not continue to R2 or live cutover until the DB data gate is explicitly verified.
