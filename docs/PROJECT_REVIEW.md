# SUNUSOCIAL — Project Review & Pre-Implementation Checklist

| | |
|---|---|
| **Date** | 29 October 2026 (revised after the board's answers) |
| **Scope** | Whole repository: docs, design, prototype |
| **Audience** | Developers joining the build, and the project owner |
| **Companion docs** | `DECISIONS.md` (everything decided, authoritative) · `BOARD_QUESTIONS.md` (what the board still has to answer, in French) |

---

## 1. Where the project stands

**None of the production app exists yet.** The repo holds a complete pre-build package. As of this revision, the core product and technical decisions are taken.

| Area | State | Notes |
|---|---|---|
| Product definition | ✅ Done | `context.md` + `PRD.md`, updated with the board's decisions |
| Decisions | ✅ Logged | `DECISIONS.md`: 6 board decisions (DB-1…6) and 29 technical decisions (DT-1…29) |
| Architecture, schema, API, security | ✅ Aligned | Rewritten for NabooPay with funds held, Convex Auth, payout accounts, audit log |
| Plan | ✅ Updated | `IMPLEMENTATION_ROADMAP.md`: 8 one-week sprints, all 📋 Planned |
| Design | ✅ Delivered | Charte PDF + logo + clickable prototype (`prototype/`) |
| Open product questions | 🟠 13 left | `BOARD_QUESTIONS.md`: none of them blocks Sprint 1 |
| Code, CI, tests | ❌ Not started | |

**Decided by the board:**
- NabooPay is the payment provider, and funds are held until the cause ends.
- Structures are verified from their documents only, approved or refused by a moderator.
- The structure is paid in one lump sum.
- Every cause has a deadline, and funds are released at the goal or the deadline, whichever comes first.
- The moderator curates the weekly "Coup de cœur".

---

## 2. Skills for the repo (`.claude/skills/`)

Claude Code only loads project skills from **`.claude/skills/<name>/SKILL.md`**. A top-level `skills/` folder isn't read. This verdict is based on the folder names in the two screenshots; skim each `SKILL.md` before copying it in.

### ✅ Core: add these 8

| Skill | Why |
|---|---|
| **`naboopay`** | **The most important one.** NabooPay is now the provider, and Sprint 4 starts with a spike on its API (DT-3) |
| `convex` | The whole backend: schema, functions, crons, file storage |
| `convex-functions` | Validators, internal functions, `httpAction` webhooks, scheduling |
| `shadcn-ui` | Tailwind + shadcn/ui is now the styling decision (DT-10) |
| `vercel-react-best-practices` | Next.js App Router / React patterns |
| `vercel-composition-patterns` | Shared component architecture |
| `web-design-guidelines` | UI and accessibility review |
| `contrast-checker` | The charte's orange needed a darker shade (DT-11); check every new colour pair |

### 🟡 Optional

| Skill | When to add it |
|---|---|
| `domain-modeling` | Useful in Sprint 1 to pin down the cause, donation and refund state machines. Keep it if it's a generic modelling skill |
| `grill-with-docs` | Useful for challenging a plan or PR against `DECISIONS.md` before building. A personal review habit rather than project knowledge |
| `vercel-deploy` | Only if agents deploy from the CLI. With Vercel's Git integration it isn't needed |
| `create-pull-request` | If agents will open PRs into `develop` |
| `design-audit` | For the Sprint 8 polish pass |

### ❌ Leave out

| Skill(s) | Reason |
|---|---|
| `Doc-bundle` | It generated the original docs, which have since been edited by hand and reconciled with `DECISIONS.md`. **Re-running it would overwrite those edits.** Keep it at user level for future projects |
| `lab-workflow`, `lecture-notes-builder` (and their `.zip` copies) | Unrelated to this project |
| `grilling` | Superseded by `grill-with-docs` for this repo |
| All `expo-*`, `building-native-ui`, `native-data-fetching`, `use-dom`, `upgrading-expo`, `vercel-react-native-skills` | Native apps are Phase 2 |
| `bencium-*`, `agentic-ux-…`, `ui-ux-pro-max`, `frontend-design`, `ui-typography`, `use-of-color`, `figma-implement-design` | The design is fixed by the charte and the prototype. These would invite redesigns, and there is no Figma |
| `mcp-builder`, `skill-creator`, `find-skills`, `artifacts-builder`, `agent-md-refactor` | Personal agent tooling |
| `skills-lock.json` | Only if you install with the `skills` CLI. In that case, regenerate it for the kept set |
| **`synced`** | ❓ Can't tell from the name. What does it do? |

Next step: copy the core 8 skills, then add a short root `CLAUDE.md` pointing agents to `DECISIONS.md`, `TECHNICAL_ROADMAP.md` and `context.md`.

---

## 3. Contradictions found in the first review — all resolved

| # | Topic | Resolution |
|---|---|---|
| C1 | Org/moderator login | `context.md` updated: email + password ≥ 12 chars + one-time code |
| C2 | 2FA depended on unapproved SMS | Codes go by email (Resend) until SMS is approved. `OTP_CHANNEL` switches the channel (DT-2) |
| C3 | Who creates blood alerts | Moderator now. Hospital self-serve is built behind a flag (DT-26). Final answer: board Q2 |
| C4 | Sprint numbering | PRD timeline aligned with the roadmap |
| C5 | 5 MB cap vs video proofs | Images and PDFs ≤ 5 MB, video ≤ 50 MB / 90 s (DT-12) |
| C6 | "Separate URL" vs `/moderation` path | `moderation.<domain>` subdomain, host-routed in middleware (DT-9) |
| C7 | Industry design system vs charte | The charte wins. Industry is reference only (DT-10) |
| C8 | Proof deadline for normal causes | Tracked for every release. Enforcement for normal causes is behind a flag (DT-25). Final answer: board Q6 |

## 4. Technical gaps — all resolved in `DECISIONS.md`

| Gap | Decision |
|---|---|
| No payout destination for structures | `structures.payout`, verified by the moderator; changes are re-reviewed and block payouts (DT-5) |
| Custom auth, Argon2 in mutations | Convex Auth (DT-1) |
| Webhook location unclear | Convex `httpAction` in `convex/http.ts` (DT-3) |
| Numbered migrations | `@convex-dev/migrations` + seeds (DT-21) |
| Money rounding, gross vs net, `donorCount` | DT-6 |
| `pending` hides two statuses; withdraw vs delete | New status set (DT-8) |
| Auto-flagging had no spec | dHash, EXIF, invoice-ref and spend checks (DT-13) |
| Donor password reset without OTP | WhatsApp-assisted reset now, SMS later (DT-15) |
| No email provider | Resend (DT-16) |
| No notifications table, audit log, rate limiter, admin bootstrap | DT-17, DT-18, DT-19, DT-20 |
| Geo data in two places | A single `lib/geo.ts` (DT-22) |
| No testing or CI | Vitest + convex-test + Playwright + GitHub Actions (DT-23) |
| White-on-orange contrast at 2.97:1 | `#a9561a` for CTA buttons, 5.2:1 (DT-11) |
| Goal reached early: what happens? | Cause closes and funds are released at once (DT-24) |

## 5. What remains with the board

See **`BOARD_QUESTIONS.md`**, written in French and ready to send. In short:
- **High priority:** SMS (Q1), who sends blood alerts (Q2), revenue model (Q3), commune list (Q4), CDP declaration (Q10), legal status (Q11).
- **Medium priority:** maximum cause duration, proof deadline for every cause, refund fees, payout-account holder name, legal documents, domain and accounts.
- **Low priority:** minimum donation amount.

Every open rule has an interim default behind a config value (`DECISIONS.md` §3), so **Sprints 1–5 can run in full without waiting.** Going live with real money still needs Q3, Q7, Q9, Q11 and the NabooPay merchant account.

## 6. Next actions

1. Send `BOARD_QUESTIONS.md` to Ngoné Gueye.
2. Copy the 8 core skills into `.claude/skills/` and add a root `CLAUDE.md`.
3. Ask NabooPay for sandbox access and API docs (escrow, payouts, refunds, webhook signature) ahead of the Sprint 4 spike.
4. Start Sprint 1.
