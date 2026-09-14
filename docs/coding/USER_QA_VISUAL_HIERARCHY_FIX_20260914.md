# CODE1 OWNER QA visual hierarchy correction — STAGING

Date: 2026-09-14 KST
Scope: bounded authenticated OWNER QA defects after MSG-0104 technical deployment.

## Corrected defects

1. Planning Material request item hierarchy
   - Actual requested evidence title is now the dominant label.
   - Each item is visibly numbered as `제출 항목 NN`.
   - Required/optional and response-kind chips remain secondary metadata.
   - Generic internal chrome such as `자료 제출` is visually demoted.
   - File submission title/drop zone remain clear without competing with the requested evidence title.

2. Farm Material selected group-card contrast
   - Existing active card uses a white selected surface while an older generic active rule left white text inherited.
   - Selected group title and number now explicitly retain readable ink/blue text.

## Safety

CSS/visual-only correction.

- Supabase schema/data mutation: 0
- Great Farm r2 DRAFT mutation: 0
- publish: 0
- request delete/archive mutation: 0
- Production/main/live mutation: 0
- credentials: 0

## Predeploy verification

- visual hierarchy regression tests added
- isolated staging CI: PASS
- existing MSG-0104 backend/data/delete contracts unchanged
