# SUNUSOCIAL — Project Review & Pre-Implementation Checklist

| | |
|---|---|
| **Date** | 29 October 2026 (rev. 4: Convex sub-skills added, SUNUSOCIAL's setup checklist, payout-number verification) |
| **Scope** | Whole repository: docs, design, prototype, `.claude/skills` |
| **Audience** | Developers joining the build, and the project owner |
| **Companion docs** | `DECISIONS.md` (authoritative) · `BOARD_QUESTIONS.md` (open questions, in French) · root `CLAUDE.md` (entry point for agents) |

---

## 1. Where the project stands

| Area | State | Notes |
|---|---|---|
| Product definition | ✅ Done | `context.md` + `PRD.md`, aligned with both rounds of board answers |
| Decisions | ✅ Logged | `DECISIONS.md`: 15 board decisions, 31 technical decisions, all config values |
| Architecture, schema, API, security | ✅ Aligned | NabooPay API v2 (checked against the `naboopay` skill), SMS codes, payout worker, extension requests, activity log |
| Plan | ✅ Updated | `IMPLEMENTATION_ROADMAP.md`: 8 one-week sprints, all 📋 Planned |
| Agent setup | ✅ Done | Root `CLAUDE.md` + 15 skills in `.claude/skills/` |
| Design | ✅ Delivered | Charte PDF + logo + prototype (updated to the 29/10 decisions in rev. 5) |
| Open board questions | 🟠 9 + setup checklist | `BOARD_QUESTIONS.md`: questions Q1–Q9 + part E (what SUNUSOCIAL creates and sends us), ready to send |
| Repo setup | ✅ Done | PR + issue templates, `.editorconfig`, `.nvmrc` (Node 20), `.gitattributes`, `dev` branch |
| Code, CI, tests | ❌ Not started | Sprint 1 |

---

## 2. Skills: what was in `SunuSkill.zip`

The zip held 11 skills. I read every `SKILL.md`, the scripts and the reference files before adding them.

### ✅ Added to `.claude/skills/` (10)

| Skill | Notes |
|---|---|
| `naboopay` | **Key skill.** Covers NabooPay API v2: transactions, webhooks, payouts, error handling. Reading it changed the payment design (§3) |
| `convex` | ⚠️ An **index only**. It points to sub-skills that aren't in the zip (see below) |
| `convex-functions` | Queries, mutations, actions, `httpAction`, validators |
| `shadcn-ui` | Large reference (~1,900 lines plus references) |
| `vercel-react-best-practices` | |
| `vercel-composition-patterns` | |
| `web-design-guidelines` | Downloads Vercel's guidelines from GitHub each time it runs (normal) |
| `contrast-checker` | Its `allowed-tools` lists an `accesslint` MCP server that isn't installed. It still works by computing ratios directly |
| `create-pull-request` | |
| `design-audit` | |

### ❌ Not added: `vercel-deploy`

Its `scripts/deploy.sh` packs the **whole project folder** and uploads it to a third-party "claimable deploy" endpoint (`claude-skills-deploy.vercel.com`).
- It excludes only `node_modules` and `.git`, so a local `.env.local` with the NabooPay and SMS keys **would be uploaded too**.
- Deployments should go through the SUNUSOCIAL Vercel project's Git integration instead.

### ➕ Convex sub-skills (added in rev. 4)

Source: `github.com/waynesutton/builder-skills` (commit `82d1ce2`, 27/09/2026). All five were read before adding:

| Skill | Notes |
|---|---|
| `convex-http-actions` | Webhook pattern (raw body, HMAC, constant-time compare) matches the NabooPay webhook design |
| `convex-file-storage` | Store `Id<"_storage">`, resolve URLs in queries. Matches DT-12 |
| `convex-cron-jobs` | Release, pending re-check, reconciliation and suspension crons |
| `convex-schema-validator` | |
| `convex-security-check` | Its example looks users up by `tokenIdentifier` (the Clerk style). With Convex Auth, use `getAuthUserId(ctx)` inside our `requireRole` helper |

**Install notes:**
- `npx skills add … -s a -s b` only installs the **last** `-s`.
- Four of the upstream `SKILL.md` files have invalid YAML front matter: an unquoted `: ` in `description`. The CLI skips them, and Claude Code may fail to load them.
- So those four were copied straight from the repo with the description quoted. Nothing else was changed.
- `skills-lock.json` was removed, because it could only track one of the five. If you update these skills from upstream, re-apply the quoting.
- Not added (not needed yet): `convex-best-practices`, `convex-migrations`, `convex-realtime`, `convex-security-audit`.

---

## 3. What the NabooPay API review changed

| Finding (from the `naboopay` skill) | Impact | Where it's handled |
|---|---|---|
| Payments land in **SUNUSOCIAL's merchant account**; structures are paid by **payouts** | The original "no central account" assumption was wrong: SUNUSOCIAL temporarily holds donor funds | DECISIONS §1 correction, board Q4 |
| Organisations not yet verified (KYB) are capped at **200,000 XOF/month** | Launch blocker until SUNUSOCIAL completes KYB | Board Q4 + Q7 |
| `is_escrow` needs per-account activation and has **no documented release endpoint** | The hold is done in the app ledger (funds stay in the main account) | DT-3 |
| Refunds: **full amount only**, sent through a `GET` request | The board decided on net refunds, so refunds are made as **payouts** | DB-13, DT-7 |
| **One payout at a time** (409), **no idempotency key**, > 2M XOF goes to manual review | A single-flight payout worker that never resends after a timeout, plus reconciliation | DT-4 |
| Webhooks are sent **only on success**, with 3 retries 5 minutes apart, signed with `X-Signature` HMAC | Success page + cron re-check pending payments; raw-body verification | DT-3 |
| The actual `fees` come back in the webhook | Store the real fee, not the 3% estimate | DT-6 |
| Separate API key scopes | Separate `checkout` and `payout` keys | DT-4, `.env.example` |

---

## 4. Decisions from this round (summary)

**SMS is required** for:
- the 2FA code of structures, hospitals and moderators;
- verifying a donor's phone at signup;
- donor password recovery;
- blood alerts and important notifications.

**Everything else decided in this round:**
- Sessions last at most 7 days.
- Donor activity is logged.
- Hospitals send their own blood alerts.
- A cause lasts at most 30 days, with extensions approved by a moderator.
- A proof is mandatory for every funded cause, with delays approved by a moderator.
- Refunds return the net amount.
- The minimum donation is 500 FCFA for now.
- The payout account is the responsible's OM/Wave number and name, with a second onboarding phase.

All of this is reflected across the docs. The rev. 1 interim measures that no longer apply are gone: email codes, the WhatsApp-assisted reset, the 12-hour moderator sessions and the feature flags.

---

## 5. What remains

### Waiting on the board: send `BOARD_QUESTIONS.md`

| # | Question | Blocks |
|---|---|---|
| Q1 | SMS provider, budget, sender ID | **Launch**: donor signup needs SMS |
| Q2 | Revenue model | The fee line shown to donors |
| Q3 | List of the 14 regions and their communes | Signups, alerts |
| Q4 | Acknowledge the money flow through SUNUSOCIAL's NabooPay account | Payouts |
| Q5 | Content and gating of onboarding phase 2 | Payouts, if phase 2 becomes mandatory |
| Q6 | Review the 500 FCFA minimum | Nothing |
| Q7–Q9 | Legal status, CDP declaration, legal documents | NabooPay KYB, blood module, go-live |
| Part E | **SUNUSOCIAL's setup checklist:** NabooPay account + KYB (lifts the 200k XOF/month cap) + scoped API keys + webhook; SMS account + sender ID; domain + DNS; WhatsApp; first moderator; billing card | Collecting donations, go-live |

### Waiting on JefTech / the project owner
1. **Create the Vercel, Convex and Resend accounts** (JefTech administers them; SUNUSOCIAL's card pays, DT-32).
2. **Help SUNUSOCIAL with the NabooPay setup** (part E1). Ask NabooPay:
   - whether escrow has a release API;
   - whether payouts have any fees;
   - whether the 2,000,000 XOF manual-review threshold can be raised for a verified account, and how long the review takes.
3. Pick a **secrets-sharing tool** for the API keys (e.g. Bitwarden Send or 1Password).
4. ~~Update the prototype~~ **Done (rev. 5).** NabooPay only (provider toggle removed), SMS code at donor and structure signup, payout account for structures only, 30-day causes with extension and proof-delay requests (structure + moderator queue), net refunds, and the Specifications register rewritten with the 29/10 decisions. Tested in Chromium with Playwright.

### Ready to build now
**Sprints 1 to 5 can start immediately.** Development uses `PAYMENT_PROVIDER=mock` and `SMS_PROVIDER=console`, so nothing waits on the board until go-live.

To go live with real money, these still have to be in place: Q1, Q2, Q4, Q7 and part E1 (NabooPay KYB + live keys), plus E3 (domain) and E4 (first moderator).
