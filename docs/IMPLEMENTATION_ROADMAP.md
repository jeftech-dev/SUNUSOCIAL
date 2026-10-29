# SUNUSOCIAL — Implementation Roadmap

| | |
|---|---|
| **Version** | 1.0 |
| **Last Updated** | 29 October 2026 |
| **Total Sprints** | 8 |
| **Sprint Length** | 1 week |

The feature-by-feature sprint plan: what gets built, in what order, with a visible deliverable at the end of each sprint. It follows the Build Order in `TECHNICAL_ROADMAP.md` §7 and the P0/P1/P2 features in `PRD.md`.

## Status Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Done |
| 🔄 | In Progress |
| 📋 | Planned |
| ⏸ | Blocked |

---

#### Sprint 1 — Foundations
**Goal:** a running app wired to Convex with the full data model and reference data in place.
**Deliverable:** the app boots, Convex schema is live, and region→commune lists load.

| # | Task | Type | Files Involved | Status |
|---|------|------|----------------|--------|
| 1 | Scaffold Next.js (App Router, TS strict) + Convex + Tailwind/shadcn + lint/format + Vitest + CI | `infra` | `app/`, `convex/`, `tsconfig.json`, `package.json`, `.github/workflows/ci.yml` | 📋 |
| 2 | Define all tables + indexes | `feat` | `convex/schema.ts` | 📋 |
| 3 | Shared types | `feat` | `lib/types.ts` | 📋 |
| 4 | Fee math + FCFA formatting + invariant tests; product flags | `feat` | `lib/money.ts`, `lib/config.ts` | 📋 |
| 5 | Geo reference data (8 regions interim → 14) + dev seed | `feat` | `lib/geo.ts`, `convex/seed.ts` | 📋 |
| 6 | Centralized French copy | `chore` | `lib/strings.fr.ts` | 📋 |
| 7 | Root layout, fonts (Montserrat/Inter), Convex provider, charte theme with accessible tokens (DT-11) | `feat` | `app/layout.tsx`, `app/globals.css` | 📋 |

**Definition of Done:**
- [ ] `npx convex dev` and `npm run dev` both run clean.
- [ ] Schema deploys; `geo` seeded; `lint` + `typecheck` pass.
- [ ] Brand colors/fonts match the charte (navy #174a7c, orange #de7d28, green #529e3b); white-on-orange buttons use #a9561a.
- [ ] CI runs lint, typecheck, test and `npm audit` on PRs.

---

#### Sprint 2 — Authentication
**Goal:** all four account types can register and log in with the right rules.
**Deliverable:** signup/login works for donor (phone, no OTP) and structure/hospital (email + one-time code); moderator login on its own subdomain; password reset.

| # | Task | Type | Files Involved | Status |
|---|------|------|----------------|--------|
| 1 | Convex Auth setup; donor register/login (phone + password, no OTP) | `feat` | `convex/auth.ts`, `app/(auth)/*` | 📋 |
| 2 | Structure/hospital register (+ récépissé upload + payout account) → pending | `feat` | `convex/auth.ts`, `app/(auth)/inscription` | 📋 |
| 3 | One-time code step (email via Resend; SMS-ready via `OTP_CHANNEL`) | `feat` | `convex/mfa.ts`, `convex/notify.ts` | 📋 |
| 4 | Role resolution + server guards + route guards | `feat` | `convex/lib/guards.ts`, `lib/authz.ts`, route-group layouts | 📋 |
| 4b | Password reset: email link (orgs) + assisted reset token (donors) | `feat` | `convex/passwordReset.ts`, `app/(auth)/mot-de-passe` | 📋 |
| 5 | Blood opt-in profile fields at signup | `feat` | `convex/auth.ts`, signup form | 📋 |
| 6 | Moderation subdomain (middleware host routing) + moderator login + `admin.createModerator` | `feat` | `middleware.ts`, `app/moderation/*`, `convex/admin.ts` | 📋 |

**Definition of Done:**
- [ ] Donor login requires no OTP; a donor must be logged in to reach the feed.
- [ ] New structures/hospitals land in `pending` and cannot publish.
- [ ] The moderation subdomain rejects non-moderator and non-MFA sessions; the main host 404s `/moderation/*`.
- [ ] Passwords hashed; no secrets in client bundle.

---

#### Sprint 3 — Causes feed + detail (donor read path)
**Goal:** a logged-in donor can browse and open causes.
**Deliverable:** the causes feed with categories, filters, featured slot, and a full cause detail page.

| # | Task | Type | Files Involved | Status |
|---|------|------|----------------|--------|
| 1 | `causes.list` with category + Urgent/Presque atteint/Récent filters | `feat` | `convex/causes.ts` | 📋 |
| 2 | Feed page + `CauseCard` + `ProgressBar` + `VerifiedBadge` | `feat` | `app/(donor)/causes/page.tsx`, `components/cause/*` | 📋 |
| 3 | Weekly featured ("Coup de cœur") display + `moderation.setFeatured` | `feat` | `convex/causes.ts`, `convex/moderation.ts`, feed page | 📋 |
| 4 | `causes.get` + detail page (end condition, similar causes, WhatsApp) | `feat` | `convex/causes.ts`, `app/(donor)/causes/[id]/page.tsx` | 📋 |
| 5 | Empty/loading states | `feat` | feed + detail pages | 📋 |

**Definition of Done:**
- [ ] Only approved causes from verified structures show.
- [ ] Filters and categories narrow the list; empty state renders.
- [ ] Progress and donor count reflect live data.

---

#### Sprint 4 — Donation flow (payments)
**Goal:** a donor can donate end-to-end with transparent fees.
**Deliverable:** donation modal with live fee/net, Orange Money/Wave checkout, success state, and live progress increment.

| # | Task | Type | Files Involved | Status |
|---|------|------|----------------|--------|
| 0 | Spike: NabooPay API (checkout, signature, hold, payout, refund) — confirm against docs | `chore` | notes in `docs/ARCHITECTURE.md` | 📋 |
| 1 | Payment adapter interface + NabooPay + mock modules | `feat` | `lib/providers/*` | 📋 |
| 2 | `donations.createCheckout` (server fee math, min donation, provider redirect) | `feat` | `convex/donations.ts` | 📋 |
| 3 | Webhook `httpAction` + `payments.recordPayment` (signature, idempotent, progress, release at goal) | `feat` | `convex/http.ts`, `convex/payments.ts` | 📋 |
| 4 | `DonationModal` (presets, custom, live fee line, net, provider note, success) | `feat` | `components/cause/DonationModal.tsx`, `hooks/useDonation.ts` | 📋 |
| 5 | Donor dashboard: history + cumulative impact | `feat` | `app/(donor)/profil/page.tsx`, `convex/donations.ts` | 📋 |

**Definition of Done:**
- [ ] Only Orange Money + Wave offered; fee/net recompute live and match the server.
- [ ] Webhook is idempotent on `providerTxnId`; no double-counting.
- [ ] Success increments progress and records the donation in history.
- [ ] Provider note says funds are held until the cause ends.

---

#### Sprint 5 — Organization loop + proofs
**Goal:** a structure can publish a cause and prove reception.
**Deliverable:** create-cause wizard, status timeline, and proof dossier submission with auto-flagging; moderation of structures/causes/proofs.

| # | Task | Type | Files Involved | Status |
|---|------|------|----------------|--------|
| 1 | `causes.create/update/withdraw` + org dashboard + status timeline | `feat` | `convex/causes.ts`, `app/(structure)/structure/*` | 📋 |
| 2 | Create-cause wizard (banner, end condition w/ mandatory deadline, urgency) | `feat` | `app/(structure)/structure/causes/nouvelle` | 📋 |
| 3 | `proofs.submit` (≥5 items + report + spend) + auto-flag checks | `feat` | `convex/proofs.ts`, `convex/proofChecks.ts` | 📋 |
| 4 | Proof submission UI + `ProofGallery` | `feat` | `app/(structure)/structure/preuve/[causeId]`, `components/proof/*` | 📋 |
| 5 | Moderation queues + decide structure (documents + payout account)/cause/proof (reason on refuse) + audit log + notifications | `feat` | `convex/moderation.ts`, `convex/audit.ts`, `convex/notify.ts`, `app/moderation/*` | 📋 |
| 6 | Validated proofs → donor dashboard + public feed | `feat` | `convex/proofs.ts`, `app/(donor)/profil`, landing | 📋 |

**Definition of Done:**
- [ ] Cause lifecycle Soumise→En modération→Approuvée/Refusée→Active→Clôturée works; refusal reason shown.
- [ ] Proof blocked under 5 items / short report; flagged items routed to moderator.
- [ ] Moderator sees the exact donor-facing dossier; validated dossiers appear to donors.

---

#### Sprint 6 — Deletions, refunds & fund rules (P1)
**Goal:** the money-control rules and arbitration are complete.
**Deliverable:** deletion requests, refund requests, moderator arbitration with fund fate, and automatic fund release.

| # | Task | Type | Files Involved | Status |
|---|------|------|----------------|--------|
| 1 | `causes.requestDeletion` + `moderation.decideDeletion` (refund/payout, reason) | `feat` | `convex/causes.ts`, `convex/moderation.ts`, `app/moderation/*` | 📋 |
| 2 | `donations.requestRefund` + `moderation.decideRefund` (while held, final, `REFUND_FEE_POLICY`) | `feat` | `convex/donations.ts`, `convex/moderation.ts` | 📋 |
| 3 | Payout-account change flow (`requestPayoutChange` → `decidePayoutAccount`, payouts blocked meanwhile) | `feat` | `convex/structures.ts`, `convex/moderation.ts` | 📋 |
| 4 | Release: `releaseCause` (goal, scheduled) + deadline cron + proof deadlines + suspension cron | `infra` | `convex/crons.ts`, `convex/payments.ts` | 📋 |
| 5 | Donor dashboard: deleted-cause notice, refund status | `feat` | `app/(donor)/profil` | 📋 |

**Definition of Done:**
- [ ] Deletion arbitration records a reason visible to structure + donors; payout triggers a 7-day proof deadline + auto-suspend.
- [ ] Refund only while held; decision is final; refunded amount follows `REFUND_FEE_POLICY`.
- [ ] Every cause releases in one payout at goal or deadline, whichever comes first; release is idempotent and blocked while a payout change is pending.

---

#### Sprint 7 — Blood-donation module (P1/P2)
**Goal:** hospitals and donors complete the blood-alert loop.
**Deliverable:** alerts targeted by type + commune, donor responses, stock management, and thank-you messages.

| # | Task | Type | Files Involved | Status |
|---|------|------|----------------|--------|
| 1 | `blood.createAlert` (types, units, communes, estimate) — moderator screen + hospital screen behind flag | `feat` | `convex/blood.ts`, `app/moderation/alertes`, `app/(hospital)/hopital/alerte` | 📋 |
| 2 | Donor `/sang`: matching alerts, opt-in profile, respond to slot | `feat` | `app/(donor)/sang/page.tsx`, `components/blood/*` | 📋 |
| 3 | Hospital dashboard + stock edit + confirm attendee (stock +1) | `feat` | `app/(hospital)/hopital/page.tsx`, `convex/blood.ts` | 📋 |
| 4 | Close alert + thank-you message (P2) | `feat` | `app/(hospital)/hopital/alerte`, `convex/blood.ts` | 📋 |
| 5 | In-app + SMS notification wiring (SMS gated on provider) | `feat` | `convex/blood.ts`, SMS action | ⏸ |

**Definition of Done:**
- [ ] Alerts reach only compatible, opted-in donors in targeted communes; addresses never shared.
- [ ] Donor can confirm a slot; hospital confirms attendees and stock updates.
- [ ] SMS path ready behind a flag pending the SMS provider decision.

---

#### Sprint 8 — Polish, security review & deploy
**Goal:** production-ready.
**Deliverable:** hardened, responsive, accessible app deployed to Vercel.

| # | Task | Type | Files Involved | Status |
|---|------|------|----------------|--------|
| 1 | Error/loading/empty states across all screens | `feat` | all pages | 📋 |
| 2 | Responsive pass (375px → desktop) + bottom nav on mobile | `feat` | all pages | 📋 |
| 3 | Accessibility: focus states, labels, contrast | `chore` | components | 📋 |
| 4 | Security review (auth, webhook, authz, PII, secrets) | `chore` | `convex/*`, `lib/*` | 📋 |
| 5 | French copy review with marketing | `chore` | `lib/strings.fr.ts` | 📋 |
| 6 | Playwright e2e on the donate flow (mock provider) | `chore` | `tests/e2e` | 📋 |
| 7 | Vercel production deploy (app + moderation subdomain) + env config + NabooPay sandbox→live | `infra` | Vercel project, env | 📋 |

**Definition of Done:**
- [ ] Security review checklist (SECURITY.md) passes.
- [ ] No horizontal scroll at 375px; all interactive elements have focus states.
- [ ] Production deploy live; env vars set; NabooPay live keys configured; `PAYMENT_PROVIDER` is not `mock`.

---

## Full Feature Checklist

- [ ] Donor account (phone + password, no OTP) — Sprint 2
- [ ] Structure/hospital signup + récépissé upload + pending validation — Sprint 2
- [ ] One-time code for org/hospital/moderator — Sprint 2 (email; SMS ⏸ pending board)
- [ ] Password reset (email / assisted) — Sprint 2
- [ ] Moderator separate-platform login — Sprint 2
- [ ] Causes feed with categories + filters — Sprint 3
- [ ] Weekly "Coup de cœur" featured — Sprint 3
- [ ] Cause detail (end condition, similar, WhatsApp) — Sprint 3
- [ ] Donation modal with live fee + net (Orange Money/Wave) — Sprint 4
- [ ] Donor dashboard (history + cumulative impact) — Sprint 4
- [ ] Create/edit/withdraw cause + status timeline — Sprint 5
- [ ] Proof dossier (≥5 items + report + spend) + auto-flag — Sprint 5
- [ ] Moderation queues: structures, causes, proofs — Sprint 5
- [ ] Validated proofs in donor dashboard + public feed — Sprint 5
- [ ] Deletion requests + moderator arbitration (fund fate) — Sprint 6
- [ ] Refund requests + arbitration — Sprint 6
- [ ] Payout-account verification + change review — Sprints 5–6
- [ ] Automatic fund release (goal or deadline) — Sprint 6
- [ ] Proof-deadline auto-suspension — Sprint 6
- [ ] Blood opt-in profile (type + commune) — Sprint 7
- [ ] Blood alert creation + targeting — Sprint 7
- [ ] Donor alert response (visit slot) — Sprint 7
- [ ] Hospital stock + confirm attendee — Sprint 7
- [ ] Hospital thank-you message — Sprint 7
- [ ] WhatsApp contact fallback — Sprint 3 (cause detail + footer)
