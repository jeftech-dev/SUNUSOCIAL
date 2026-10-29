# SUNUSOCIAL — Product Requirements Document

| | |
|---|---|
| **Version** | 1.0 |
| **Status** | Draft for build — several decisions pending board input |
| **Last Updated** | 28 October 2026 |
| **Author** | JefTech (lead developer / CTO), from `context.md` and the clickable prototype |

---

## 1. Problem Statement

In Senegal, there are many small social organizations — orphanages, nurseries ("pouponnières"), shelters ("foyers"), centers for people with disabilities, women's prisons, and hospital transfusion services — with real, concrete needs. There are also many people willing to give. What is missing is a **trusted channel between them**.

- **Donors** don't know which organizations are real, what they actually need, or whether their money is used as promised. Giving today means trusting a phone number shared on social media, with no proof the gift arrived.
- **Organizations** are isolated and invisible. A genuine orphanage competes for attention with scams, and has no simple, credible way to reach donors or to prove that past gifts were well used.
- **Existing solutions fail** because they solve neither side of trust: generic mobile-money transfers leave no proof and no verification, and global crowdfunding platforms are not built for the Senegalese market, mobile-money rails, or the French-speaking, document-verified context this sector needs.

SUNUSOCIAL's reason to exist is **trust and visibility**, not the absence of charitable actors.

## 2. Product Vision

Twelve months from launch, SUNUSOCIAL is the place a Senegalese donor opens when they want to give and be sure: a feed of verified structures with precise, costed needs, funded by Orange Money or Wave, where every completed cause shows a published proof dossier. Structures that behave well build a visible track record; those that don't are suspended. Hospitals reach compatible blood donors in minutes instead of days. The platform covers its own running costs and takes no profit.

## 3. Target Users

### Donor (Donateur)
- **Who:** an individual in Senegal with a mobile-money account (Orange Money or Wave) who wants to help.
- **Goal:** give to a cause they trust and see the result.
- **Pain point:** no way to know a need is real or that a past gift was actually used.

### Organization (Structure)
- **Who:** a verified social organization — orphanage, nursery, shelter, disability center, women's prison program, etc. — with a ministerial récépissé.
- **Goal:** publish real needs, receive traceable donations, and prove good use to keep donors' trust.
- **Pain point:** invisibility and the difficulty of standing apart from scams.

### Hospital (Hôpital) — blood module
- **Who:** a hospital transfusion service, verified with its Ministry of Health agrément; a specialized kind of structure.
- **Goal:** reach compatible, nearby blood donors fast when a blood type runs short.
- **Pain point:** no quick, targeted way to call in donors of a specific blood type.

### Moderator (Modérateur)
- **Who:** SUNUSOCIAL staff operating a **separate platform with its own URL and login**.
- **Goal:** keep the platform trustworthy — validate structures, moderate causes, validate proofs, arbitrate deletions and refunds, and (for the prototype) create blood alerts.
- **Pain point:** needs to see exactly what donors will see, and to act with reasons that are always visible to the affected party.

## 4. User Stories

### P0 — must ship for v1

- As a **donor**, I want to create an account with my phone number and a password so that each donation is tied to a known identity.
- As a **donor**, I want to browse verified causes by category and filter them so that I can find a need to support.
- As a **donor**, I want to see a cause's progress, end condition, and description so that I can decide to give.
- As a **donor**, I want to donate a preset or custom amount by Orange Money or Wave, seeing the fee and the net the structure receives before I confirm, so that I give with full transparency.
- As a **donor**, I want to see my donation history and the proof dossier for each funded cause so that I know my gift was used.
- As an **organization**, I want to sign up with my details and upload my récépissé so that I can be verified.
- As an **organization**, I want to create a cause with a banner, description, category, end condition, target, and urgency so that donors can fund it.
- As an **organization**, I want to track each cause through its status timeline so that I know where it stands.
- As an **organization**, I want to submit a proof dossier (≥ 5 items + report + fund breakdown) after receiving funds so that donors and moderators can verify use.
- As a **moderator**, I want queues of structures, causes, and proofs to review, approving or refusing each with a reason, so that only trustworthy content is published.

### P1 — should ship for v1

- As a **donor**, I want a weekly editor's pick ("Coup de cœur de la semaine") so that I see a curated cause.
- As a **donor**, I want to request a refund while funds are still held (NabooPay only) so that I can correct a mistake.
- As an **organization**, I want to request deletion of a published cause (moderator-approved) so that I can withdraw a need that no longer applies.
- As a **moderator**, I want to arbitrate deletion requests and decide the fate of collected funds (refund vs. pay out) with a reason so that donors are treated fairly.
- As a **moderator**, I want to arbitrate refund requests so that donor mistakes are handled fairly.
- As a **donor**, I want to opt in to blood alerts with my blood type and commune so that I'm notified only when my type is needed nearby.
- As a **hospital**, I want to publish a blood-shortage alert targeted by blood type and commune so that compatible donors are called in.
- As a **hospital**, I want to update my blood stock and confirm each donor who came so that my reserves stay accurate.
- As a **donor**, I want to confirm a visit slot in response to a blood alert so that the hospital knows I'm coming.

### P2 — later

- As a **hospital**, I want to write and send a thank-you message to confirmed donors when an alert closes.
- As a **moderator**, I want to track proof-of-use deadlines and auto-suspend structures that miss them.
- As a **donor**, I want to search causes and structures by free text.

## 5. Feature Specifications

### 5.1 Accounts & Authentication — P0
**Description.** Donors register with full name, phone (+221) and password — **no OTP** (dropped to avoid SMS cost). Structures/hospitals register with organization name, type, region, commune, responsible's phone, professional email, password, and a récépissé/agrément upload; they log in with email + password + **SMS 2FA**. Moderators use a separate platform, email + password, no role selector.
**Acceptance criteria**
- [ ] Donor signup requires name, phone, password; login is phone + password with no OTP step.
- [ ] A donor must be logged in to view and donate to causes.
- [ ] Structure/hospital signup collects org name, type, region→commune, responsible phone, email, password (≥ 12 chars), and a document upload (PDF/JPG/PNG, ≤ 5 MB).
- [ ] New structures/hospitals start in **pending validation** and cannot publish until approved.
- [ ] Structure/hospital/moderator login enforces SMS 2FA. <!-- assumed: 2FA depends on the pending SMS provider; stub acceptably until SMS is live -->
- [ ] Moderation platform is on its own URL and is unreachable with a donor/structure session.

### 5.2 Causes Feed & Discovery — P0
**Description.** Post-login homepage shows verified causes grouped by category (Santé, Alimentation, Matériel) with secondary filters (Urgent, Presque atteint, Récent) and a manually curated weekly "Coup de cœur". Each card shows org (with a Vérifié badge), category, title, progress (raised / goal), percentage, and a "Voir plus" action.
**Acceptance criteria**
- [ ] Only approved causes from verified structures appear.
- [ ] Category tabs and secondary filters narrow the list; an empty state shows when nothing matches.
- [ ] The featured slot is editor-controlled, not automatic.
- [ ] Progress reflects real donations in realtime.

### 5.3 Cause Detail — P0
**Description.** Banner image, org + Vérifié badge, title, category and urgency tags, full description, collected/goal with progress and donor count, end condition, a "Faire un don" button, a WhatsApp contact button, and a carousel of similar causes in the same category.
**Acceptance criteria**
- [ ] Shows end condition clearly (date, or goal-or-deadline).
- [ ] Shows the fund-control rule note (held vs. direct, per active provider).
- [ ] Similar causes come from the same category.

### 5.4 Donation Flow — P0
**Description.** Donation modal (itch.io-style): preset amounts (500 / 1 000 / 5 000 FCFA) plus a free custom amount; payment method Orange Money or Wave (no card); a **live fee line** showing the provider rate and the **net amount the structure receives**; a provider note; confirm. On success: thank-you state, incremented progress bar, options to donate again or browse. Donations are tied to the donor's account.
**Acceptance criteria**
- [ ] Fee and net recompute live as the amount or provider changes.
- [ ] Only Orange Money and Wave are offered; no card option exists.
- [ ] Success state increments the cause progress and records the donation in the donor's history.
- [ ] The provider note states whether funds are held (NabooPay) or paid directly (SycaPay).

### 5.5 Organization Dashboard & Cause Management — P0
**Description.** Stats (total received this month, active/pending causes, donations received); a list of causes each with a status timeline (Soumise → En modération → Approuvée/Refusée → Active → Clôturée); create/edit/withdraw; refusal reason displayed when refused.
**Acceptance criteria**
- [ ] Create-cause wizard captures banner, title, description, category, end condition (date **or** goal — and every cause also carries a deadline), target amount, urgency.
- [ ] A cause in moderation (no donations yet) can be withdrawn by the structure itself.
- [ ] A published cause cannot be deleted without moderator approval; the structure sends a motivated request.
- [ ] Refusal reasons are visible to the structure.

### 5.6 Proof of Reception — P0
**Description.** After funds are received, the structure uploads a dossier: **≥ 5 files** (photos, video, invoice, delivery note), a written report ("compte rendu"), and a fund-use breakdown. Suspicious items are **auto-flagged**. Moderators review the dossier exactly as donors will see it; once validated, each donor can open it from their dashboard.
**Acceptance criteria**
- [ ] Submission is blocked until ≥ 5 items and a report of ≥ 10 characters are present.
- [ ] Auto-flagged items are marked and routed to the moderator.
- [ ] Validated dossiers appear in donor dashboards and the public proofs feed.
- [ ] If a deleted cause's funds went to the structure, a proof dossier is due within **7 days**; missing it auto-suspends the account until a moderator lifts it.

### 5.7 Moderation Platform — P0
**Description.** Separate app with queues: **Structures à valider** (rendered récépissé + declared info; Valider/Refuser with reason), **Causes à modérer**, **Preuves à valider** (including auto-flagged), **Demandes de suppression**, **Demandes de remboursement** (NabooPay only). Refusals always require a reason visible to the affected party.
**Acceptance criteria**
- [ ] Each queue shows counts and lets the moderator approve/refuse with a mandatory reason on refusal.
- [ ] Deletion arbitration lets the moderator choose refund donors vs. pay out to structure (refund disabled under SycaPay since funds are already paid), with a reason, and tracks the resulting proof deadline.
- [ ] Refund arbitration is final and is hidden entirely when the active provider is SycaPay.

### 5.8 Blood-Donation Module — P1
**Description.** Hospitals (a verified structure subtype) publish shortage alerts by blood type, targeted to communes in their region; compatible opted-in donors are notified (in-app + SMS). Donors confirm a visit slot (informational — the on-site doctor confirms eligibility). Hospitals maintain stock and confirm each donor who came (auto-incrementing stock), then thank confirmed donors.
**Acceptance criteria**
- [ ] Donor blood profile is **opt-in**, off by default, editable later, with a short explanation; captures blood type (or "Je ne sais pas") and region→commune from fixed lists (no free text).
- [ ] Alerts target only the chosen blood types and the chosen communes within the hospital's region; donor addresses are never shared.
- [ ] For the prototype, **the moderator creates alerts** <!-- assumed: prototype has hospitals self-serve alerts; long-term owner (hospital vs moderator) is [OPEN] in context.md §14 -->; the alert preview shows "X donneurs compatibles seront notifiés".
- [ ] Donors receive alerts only when their blood type is requested; a donor can confirm a slot.
- [ ] Hospitals can update stock, confirm attendees (stock +1 per confirmed donation), close an alert, and send a thank-you message.

### 5.9 WhatsApp Fallback — P1
**Description.** A "Nous contacter sur WhatsApp" button on the cause detail page and in the footer routes to SUNUSOCIAL's WhatsApp for anything the platform can't handle (in-kind donations, questions).
**Acceptance criteria**
- [ ] Button opens a prefilled WhatsApp chat to the configured number.

## 6. Out of Scope (v1)

- Native mobile apps (Android/iOS) — deferred to Phase 2 with a separate quote.
- Credit-card payments — removed for both providers; mobile money only.
- In-kind / logistics donations (physical food, materials) — redirected to WhatsApp.
- A SUNUSOCIAL-held central account — funds go directly to structures (held at provider level if NabooPay).
- Real-time geolocation for blood alerts — targeting is by commune only.
- Public third-party API — the API is internal to the platform's own clients. <!-- assumed: context.md names no external API consumers -->

## 7. Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Verified structures live | 25 in first 3 months | Count of approved structures |
| Causes funded (goal or deadline reached) | 60% of published causes | Causes reaching release ÷ causes published |
| Proof dossiers published | 100% of funded causes within 7 days | Validated proofs ÷ funded causes |
| Donor repeat rate | 30% give more than once | Donors with ≥ 2 donations ÷ donors |
| Donation completion | 85% of started donations confirmed | Confirmed ÷ started donation modals |
| Blood alert fulfillment | 70% of alerts reach their unit goal | Alerts met ÷ alerts sent |
| Time to first donation | < 3 min from signup | Median signup → first confirmed donation |

<!-- assumed: no target numbers were given in context.md; these are first-pass goals for the board to confirm. -->

## 8. Timeline & Milestones

<!-- assumed: no dated milestones were provided; these follow the sprint plan in IMPLEMENTATION_ROADMAP.md at 1 week/sprint from an assumed build start. -->

| Milestone | Target Date | Deliverable |
|-----------|-------------|-------------|
| Foundations (schema, types, auth) | Sprint 1–2 | Accounts work; DB schema live |
| Core donor loop | Sprint 3–4 | Browse → donate → see progress & proof |
| Organization loop | Sprint 5 | Create cause → moderated → proof dossier |
| Moderation platform | Sprint 6 | All moderation queues operational |
| Blood module | Sprint 7 | Alerts, responses, stock, thanks |
| Polish, security review, deploy | Sprint 8 | Production launch on Vercel |

## 9. Open Questions

- [ ] **Payment provider**: NabooPay (3%, escrow/hold) vs. SycaPay (1.5%, direct payout) — board decision pending SycaPay documentation review. [OPEN]
- [ ] **Revenue model**: percentage on donations vs. subscription charged to organizations only — founder leans non-profit. [OPEN]
- [ ] **Blood alert SMS channel**: validate cost and a dedicated service number. [OPEN]
- [ ] **Who creates blood alerts long-term**: hospitals self-serve vs. moderator-only. [OPEN]
- [ ] **Organization verification depth**: document-only vs. physical visit. [OPEN]
- [ ] **Deadline-based release for monetary causes** so funds are never held forever — needs board validation. [HYPOTHESIS]
- [ ] **Fund control model**: hold funds (JefTech, legal transparency) vs. direct payout with after-the-fact receipt control (SUNUSOCIAL preference). [OPEN]
- [ ] **Payout cadence**: single lump payment vs. fractioned payments — SUNUSOCIAL to analyze. [OPEN]
- [ ] **Full commune list**: prototype covers 8 regions; final must cover all 14 regions and their communes (official list to be supplied). [OPEN]
