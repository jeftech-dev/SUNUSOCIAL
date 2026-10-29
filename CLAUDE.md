# SUNUSOCIAL

French-language web platform (Senegal) connecting donors with verified social structures. Donations go through mobile money (Orange Money / Wave) via NabooPay. Stack: Next.js App Router + React 19 + TypeScript strict, Convex (+ Convex Auth), Tailwind CSS + shadcn/ui, deployed on Vercel.

## Read first
1. `docs/DECISIONS.md` — **authoritative**. Every decision (`DB-*` board, `DT-*` technical) and the config values. If another doc disagrees, this one wins.
2. `docs/TECHNICAL_ROADMAP.md` — file tree, types, function signatures, data flows, build order.
3. `docs/DATABASE_SCHEMA.md` and `docs/API_CONTRACT.md` — tables and payloads.
4. `docs/IMPLEMENTATION_ROADMAP.md` — current sprint.
5. `docs/BOARD_QUESTIONS.md` — open product questions. Never invent an answer in code: use the interim default from `DECISIONS.md` §3.

`prototype/` is the clickable HTML reference for screens and French copy — port from it; don't edit it while building features (it's only updated when a product decision changes, so the client demo stays accurate). It loads React/Babel from unpkg and is served as static files (Netlify config in `prototype/netlify.toml`). `prototype/_ds` ("Industry") is reference only; the charte graphique (`design/`) wins.

## Non-negotiables
- **Money:** integer FCFA only; use `lib/money.ts`; `fee + platformFee + net === amount`. Never trust client-side amounts or statuses.
- **NabooPay:** follow `.claude/skills/naboopay`. Verify `X-Signature` on the raw body; store `order_id` before redirecting; treat `paid` and `paid_and_blocked` as paid. **All payouts go through the single payout worker; never resend a payout after a timeout or 5xx — reconcile.** Don't call NabooPay's refund endpoint (refunds are net-amount payouts).
- **Auth:** every Convex function checks role/ownership server-side (`requireRole`, `requireOwner`); structure/hospital/moderator sessions need the SMS code; the moderation app is only served on the moderation subdomain.
- **Audit:** moderation decisions, payouts, payout-account changes and donor activity go to `auditLog`.
- **Copy:** user-facing strings in French, centralised in `lib/strings.fr.ts`; code, comments and commits in English.
- **Design:** charte tokens only (Montserrat / Inter; `#a9561a` for white-text orange buttons — check new colour pairs with `contrast-checker`).

## Commands (once scaffolded)
- `npx convex dev` + `npm run dev` (app on `localhost:3000`, moderation on `moderation.localhost:3000`)
- `npm run lint`, `npm run typecheck`, `npm test`
- Local env: `PAYMENT_PROVIDER=mock`, `SMS_PROVIDER=console` (codes appear in the Convex logs).

## Workflow
Branch off `develop` (`feat/`, `fix/`, `chore/`, `infra/`), Conventional Commits, PR into `develop`. See `CONTRIBUTING.md`.
