# CODE1 CODING BATON

LAST_VERIFIED_ACTION: created isolated branch `coding/runtime-backend-staging` from verified main `a71a71eae73706862308e194110f4fcc2d25db01`, after read-only Phase 0 audit.

CURRENT_WORK: normalized Supabase STAGING schema, Cloudflare server adapter, private R2 upload authorization contract, source normalizer, migration verifier, and performance benchmark harness. Nothing is connected to live runtime.

BLOCKED_EXTERNAL_RESOURCES:
- CODE1 Supabase STAGING project does not yet exist and creation requires user approval.
- R2 bucket/binding details are not independently verifiable with available tools.
- Live Pages deployment revision is unverified from this environment.

NEXT_ATOMIC_ACTION:
1. Run local isolated unit tests/static checks for the branch implementation.
2. Commit tested files only to `coding/runtime-backend-staging`.
3. Continue adapter completeness: questionPolicy.save, account read/write compatibility, review mutations, private media read, migration apply/dry-run scripts.
4. Stop before creating/changing external infra; report exact Supabase/R2/Cloudflare resources that require approval.

ROLLBACK: current live site is unchanged; rollback is therefore “do nothing” until a future approved cutover. At cutover the existing Apps Script path must remain available behind a reversible backend flag.
