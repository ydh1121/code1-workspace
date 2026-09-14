# CODE1 Planning Material DRAFT Seed + Request Delete — STAGING deployment marker

Authority: `MSG-20260914-0104 / WO-20260914-CODING-MATERIAL-DRAFT-SEED-DELETE-001 / Delta049`

This commit intentionally triggers Cloudflare Pages STAGING deployment.

Database state already applied and read back before deployment:

- canonical template: `PMT_GREAT_FARM_DEFAULT`
- current revision: `2`
- published revision: `1`
- revision 2 state: `DRAFT`
- revision 2 `published_at`: NULL
- active DRAFT items: 32
- real requests using template revision 2: 0
- migrations applied: `planning_material_draft_seed_request_delete_0026`, `planning_material_request_delete_acceptance_0027`, `planning_material_archive_assignment_guard_0028`
- safe delete acceptance: pristine => DELETED, preservation history => ARCHIVED, ADMIN => FORBIDDEN, synthetic residue => 0

Published revision 1 is not mutated or republished. DRAFT revision 2 remains internal preview only.
