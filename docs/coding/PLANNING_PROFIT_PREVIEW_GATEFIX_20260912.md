# CODE1 STAGING planning RPC gate fix — 2026-09-12

Preview-only corrective deployment.

The first planning/profit Preview bundle built successfully, but a post-deploy route audit found that the Cloudflare RPC edge allowlist and STAGING planning dispatcher did not yet admit the new planning-document, access-control, and product-profit actions. The UI/backend implementation was therefore not considered ready for user QA.

This corrective deployment adds those actions to both fail-closed allowlists and adds regression coverage so the mismatch cannot recur silently.

CI gate: syntax, STAGING tests, clean dependency audit, known root baseline, and build all pass.

Production, `main`, legacy Apps Script/Sheet/Drive, and live R2 objects remain unchanged.
