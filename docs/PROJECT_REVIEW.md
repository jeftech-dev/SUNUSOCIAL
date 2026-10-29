# SUNUSOCIAL — Project Review & Pre-Implementation Checklist

| | |
|---|---|
| **Date** | 29 October 2026 |
| **Scope** | Whole repository as of commit `ff04be9` (docs, design, prototype) |
| **Audience** | Developers joining the build, and the project owner preparing board questions |

---

## 1. Where the project stands

**Nothing of the production app exists yet.** The repo is a complete *pre-build* package:

| Area | State | Notes |
|---|---|---|
| Product definition | ✅ Done | `context.md` + `docs/PRD.md`, P0/P1/P2 stories with acceptance criteria |
| Architecture & data model | ✅ Drafted | `ARCHITECTURE.md`, `DATABASE_SCHEMA.md` (13 tables), `TECHNICAL_ROADMAP.md` (types, function signatures, file tree) |
| API | ✅ Drafted | `API_DESIGN.md` + `API_CONTRACT.md` (Convex functions, error envelope, rate limits) |
| Security | ✅ Drafted | `SECURITY.md`: threat model, authz rules, webhook verification, incident response |
| Plan | ✅ Drafted | `IMPLEMENTATION_ROADMAP.md`: 8 one-week sprints, every task 📋 Planned |
| Design | ✅ Delivered | Charte graphique PDF + logo; 10 clickable HTML screens in `prototype/` (V1 + V2) |
| Decision log | ✅ Live | `prototype/Specifications.dc.html`: the "Décidé / À valider / Hypothèse" register (last entries 12/10/2026) |
| Code (`app/`, `convex/`, `lib/`, `package.json`) | ❌ Not started | Sprint 1 has not begun |
| CI, tests, lint config | ❌ None | |
| Vercel / Convex projects | ❓ Unknown | Not referenced anywhere in the repo |

According to the Specifications register, **backend development is paused until the payment provider is chosen**. That is the right call: the provider decides how money flows, how deletions and refunds work, and much of the schema.

**Overall:** the documentation is thorough and mostly consistent. The gaps are (a) unresolved board decisions, (b) a few contradictions between documents, and (c) a few technical details that don't match how Convex works. All three are listed below.

---

## 2. Recommended skills for the repo (`.claude/skills/`)

Phase 1 is a **Next.js + Convex web app deployed on Vercel**. Native apps are out of scope until Phase 2, so every Expo / React Native skill should be left out. Too many design skills is also a risk: the charte and the prototype already settle the visual direction, and overlapping "UX designer" skills would push agents to redesign the product instead of porting it.

> **Location:** Claude Code auto-discovers project skills only in **`.claude/skills/<name>/SKILL.md`**. A top-level `skills/` folder will not be loaded. Put the folders under `.claude/skills/`.

### ✅ Add these (core)

| Skill | Why |
|---|---|
| `convex` | The whole backend is Convex: schema, queries/mutations/actions, crons, file storage |
| `convex-functions` | Validators, internal functions, HTTP actions (needed for payment webhooks), scheduling |
| `vercel-react-best-practices` | Next.js App Router / React performance and data-fetching patterns |
| `vercel-composition-patterns` | Component architecture for the shared UI (CauseCard, DonationModal, ProofGallery…) |
| `web-design-guidelines` | UI/accessibility review. Sprint 8 has an explicit a11y pass |
| `contrast-checker` | **Needed now:** the charte's orange fails contrast (see §5.4) |

### 🟡 Add only if the related decision goes that way

| Skill | Add if… |
|---|---|
| `shadcn-ui` | The team picks **Tailwind + shadcn/ui** for styling (undecided, see §4 Q-T4) |
| `vercel-deploy` | Deploys are run by agents/CLI. With Vercel's Git integration it isn't needed |
| `create-pull-request` | Agents will open PRs into `develop` per `CONTRIBUTING.md` |
| `design-audit` | Wanted for the Sprint 8 polish pass. Not useful before that |

### ❌ Leave out

| Skill(s) | Reason |
|---|---|
| `expo-api-routes`, `expo-cicd-workflows`, `expo-deployment`, `expo-dev-client`, `expo-tailwind-setup`, `upgrading-expo`, `building-native-ui`, `native-data-fetching`, `use-dom`, `vercel-react-native-skills` | Native mobile is Phase 2 (separate quote). Add them back then |
| `bencium-controlled-ux-designer`, `bencium-impact-designer`, `bencium-innovative-ux-designer`, `agentic-ux-design-relationship-centric-in…`, `ui-ux-pro-max`, `frontend-design` | Overlapping generative-design skills. The design is already fixed by the charte and the prototype, and these would invite redesigns |
| `ui-typography`, `use-of-color` | The charte already sets type (Montserrat / Inter) and the palette. `contrast-checker` covers the one real color issue |
| `figma-implement-design` | There is no Figma. The source of truth is the HTML prototype |
| `mcp-builder`, `skill-creator`, `find-skills`, `artifacts-builder`, `agent-md-refactor` | Personal agent tooling, not project knowledge. Keep them in your user-level skills folder |
| `skills-lock.json` | Copy it only if you install with the `skills` CLI. If you do, regenerate it so it lists just the kept skills |

**Result: 6 core skills, plus up to 4 conditional ones.** After the folders are copied in, add a short `CLAUDE.md` at the root that points agents to `context.md`, `docs/TECHNICAL_ROADMAP.md` and the Specifications register.

---

## 3. Contradictions between documents (fix before Sprint 1)

| # | Topic | Conflict | Suggested resolution |
|---|---|---|---|
| C1 | **Org / moderator login** | `context.md` §4: org = *phone + name + password*; moderator = *email + password*, no 2FA. PRD, SECURITY and the Specifications register (validated 12/10) say: org/hospital/moderator = **email + ≥12-char password + SMS 2FA** | The register is newer. Update `context.md` §4 |
| C2 | **2FA depends on SMS, but SMS is [OPEN]** | Org/moderator login *requires* SMS 2FA, and the SMS channel isn't approved | Board approval of SMS now blocks auth, not only blood alerts. Fallback until then: TOTP app or email code (see Q-B3) |
| C3 | **Who creates blood alerts** | `context.md` §10 / PRD: the moderator (prototype). Prototype `Hopital-v2` and the roadmap (`hopital/alerte` page, rate limit "per hospital"): hospitals self-serve | Build `createAlert` with a role check that allows both, behind a config flag. The long-term owner is Q-B4 |
| C4 | **Sprint numbering** | PRD §8: moderation in Sprint 6. IMPLEMENTATION_ROADMAP: moderation queues in Sprint 5, deletions/refunds in Sprint 6 | Align the PRD with the roadmap |
| C5 | **Upload size vs video proofs** | 5 MB cap on all uploads (ARCHITECTURE §6), but proof dossiers accept **video** | Set a separate limit for video (e.g. 50 MB, or 60 s), or compress on the client |
| C6 | **Moderation "separate URL"** | Docs say "separate platform, own URL", but `.env.example` sets `NEXT_PUBLIC_MODERATION_URL=…/moderation`, a path in the same app | Decide: a path in the same app, or a subdomain (e.g. `moderation.<domain>`) enforced with a host check in middleware. A subdomain matches the intent better |
| C7 | **Design-system base** | The `_ds/` "Industry" system is Barlow, steel blue, square blueprint frames and duotone photos. The charte is Montserrat/Inter, navy/orange/green. The prototype `Specifications` page already uses the charte | State that the charte wins and Industry only provides layout/component structure. Otherwise agents will follow `_ds/readme.md` literally |
| C8 | **Proof deadline for normal causes** | The 7-day deadline + auto-suspend is defined only for *deleted* causes. The PRD metric expects proofs for "100% of funded causes within 7 days" | Decide whether the 7-day rule applies to every funded cause (Q-P3) |

---

## 4. Open questions

### 4.1 Board / client decisions (SUNUSOCIAL)

| ID | Question | Blocks | Notes |
|---|---|---|---|
| **Q-B1** | **NabooPay or SycaPay?** | Sprint 4, Sprint 6, schema | This is the critical path. Escrow (NabooPay) and direct payout (SycaPay) lead to two different products |
| Q-B2 | **Hold funds, or direct payout with checks afterwards?** | Same as Q-B1 | Largely the same decision. If SycaPay is chosen, the refund flow, the deletion "refund" option and `held` status all disappear |
| Q-B3 | **SMS approval**: provider, budget, dedicated sender ID | Sprint 2 (2FA), Sprint 7 (alerts) | See C2. Also needed for donor password reset (Q-T6) |
| Q-B4 | **Blood alerts: hospital self-serve or moderator only?** | Sprint 7 | See C3 |
| Q-B5 | **Revenue model**: % on donations or subscription for organizations | Fee math, donation modal copy | `lib/money.ts` only models the *provider* fee today. A SUNUSOCIAL % would add a second fee line, and the "net to structure" figure would change |
| Q-B6 | **Verifying structures**: documents only, or a physical visit? | Moderation workflow | Decides whether the "Vérifié" badge needs extra states (e.g. `visited`) |
| Q-B7 | **Lump-sum or split payouts?** | Payment adapter | From the 10/10 meeting minutes, still with SUNUSOCIAL |
| Q-B8 | **Release at goal OR deadline** [HYPOTHESIS] | Release cron | The Specifications register marks "Toute cause a une date limite" as *validated 12/10*. Confirm and remove the [HYPOTHESIS] tags in `context.md`, PRD and ARCHITECTURE |
| Q-B9 | **Official list of all 14 regions and their communes** | Sprint 1 (geo seed), blood targeting | The prototype covers 8 regions |
| Q-B10 | **Who curates "Coup de cœur", and from where?** | Sprint 3 | No moderation screen or function sets `featured`. Add `moderation.setFeatured` |

### 4.2 Legal & compliance (raise with the client, not decided in code)

| ID | Question |
|---|---|
| Q-L1 | **Personal-data law (Senegal Law n° 2008-12, CDP):** blood type is health data. Does SUNUSOCIAL need to declare to or get authorization from the CDP (Commission de Protection des Données Personnelles)? Convex and Vercel host data **outside Senegal**: is the cross-border transfer allowed? |
| Q-L2 | **SUNUSOCIAL's legal status** (association? NGO?) and whether public fundraising needs authorization. This affects what the payment provider requires to onboard SUNUSOCIAL as a merchant |
| Q-L3 | **Onboarding structures with the payment provider:** "funds go directly to the structure" means each structure needs a payout destination (wallet number, provider sub-merchant account, KYC). See T1 |
| Q-L4 | Terms of service, privacy policy and refund policy pages (French). None are planned in the roadmap |

### 4.3 Technical decisions (JefTech can decide)

| ID | Question | Recommendation |
|---|---|---|
| Q-T1 | Auth implementation | Use **Convex Auth** (`@convex-dev/auth`, Password provider; the phone number can be the identifier) rather than a fully custom session system. Password hashing (Argon2/bcrypt) needs a `"use node"` action, not a mutation |
| Q-T2 | Webhook endpoint | Use a **Convex `httpAction` in `convex/http.ts`**. Docs alternately describe a Convex action and a "Next.js route handler proxy"; pick the httpAction |
| Q-T3 | Migrations | Convex has no numbered migration files (`DATABASE_SCHEMA.md` §Migrations). Use `@convex-dev/migrations`, or one-off internal mutations for seeds and backfills |
| Q-T4 | Styling stack | Undecided: plain CSS ported from the prototype, CSS Modules, or Tailwind + shadcn/ui. Decide in Sprint 1, because it decides whether to add the `shadcn-ui` skill |
| Q-T5 | Proof auto-flagging | "Image similarity / metadata" has no spec. MVP suggestion: perceptual hash (duplicates across the platform) + missing or old EXIF date + duplicate invoice refs. External reverse-image search costs money, so leave it for later |
| Q-T6 | **Donor password reset without OTP** | The prototype shows "Mot de passe oublié ?" but no flow exists. Without SMS the options are: manual reset through WhatsApp support, or an SMS code once SMS is approved |
| Q-T7 | Email provider | The notification table sends emails (cause approved, account suspended), but no provider or env var exists. Suggestion: Resend, Brevo or similar |
| Q-T8 | Testing | No framework is named. Suggestion: Vitest + `convex-test` for backend logic (money math, state transitions, authz), and Playwright for the donate flow |
| Q-T9 | Geo data | Both `lib/geo.ts` and a `geo` table exist. Keep a single source: a static TS file is enough for a fixed list |
| Q-T10 | Domain name, WhatsApp number, Vercel/Convex team accounts and seats | Needed for Sprint 1 and Sprint 8. Infrastructure is billed per seat, so confirm the ~45,000 FCFA/month estimate against the real team size |

---

## 5. Technical gaps found in the docs

### T1 — No payout destination in the schema
`structures` has no field for *where the money goes* (Orange Money/Wave number, provider merchant/sub-account id, KYC status). Every payment path depends on it. Add it after Q-B1, plus a moderator step to verify it.

### T2 — Status model for causes
`causes.status` merges *Soumise* and *En modération* into `pending`, but the UI timeline shows both as separate steps. Either store both states or make the timeline show one. `withdraw` also needs its own terminal status (`withdrawn`), separate from `deleted`.

### T3 — Money integrity
- The fee is computed per donation. Define the rounding rule (floor? round?) and check that `Σ net + Σ fee = Σ amount`.
- `raised` holds the **gross** amount, while structures receive the **net**. Decide which one the progress bar and the goal check use.
- `donorCount` = "distinct donors". Updating it on each donation requires checking whether the donor already gave to that cause. Specify that check.

### T4 — Contrast (charte colors)
| Pair | Ratio | WCAG AA |
|---|---|---|
| White on Orange Teranga `#de7d28` | 2.97:1 | ❌ fails, even for large text |
| White on Vert Impact `#529e3b` | 3.33:1 | ⚠️ large text only |
| White on Bleu Confiance `#174a7c` | 9.1:1 | ✅ |
| Prune Nuit `#1e293b` on white | 14.6:1 | ✅ |

Orange is the CTA color ("Action"). Use dark text on orange, or a darker orange shade for buttons (e.g. `#b4601a`, which the Specifications page already uses).

### T5 — Missing operational pieces
Admin bootstrap (how the first moderator account is created), an audit-log table (referenced in SECURITY.md but missing from the schema), a notifications table for in-app notifications, and rate-limit storage (`@convex-dev/rate-limiter`).

---

## 6. What can start now, before the board decides

These parts don't depend on any open decision:

1. **Sprint 1 in full:** scaffold, schema (without payout fields), types, `lib/money.ts` with a pluggable rate, French strings, charte theme. Fix the contrast issue at the same time.
2. **Sprint 3:** causes feed and detail (read path), using seeded data.
3. **Sprint 5 (non-payment parts):** cause creation wizard, proof dossier upload and moderation queues.
4. The payment adapter **interface** with a `mock` provider. This unblocks the donation modal UI.
5. Donor auth (phone + password). Org/moderator login can ship with 2FA behind a flag, until SMS is approved.

**Blocked:** real checkout and webhooks, release cron, refunds and deletion fund outcomes (Q-B1/B2); SMS 2FA and blood SMS (Q-B3); the final geo seed (Q-B9).

---

## 7. Suggested next actions

1. Fix C1–C8 in the docs (one PR, `docs:` commits).
2. Send the board **Q-B1, Q-B3, Q-B5, Q-B9, Q-B10** and **Q-L1–Q-L3** as one written list; these are the decisions that block work.
3. Copy the 6 core skills into `.claude/skills/` and add a root `CLAUDE.md`.
4. Start Sprint 1 with the decisions from §4.3 (Q-T1 to Q-T4) recorded in `docs/ARCHITECTURE.md`.
