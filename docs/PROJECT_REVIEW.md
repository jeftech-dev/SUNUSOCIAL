# SUNUSOCIAL — Project Review & Pre-Implementation Checklist

| | |
|---|---|
| **Date** | 29 October 2026 (rev. 3: second round of board answers, skills installed, NabooPay API reviewed) |
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
| Agent setup | ✅ Done | Root `CLAUDE.md` + 10 skills in `.claude/skills/` |
| Design | ✅ Delivered | Charte PDF + logo + prototype. ⚠️ The prototype is now **out of date** (§5) |
| Open board questions | 🟠 10 | `BOARD_QUESTIONS.md`, ready to send |
| Code, CI, tests | ❌ Not started | |

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

### ➕ Worth adding later

The `convex` index points to these sub-skills, which are missing:
- **High value:** `convex-http-actions`, `convex-file-storage`, `convex-cron-jobs`, `convex-schema-validator`, `convex-security-check`, `convex-best-practices`.
- **Useful:** `convex-migrations`.

If they're available from the same source, drop them into `.claude/skills/`. There's no skill for Convex Auth; its documentation is enough.

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
| Q4 | Acknowledge the NabooPay money flow + start KYB | Collecting more than 200k XOF/month |
| Q5 | Content and gating of onboarding phase 2 | Payouts, if phase 2 becomes mandatory |
| Q6 | Review the 500 FCFA minimum | Nothing |
| Q7–Q9 | Legal status, CDP declaration, legal documents | NabooPay KYB, blood module, go-live |
| Q10 | Domain, WhatsApp, accounts, first moderator | Go-live |

### Waiting on JefTech / the project owner
1. **NabooPay:** create the SUNUSOCIAL organisation and get sandbox keys (`checkout` scope + `payout` scope). Ask them:
   - whether escrow has a release API;
   - whether payouts have any fees;
   - what the transaction limits are.
2. **Accounts:** Vercel, Convex and Resend in SUNUSOCIAL's name.
3. **Optional:** add the missing Convex sub-skills (§2).
4. **Update the prototype** before showing it to the client again. It still has:
   - the NabooPay/SycaPay toggle;
   - the moderator creating blood alerts;
   - no SMS code step at donor signup;
   - no extension or delay requests;
   - a Specifications register that lists decisions as "À valider" when they are now decided.

### Ready to build now
**Sprints 1 to 5 can start immediately.** Development uses `PAYMENT_PROVIDER=mock` and `SMS_PROVIDER=console`, so nothing waits on the board until go-live.

To go live with real money, these still have to be in place: Q1, Q2, Q4/Q7 (KYB), the NabooPay live keys, the domain, and the first moderator.
