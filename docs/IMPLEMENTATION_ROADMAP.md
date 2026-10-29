# SUNUSOCIAL — Implementation Roadmap

| | |
|---|---|
| **Version** | 1.0 |
| **Last Updated** | 28 October 2026 |
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
| 1 | Scaffold Next.js (App Router, TS strict) + Convex + lint/format | `infra` | `app/`, `convex/`, `tsconfig.json`, `package.json` | 📋 |
| 2 | Define all tables + indexes | `feat` | `convex/schema.ts` | 📋 |
| 3 | Shared types | `feat` | `lib/types.ts` | 📋 |
| 4 | Fee math + FCFA formatting | `feat` | `lib/money.ts` | 📋 |
| 5 | Geo reference data (8→14 regions) + seed | `feat` | `lib/geo.ts`, `convex/geo.ts` | 📋 |
| 6 | Centralized French copy | `chore` | `lib/strings.fr.ts` | 📋 |
| 7 | Root layout, fonts (Montserrat/Inter), Convex provider, charte theme | `feat` | `app/layout.tsx` | 📋 |

**Definition of Done:**
- [ ] `npx convex dev` and `npm run dev` both run clean.
- [ ] Schema deploys; `geo` seeded; `lint` + `typecheck` pass.
- [ ] Brand colors/fonts match the charte (navy #174a7c, orange #de7d28, green #529e3b).

---

#### Sprint 2 — Authentication
**Goal:** all four account types can register and log in with the right rules.
**Deliverable:** signup/login works for donor (phone, no OTP) and structure/hospital (email + 2FA); moderator login on its own URL.

| # | Task | Type | Files Involved | Status |
|---|------|------|----------------|--------|
| 1 | Donor register/login (phone + password, no OTP) | `feat` | `convex/auth.ts`, `app/(auth)/*` | 📋 |
| 2 | Structure/hospital register (+ récépissé upload) → pending | `feat` | `convex/auth.ts`, `app/(auth)/inscription` | 📋 |
| 3 | Email login + SMS 2FA (stub behind flag until SMS live) | `feat` | `convex/auth.ts` | 📋 |
| 4 | Sessions + role resolution + route guards | `feat` | `lib/authz.ts`, route-group layouts | 📋 |
| 5 | Blood opt-in profile fields at signup | `feat` | `convex/auth.ts`, signup form | 📋 |
| 6 | Moderator login on separate `/moderation` URL | `feat` | `app/moderation/page.tsx`, `layout.tsx` | 📋 |

**Definition of Done:**
- [ ] Donor login requires no OTP; a donor must be logged in to reach the feed.
- [ ] New structures/hospitals land in `pending` and cannot publish.
- [ ] Moderation URL rejects non-moderator sessions.
- [ ] Passwords hashed; no secrets in client bundle.

---

#### Sprint 3 — Causes feed + detail (donor read path)
**Goal:** a logged-in donor can browse and open causes.
**Deliverable:** the causes feed with categories, filters, featured slot, and a full cause detail page.

| # | Task | Type | Files Involved | Status |
|---|------|------|----------------|--------|
| 1 | `causes.list` with category + Urgent/Presque atteint/Récent filters | `feat` | `convex/causes.ts` | 📋 |
| 2 | Feed page + `CauseCard` + `ProgressBar` + `VerifiedBadge` | `feat` | `app/(donor)/causes/page.tsx`, `components/cause/*` | 📋 |
| 3 | Weekly featured ("Coup de cœur") | `feat` | `convex/causes.ts`, feed page | 📋 |
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
| 1 | Payment adapter interface + NabooPay + SycaPay modules | `feat` | `lib/providers/*` | 📋 |
| 2 | `donations.createCheckout` (server fee math, provider redirect) | `feat` | `convex/donations.ts` | 📋 |
| 3 | `payments.webhook` (signature verify, idempotent, bump progress) | `feat` | `convex/payments.ts` | 📋 |
| 4 | `DonationModal` (presets, custom, live fee line, net, provider note, success) | `feat` | `components/cause/DonationModal.tsx`, `hooks/useDonation.ts` | 📋 |
| 5 | Donor dashboard: history + cumulative impact | `feat` | `app/(donor)/profil/page.tsx`, `convex/donations.ts` | 📋 |

**Definition of Done:**
- [ ] Only Orange Money + Wave offered; fee/net recompute live and match the server.
- [ ] Webhook is idempotent on `providerTxnId`; no double-counting.
- [ ] Success increments progress and records the donation in history.
- [ ] Provider note correctly says held (NabooPay) vs direct (SycaPay).

---

#### Sprint 5 — Organization loop + proofs
**Goal:** a structure can publish a cause and prove reception.
**Deliverable:** create-cause wizard, status timeline, and proof dossier submission with auto-flagging; moderation of structures/causes/proofs.

| # | Task | Type | Files Involved | Status |
|---|------|------|----------------|--------|
| 1 | `causes.create/update/withdraw` + org dashboard + status timeline | `feat` | `convex/causes.ts`, `app/(structure)/structure/*` | 📋 |
| 2 | Create-cause wizard (banner, end condition w/ mandatory deadline, urgency) | `feat` | `app/(structure)/structure/causes/nouvelle` | 📋 |
| 3 | `proofs.submit` (≥5 items + report + spend) + auto-flag | `feat` | `convex/proofs.ts` | 📋 |
| 4 | Proof submission UI + `ProofGallery` | `feat` | `app/(structure)/structure/preuve/[causeId]`, `components/proof/*` | 📋 |
| 5 | Moderation queues + decide structure/cause/proof (reason on refuse) | `feat` | `convex/moderation.ts`, `app/moderation/*` | 📋 |
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
| 2 | `donations.requestRefund` + `moderation.decideRefund` (NabooPay only, final) | `feat` | `convex/donations.ts`, `convex/moderation.ts` | 📋 |
| 3 | Hide refund surface entirely under SycaPay | `feat` | moderation UI, provider gating | 📋 |
| 4 | Auto-release cron (goal OR deadline) + proof-deadline suspension cron | `infra` | `convex/crons.ts`, `convex/payments.ts` | 📋 |
| 5 | Donor dashboard: deleted-cause notice, refund status | `feat` | `app/(donor)/profil` | 📋 |

**Definition of Done:**
- [ ] Deletion arbitration records a reason visible to structure + donors; payout triggers a 7-day proof deadline + auto-suspend.
- [ ] Refund only while held; impossible under SycaPay; decision is final.
- [ ] Time-limited causes release everything at deadline automatically; monetary causes release at goal or deadline.

---

#### Sprint 7 — Blood-donation module (P1/P2)
**Goal:** hospitals and donors complete the blood-alert loop.
**Deliverable:** alerts targeted by type + commune, donor responses, stock management, and thank-you messages.

| # | Task | Type | Files Involved | Status |
|---|------|------|----------------|--------|
| 1 | `blood.createAlert` (types, units, communes, estimate) | `feat` | `convex/blood.ts`, `app/(hospital)/hopital/alerte` | 📋 |
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
| 6 | Vercel production deploy + env config + provider sandbox→live | `infra` | Vercel project, env | 📋 |

**Definition of Done:**
- [ ] Security review checklist (SECURITY.md) passes.
- [ ] No horizontal scroll at 375px; all interactive elements have focus states.
- [ ] Production deploy live; env vars set; payment provider finalized and keyed.

---

## Full Feature Checklist

- [ ] Donor account (phone + password, no OTP) — Sprint 2
- [ ] Structure/hospital signup + récépissé upload + pending validation — Sprint 2
- [ ] SMS 2FA for org/hospital/moderator — Sprint 2 (⏸ pending SMS provider)
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
- [ ] Refund requests + arbitration (NabooPay only) — Sprint 6
- [ ] Automatic fund release (goal or deadline) — Sprint 6
- [ ] Proof-deadline auto-suspension — Sprint 6
- [ ] Blood opt-in profile (type + commune) — Sprint 7
- [ ] Blood alert creation + targeting — Sprint 7
- [ ] Donor alert response (visit slot) — Sprint 7
- [ ] Hospital stock + confirm attendee — Sprint 7
- [ ] Hospital thank-you message — Sprint 7
- [ ] WhatsApp contact fallback — Sprint 3 (cause detail + footer)
