# CODE1 Deck PHASE E browser QA fix deployment marker

Date: 2026-09-12 KST
Work Order: `WO-20260912-CODING-DECK-001`
Target: `coding/runtime-backend-staging` Preview only

Manual PHASE E browser QA verified the STAGING Deck opens, renders migrated private assets, saves through the browser, and reaches Chrome print preview. No new fatal console/runtime error was observed in the supplied console screenshot.

This controlled Preview deployment addresses two QA findings without changing Deck backend/storage contracts:

1. authenticated refresh now restores the last workspace page and Deck slide position in the same browser tab using session-scoped state;
2. print output DOM is prewarmed after thumbnail rendering/changes so the app-side preparation before Chrome print preview is reduced;
3. the export QA dialog explicitly explains that Chrome date/title/URL/page-number headers and footers are browser print chrome and instructs users to disable `Headers and footers` in Chrome's More settings.

Safety:

- no Supabase schema/data migration in this deploy;
- no R2 object mutation in this deploy;
- no Production/main mutation;
- no live Apps Script/Sheet/Drive mutation;
- Deck STAGING read/write routing remains unchanged;
- `linkDrive(kind=DECK)` remains fail-closed.

Predeploy CI for the implementation/test head (`5bf4a29daf1545dd4828d075cde0b3cbaf19307b`) passed syntax, staging unit/contract tests, npm audit enforcement, accepted root baseline comparison, and build.
