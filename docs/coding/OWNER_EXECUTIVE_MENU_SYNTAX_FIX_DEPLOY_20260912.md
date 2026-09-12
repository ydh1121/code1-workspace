# OWNER executive menu syntax fix deployment marker

Date: 2026-09-12 KST
Target: `coding/runtime-backend-staging` Preview only

Root cause confirmed: `public/assets/admin-ops.js` contained a browser JavaScript syntax error (`missing ) after argument list`) in the Fact Inbox action rendering path. Cloudflare deployment succeeded previously because the existing CI syntax check covered backend/functions but not `public/assets/*.js`.

This deployment includes:

- repaired `admin-ops.js` syntax;
- OWNER initialization replay guard in `accounts.js`;
- DOM regression test requiring OWNER `경영·기획` nav and landing card;
- negative DOM test ensuring sub-admin does not receive the OWNER-only entry;
- CI parse test for every `public/assets/*.js` file;
- existing known root regression baseline preserved;
- Production/main/live Apps Script/Drive unchanged.
