# CODE1 External Git Reference Registry — 2026-09-19

Status: PLANNING / READ_ONLY_REFERENCE
Source: two user-supplied GitHub Stars screenshots, reviewed against the current Git Harness registry.
Base project repository: `ydh1121/code1-workspace`
Base commit: `955bc1e34a6bd853084816ba8a379ef5d95dbf67`
This document does **not** install, vendor, import, execute, deploy, or authorize any external repository.

## 1. Audit result

- Repositories visible in screenshots: **60**
- Already present in current Git Harness registry: **19**
- New screenshot candidates after exact owner/repo de-duplication: **41**
- New candidates promoted here as CODE1 read-only references: **16**
- All other new candidates remain WATCH / SKIP / UNVERIFIED.
- Active UIUX work `MSG-20260919-0127` is not changed by this registry.

### Existing Harness duplicates — do not create new cards

- dashenbibi/tutorial-generator
- thedotmack/claude-mem
- yybmion/public-apis-4Kr
- anthropics/commerce-agents
- every-app/open-seo
- selfishclub/privacy-build
- VoltAgent/awesome-design-md
- larashero3-dotcom/lieflat-charts
- browser-use/video-use
- DietrichGebert/ponytail
- virgiliojr94/book-to-skill
- miqdadbadjuber/anti-slop
- Graphify-Labs/graphify
- educlopez/ui-craft
- SUDO-AI-3D/zero123plus
- bitjaru/styleseed
- arknow91/liquid-taffy
- leopard627/fire-your-seo-agency
- LilMGenius/paperthin

## 2. New CODE1 read-only references

These are reference sources, not project dependencies. Before any actual code reuse, install, provider connection, runtime integration, credential use, or Production deployment, the relevant CODE1 Work Order and current license/security review are still required.

### UI/UX, Figma fidelity, and design QA

#### nextlevelbuilder/ui-ux-pro-max-skill
URL: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill

Function:
- AI-oriented UI/UX design intelligence.
- Design-system generation, responsive checks, accessibility/focus/reduced-motion guidance, UI anti-pattern rules.
- README exposes a Korean version and multi-platform use.
- GitHub metadata checked 2026-09-19: active, MIT.

CODE1 use:
- Use as a **secondary UX QA/reference source** for responsive, accessibility, and interaction checks.
- Never override CODE1 user decisions, design rules, FROZEN state, or route semantics.
- Do not import its visual style presets as a default design language.

#### 3x-haust/Mimikyu
URL: https://github.com/3x-haust/Mimikyu

Function:
- Figma design -> web code verification loop.
- Uses a Figma-derived contract, screenshots, pixel diff, and DOM geometry/style verification.
- Supports whole-page or frame-specific checks and a read-only visual critic handoff.
- GitHub metadata checked 2026-09-19: active, MIT.

CODE1 use:
- **High-value verification pattern** for the DESIGN/Figma exact-copy lane.
- Reuse the principle: Figma = source of truth -> measurable DOM/screenshot diff -> bounded corrections.
- Do **not** run its one-line installer, auto dependency install, Figma PAT flow, or global agent install without a separate Work Order.
- Existing CODE1 Figma connector and project credentials remain authoritative.

#### cathrynlavery/diagram-design
URL: https://github.com/cathrynlavery/diagram-design

Function:
- Editorial architecture, flow, sequence, journey, dependency, UML, database, and other diagrams.
- Produces self-contained HTML + SVG and emphasizes static output by default.
- Can redraw Mermaid/draw.io/Excalidraw concepts into a more editorial visual grammar.
- GitHub metadata checked 2026-09-19: active, MIT.

CODE1 use:
- Reference for proposal diagrams, Admin/flow explanation graphics, and planning artifacts.
- Prefer semantic clarity and restrained editorial presentation; do not copy unrelated brand styling.

#### tt-a1i/archify
URL: https://github.com/tt-a1i/archify

Function:
- Verifiable architecture/workflow/sequence/data-flow/lifecycle diagrams.
- Self-contained HTML, motion/static export, source-linked architecture mapping, named paths/views, validation receipts.
- GitHub metadata checked 2026-09-19: active, MIT.

CODE1 use:
- Reference for CODE1 architecture, message flow, state-flow, and permission diagrams where traceability matters.
- Use source-evidence and verification concepts rather than installing the skill by default.
- Complements `diagram-design`: Archify is source/verifiability-oriented; diagram-design is editorial/explanatory.

#### shadcn-ui/ui
URL: https://github.com/shadcn-ui/ui

Function:
- Composable accessible UI component patterns and source-level examples.
- React/Next.js/Tailwind ecosystem, accessibility-oriented primitives.
- GitHub metadata checked 2026-09-19: active, MIT.

CODE1 use:
- Reference for interaction semantics, accessible component anatomy, keyboard/focus behavior, and state patterns.
- **Reference only** unless a later Work Order explicitly permits component adoption.
- Do not convert CODE1 into a shadcn-looking interface or add a UI-library dependency merely because a matching component exists.

#### yanliudesign/mono-color-skill
URL: https://github.com/yanliudesign/mono-color-skill

Function:
- One-ink editorial image direction: warm paper, halftone photography, negative space, restrained typography.
- GitHub metadata checked 2026-09-19: active, MIT.

CODE1 use:
- Optional DESIGN-track reference for editorial campaign assets, magazine-like graphics, or restrained monochrome compositions.
- Not a global CODE1 visual-system authority.

### Agent skill and harness structure

#### vercel-labs/agent-skills
URL: https://github.com/vercel-labs/agent-skills

Function:
- Vercel's official agent-skill collection.
- Includes web-design-guidelines, React/Next performance rules, composition patterns, writing guidelines, view transitions, and deployment-oriented skills.
- GitHub metadata checked 2026-09-19: active. Repository-level license was not exposed by GitHub metadata at review time.

CODE1 use:
- Read-only source for **web interface QA**, React/Next patterns, accessibility/touch/focus checks, and skill packaging ideas.
- Do not execute Vercel deployment skills or infer Vercel as CODE1 infrastructure.
- License must be verified at the relevant file/skill level before copying source content.

#### anthropics/skills
URL: https://github.com/anthropics/skills

Function:
- Public Agent Skills examples, specification, template, and skill packaging patterns.
- README states many skills are Apache-2.0 while some document skills are source-available rather than open source.

CODE1 use:
- Reference for **SKILL.md structure**, scope descriptions, reusable workflow packaging, and tool-specific skill design.
- Do not copy a sub-skill until that subfolder's actual license is verified.
- CODE1 Durable SSOT and Harness remain higher authority than any skill.

### Marketing, SEO, campaign, and research

#### coreyhaines31/marketingskills
URL: https://github.com/coreyhaines31/marketingskills

Function:
- Agent skills for CRO, copywriting, SEO, analytics, growth engineering, retention, launch, pricing, customer research, ads, and content.
- Skills are structured around a product-marketing foundation and cross-reference related workflows.
- GitHub metadata checked 2026-09-19: active, MIT.

CODE1 use:
- Reference for CODE1 campaign design, 100원/2,000원 experiment planning, lifecycle messaging, SEO/content briefs, retention/churn logic, and measurement checklists.
- Business rules and prices always come from CODE1 SSOT, not the repo.

#### nowork-studio/notfair-plugin
URL: https://github.com/nowork-studio/notfair-plugin

Function:
- SEO, GEO/AEO, paid-media, analytics, WordPress/CRM, and ad-platform agent workflows.
- Explicit read-before-write and approval boundaries are part of its operating model.
- GitHub metadata checked 2026-09-19: active, MIT.

CODE1 use:
- Reference for audit structure, evidence-first marketing review, paid-media approval boundaries, SEO/GEO checklists.
- Do not connect Google/Meta/X/LinkedIn/Reddit/TikTok/WordPress/CRM accounts or OAuth from this project without separate approval.
- Prefer `coreyhaines31/marketingskills` for general planning; use NotFair for provider-specific operational patterns.

#### mvanhorn/last30days-skill
URL: https://github.com/mvanhorn/last30days-skill

Function:
- Recent-topic research workflow spanning Reddit, X, YouTube, HN, Polymarket, GitHub and web sources, then synthesizing a recency-focused brief.
- GitHub metadata checked 2026-09-19: active, MIT.

CODE1 use:
- Planning-only reference for **recent trend/reaction research methodology**.
- Do not add browser sessions, social credentials, platform tokens, or third-party data collection to CODE1 runtime.
- Public-web research should continue using approved ChatGPT/web tools.

### Notification, observability, communications, and media

#### novuhq/novu
URL: https://github.com/novuhq/novu

Function:
- Multi-channel notification/communication infrastructure: in-app inbox, email, push, SMS, chat, workflows, digests, preferences, unified conversations.
- GitHub metadata checked 2026-09-19: active. GitHub license detector returned NOASSERTION.

CODE1 use:
- Strong architecture reference for notification center, preference management, digest/workflow concepts, provider abstraction, and future multi-channel delivery.
- Do not embed Novu or add provider integrations until the CODE1 notification/data/privacy architecture is separately approved.
- Existing CODE1 notification UI/state semantics remain authoritative.

#### openreplay/openreplay
URL: https://github.com/openreplay/openreplay

Function:
- Self-hosted session replay, technical DevTools context, product analytics, live assist, privacy masking, errors/network/state/performance capture.
- README states the monorepo uses several licenses.
- GitHub metadata checked 2026-09-19: active.

CODE1 use:
- Future reference for reproducing hard UI defects and measuring real-user interaction failures.
- Requires privacy/legal/data-retention review before any tracker is added.
- No session capture, user recording, or analytics integration is authorized by this registry.

#### cloudflare/agentic-inbox
URL: https://github.com/cloudflare/agentic-inbox

Function:
- Self-hosted email client with an AI agent running on Cloudflare Workers.
- GitHub metadata checked 2026-09-19: active, Apache-2.0.

CODE1 use:
- Conditional architecture reference if CODE1 later needs Cloudflare-native inbound/outbound email handling or AI-assisted communication triage.
- Not part of current CODE1 frontend/backend scope.

#### heygen-com/hyperframes
URL: https://github.com/heygen-com/hyperframes

Function:
- HTML/CSS/media/animation -> deterministic video rendering.
- Agent skills cover product-launch videos, explainers, PR videos, captions, talking-head recuts, and motion graphics.
- GitHub metadata checked 2026-09-19: active, Apache-2.0.

CODE1 use:
- Future reference for programmatic product/campaign videos from approved CODE1 assets.
- No renderer, FFmpeg/Puppeteer pipeline, or media-generation dependency is added now.

#### papermark/papermark
URL: https://github.com/papermark/papermark

Function:
- Open-source DocSend-style secure document/data-room sharing with analytics and custom domains.
- GitHub metadata checked 2026-09-19: active; license detector returned NOASSERTION.

CODE1 use:
- Conditional reference for proposal/webdeck sharing analytics or controlled partner material distribution.
- Not part of consumer commerce frontend.
- License, authentication, analytics/privacy and hosting model require a separate review before adoption.

## 3. WATCH / do not promote yet

These have some technical relevance but currently overlap CODE1 infrastructure, create governance risk, or are not necessary enough to become active references.

- mksglu/context-mode — context-window optimization/persistent memory. Interesting for agent efficiency, but its persistent memory/router model must not compete with CODE1 Durable SSOT or Message Bus.
- devopness/devopness — DevOps/MCP automation. Overlaps current Cloudflare/CODING/ORCHESTRATOR responsibilities; no cloud credential or deployment authority.
- CapSoftware/Cap — screen recording utility. Useful as a developer tool, not a CODE1 application dependency.
- langgenius/dify — full AI workflow/RAG platform. Too broad and architecture-replacing for current CODE1.
- calesthio/OpenMontage — large agentic video-production system, AGPL-3.0. Reference only if a future media automation track is explicitly opened.
- designed-by-ai/skills — generic agent-skills repo; currently lower signal than Vercel/Anthropic references.
- SenteLabsAI/OpenExecutive — multi-agent virtual executive model conflicts with CODE1's explicit PLANNING dispatcher and track boundaries.
- tot ec equivalent in screenshot: `totec448-spec/chat-on-steroids` — local ChatGPT/browser/multi-agent workflow layer; conflicts with current Durable SSOT and browser/orchestrator restrictions.
- JuliusBrussee/caveman — token-saving proxy/prompt style; conflicts with precision and auditability required by CODE1.

## 4. SKIP for CODE1 current scope

### Finance/trading — unrelated to CODE1
- The-Swarm-Corporation/AutoHedge
- HKUDS/Vibe-Trading
- Fincept-Corporation/FinceptTerminal
- ccxt/ccxt

### Security/jailbreak / unrestricted-generation — not a CODE1 product need
- Marker-Inc-Korea/ko-jailbreak
- Anil-matcha/Open-Generative-AI
- Alishahryar1/free-claude-code

### Low-maturity or redundant short-video automation
- mzu-2410z/yt-automation
- AbdullahNaveed/ai-shorts-generator
- Dark2C/Viral-Faceless-Shorts-Generator
- harry0703/MoneyPrinterTurbo

HyperFrames is sufficient as the current future-video reference. OpenMontage stays WATCH because of its broader surface and AGPL license.

## 5. Screenshot identities not currently verifiable by GitHub API

The screenshot showed these owner/repo strings, but a direct current lookup/search did not resolve them during this audit. They are not added as active references until the identity can be re-established.

- AhmadIbrahim/Website-downloader
- AgricDaniel/claude-ads
- jo-inc/camoflox-browser
- chrock84/headcount
- LiamGvch/gc-minimal-zine-poster

Possible causes include rename, deletion, visibility change, or screenshot-age drift. Do not substitute a similarly named repository without evidence.

## 6. Reuse rules

1. `READ_ONLY_REFERENCE` is the default.
2. No repo in this file may override:
   - user latest instruction
   - CODE1 CURRENT / Snapshot / Baton / Planning Delta
   - Message Bus and Work Orders
   - FROZEN decisions
   - legal/privacy/payment/data contracts
3. Do not run one-line installers, global skill installers, repo scripts, GitHub Actions, or external binaries based on this registry alone.
4. Do not add OAuth, API keys, Figma PATs, social/browser sessions, ad accounts, analytics trackers, notification providers, email providers, or cloud credentials without a separate authorized Work Order.
5. For source/code reuse, verify the exact file/subpackage license first. Repository-level metadata is not enough when the repo is mixed-license or NOASSERTION.
6. Favor **pattern extraction**:
   - accessibility/focus/touch patterns
   - measurable Figma fidelity
   - skill packaging
   - diagram semantics
   - marketing audit structures
   - notification preference/workflow concepts
   - session-replay/privacy architecture
7. Do not copy external visual identity or generic "AI-looking" styles into CODE1.
8. Any actual dependency/import/runtime/provider adoption requires CODING review and Planning dispatch.
9. Any DESIGN/Figma use remains DESIGN-owned through Planning.
10. Any future use should cite the exact owner/repo and this registry entry.

## 7. Suggested future triggers

- UIUX visual/accessibility review -> `nextlevelbuilder/ui-ux-pro-max-skill`, `vercel-labs/agent-skills`, `shadcn-ui/ui`
- Figma exact-copy verification -> `3x-haust/Mimikyu` concepts only
- Architecture/flow documentation -> `tt-a1i/archify` and/or `cathrynlavery/diagram-design`
- Skill authoring / Harness packaging -> `anthropics/skills`, `vercel-labs/agent-skills`
- Campaign / CRO / lifecycle message planning -> `coreyhaines31/marketingskills`
- Provider-specific SEO/paid-media audit patterns -> `nowork-studio/notfair-plugin`
- Current-trend research methodology -> `mvanhorn/last30days-skill`
- Notification architecture -> `novuhq/novu`
- UI incident reproduction / product analytics research -> `openreplay/openreplay`
- Cloudflare-native communication architecture -> `cloudflare/agentic-inbox`
- Programmatic approved-asset video generation -> `heygen-com/hyperframes`
- Editorial campaign art direction -> `yanliudesign/mono-color-skill`
- Secure proposal/document sharing research -> `papermark/papermark`

## 8. Evidence notes

Reviewed from the user's two GitHub Stars screenshots on 2026-09-19.
Screenshot SHA-256:
- `0f813d2a9fe8c754b8756edf2eac3caa15130d87b1cad4d6bf3d30d14b2cd497`
- `afa0317207ee9ea9fdf18af4ac792ac36ef639a24750e1cdf1bc05a1f01cb677`

Harness de-duplication authority:
- `00_Git Harness 전체 색인·저장소별 범용 카드 v1.0`
- Current registry count observed during this audit: 51 repositories.

No clone/install/build/runtime/provider/credential/Production/main mutation was performed.
