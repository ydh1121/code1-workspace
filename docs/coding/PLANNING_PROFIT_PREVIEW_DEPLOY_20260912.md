# CODE1 STAGING planning/profit Preview deployment — 2026-09-12

Scope: `coding/runtime-backend-staging` Preview only.

This commit intentionally triggers one Cloudflare Pages Preview deployment after the isolated CI gate passed.

Included in this Preview QA bundle:
- versioned planning-document editor and feedback
- explicit per-account page/function access controls
- authenticated-refresh neutral gate
- separate product profit-structure input under 경영·기획
- plain-Korean management planning snapshot v0.2
- server-side authorization for the new planning/profit paths

STAGING database migration `product_profit_plain_planning` is applied and read-back verified.

Production, `main`, legacy Apps Script/Sheet/Drive, and live R2 objects are out of scope and unchanged.
