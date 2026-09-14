# CODE1 Planning Material Field Types / Draft-Publish — evidence

Authority: `MSG-20260914-0099` / `WO-20260914-CODING-MATERIAL-FIELD-TYPES-001` / Planning Delta `20260914-048`.

Status: **TECHNICAL PASS / BLOCKED_AUTH_SESSION for the mandatory authenticated OWNER + assigned PARTNER browser gate.**

## Scope and safety

- STAGING only.
- Production/main/live: no mutation.
- Production Supabase/R2: no mutation.
- Legacy Google/Drive hot-path: no mutation.
- Credentials/session secrets/passwords: not read, reset, synthesized or logged.

## Reused proven model

The existing farm-submission implementation was read back before implementation. The reusable pattern is catalog-level input type, immutable response snapshots, and non-destructive visibility/optional/exclusion policy. Planning Material keeps its separate domain and reuses that pattern rather than the farm questionnaire tables themselves.

## Implemented field contract

Template items now carry explicit `response_kind`:
- `TEXT`
- `LONG_TEXT`
- `FILE`
- `TEXT_FILE`

New request items snapshot `response_kind_snapshot`. Existing request items deliberately keep `NULL` for legacy compatibility and are not retrofitted.

Server-side requirements follow the kind:
- TEXT / LONG_TEXT: text required when the item is required; file container is rejected.
- FILE: current file required when the item is required; normal text channel is rejected.
- TEXT_FILE: both channels required when the item is required.

The browser renderer follows the same kind. `제품명` TEXT renders only a text control, FILE evidence renders the file/drop zone, and only explicit TEXT_FILE renders both.

## Draft / Preview / Publish lifecycle

- Template save now writes a DRAFT revision.
- `published_revision` remains unchanged until explicit publish.
- New material requests read only the PUBLISHED revision snapshot.
- Internal draft preview renders the exact submitter field surface and explicitly states it is not visible to submitters before publish.
- A never-published draft-only item can be physically deleted before publish.
- An item that has appeared in a published revision is archived/inactivated when removed from the current configuration. Future requests exclude it while existing request snapshots/history remain unchanged.

## Preserved MSG-0096 behavior

- Entire visible upload zone remains clickable.
- dragover/drop feedback remains.
- multi-file select/drop queue remains.
- per-file name/size/remove-before-upload remains.
- upload progress and per-file success/error remain.
- reupload/new-version path remains.
- internal review remains separated from the submitter compose surface.
- private R2, RBAC, version history, deterministic manifest and PLANNING_IMPACT contracts remain.

## Database evidence

Supabase STAGING project: `bsintmkyhptizrjoizfb`.

Applied migrations:
- `planning_material_field_types_lifecycle_0024`
- `planning_material_field_types_acceptance_0025`

Pre/post legacy request-item readback remained exactly:
- row count: `14`
- legacy NULL `response_kind_snapshot`: `14`
- fingerprint: `0badfd86ac001a1dcd9441a7868c8f3a`

0025 privileged transactional synthetic acceptance passed and cleaned all synthetic rows before commit. It exercised:
1. draft item not visible to a request created before publish,
2. draft-only test item physical deletion before publish,
3. explicit publish,
4. required `PRODUCT_NAME` TEXT snapshot,
5. required FILE snapshot,
6. explicit TEXT_FILE snapshot,
7. TEXT completion by text,
8. file insertion rejection on TEXT,
9. text rejection on FILE,
10. required FILE blocking request submission until a current file exists,
11. FILE requirement satisfied by a current file,
12. removal of a previously published item from the next published revision,
13. exclusion of that item from a subsequent new request,
14. preservation of the old request's immutable snapshot.

Post-acceptance synthetic residue readback: template 0 / request 0 / media 0 / audit 0 / synthetic ops 0.

The new functions remain non-executable by `anon` and `authenticated`, and executable only through the existing service boundary.

## Code / CI / deploy evidence

- Pre-deploy field-type interaction checkpoint: `70f582b8ef896ca470038426d211efd2774c1d1c`.
- DB acceptance source checkpoint: `aa55258a27c18c00810ae0061e24338515a5b304`.
- Cloudflare STAGING deployment commit: `795243ddf5d0880481fca616e7e3b7ea93c4ab16`.
- Cloudflare Pages deployment: SUCCESS.
- Atomic Preview: `https://dcd66a17.code1-workspace.pages.dev`.
- Stable branch Preview: `https://coding-runtime-backend-stagi.code1-workspace.pages.dev`.
- Final read-only smoke verifier correction/source head before this evidence: `7da7017fbcd6ac48f2cabeb6c0d1c329e2f6d6ed`.
- isolated-node-checks at the final smoke checkpoint: SUCCESS.
- Earlier full STAGING suite: 199/199 PASS, npm audit 0; existing root-baseline failures remained exactly the pre-existing set.

Live stable-Preview read-only smoke PASS:
- `/` 200
- `/assets/accounts.js` 200
- `/assets/planning-materials.js` 200 with typed response + explicit publish + draft-preview bundle contract
- `/assets/planning-materials.css` 200 with 390px/overflow/upload/review contracts
- `/api/session`: configured=true, authenticated=false
- unauthenticated `planning.material.bootstrap`: 401 UNAUTHENTICATED
- unauthenticated `planning.material.request.get`: 401 UNAUTHENTICATED
- unauthenticated `planning.material.upload.begin`: 401 UNAUTHENTICATED
- unauthenticated `planning.material.request.submit`: 401 UNAUTHENTICATED
- unauthenticated `planning.material.template.publish`: 401 UNAUTHENTICATED
- remote mutation by smoke: NONE

## Mandatory authenticated browser QA gate — not fabricated

Actual authenticated OWNER + assigned submitter/PARTNER desktop and 390px browser QA is **not claimed**.

Readback established:
- this chat execution environment exposes no interactive Computer/Cloud Browser session that can use the user's already-authorized staging cookies;
- the repository contains no Playwright/Puppeteer authenticated browser runner with a pre-authorized session;
- the existing `bootstrap-owner-web-login-staging.mjs` is not a session-reuse mechanism: it requires `CODE1_OPERATOR_SESSION_SECRET` plus a new `CODE1_STAGING_OWNER_PASSWORD` and resets the OWNER password/session version before login;
- current STAGING account readback contains active OWNER but no active PARTNER account to use as an assigned submitter.

Per Planning's existing-auth-session safety rule, the bootstrap/reset path was not executed and a test PARTNER credential was not invented. Therefore the Work Order cannot truthfully be marked CLOSED from this chat. The sole remaining acceptance gate is an existing authorized OWNER and assigned PARTNER browser session in an interactive browser-capable execution context; once that exists, run desktop + 390px click/drag/drop QA with page/console errors=0 and then issue final CODING→PLANNING completion evidence.
