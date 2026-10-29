# SUNUSOCIAL — Project Context

> Single source of truth for generating the SUNUSOCIAL documentation bundle.
> Everything here is decided unless marked **[OPEN]** (pending SUNUSOCIAL board decision)
> or **[HYPOTHESIS]** (a working assumption to validate).
> Last updated: 28 October 2026.

---

## 1. What SUNUSOCIAL is

SUNUSOCIAL is a French-language web platform (mobile-responsive) that connects donors
with verified social organizations in Senegal. It is an intermediation platform: donors
browse real, verified needs ("bons de besoins") published by social structures and donate
money directly through mobile money, with transparency and proof of reception built in.

The platform's reason to exist is **trust and visibility**, not the lack of charitable actors.
The sector in Senegal has many small, isolated organizations and many willing donors, but no
trusted channel between them. SUNUSOCIAL is that channel.

**Mission constraint:** the founder (Ngoné Gueye) does not want to profit from the platform.
Revenue exists only to cover maintenance and running costs, not to generate income.

**Important framing rule:** do not describe this product as "built for Africa" or use that
framing anywhere in the docs. It is a product built for a specific market (Senegal) with
specific users; describe it concretely, not as a continental mission.

---

## 2. The parties

- **Client:** Ngoné Gueye, founder of SUNUSOCIAL. Cheikh Saliou Ndiaye acts as her agent in
  some communications.
- **Prestataire:** JefTech. Web development is provided free (Phase 1). Lead developer /
  CTO is the project owner; Bachir is second developer; Ndeye Mareme is marketing lead;
  Papa Makhemout Tall is JefTech's representative/CEO on the contract side.
- **Contract:** signed September 2026. Phase 1 = web app only, free. Native mobile apps
  (Android/iOS) are explicitly out of scope and deferred to a Phase 2 with a separate quote.
- **Infrastructure cost** (paid by client, directly to providers): Vercel Pro + Convex Pro,
  roughly 45,000 FCFA/month.

---

## 3. User types

There are **three** distinct user types, each with a separate experience:

1. **Donor (Donateur)** — browses causes, donates, tracks donations and proofs.
2. **Organization (Structure)** — publishes causes, receives funds, uploads proof of reception.
3. **Moderator (Modérateur)** — a **completely separate platform with its own URL and login**.
   Reviews and approves/refuses structures, causes, and proofs.

---

## 4. Authentication

- **Donor:** phone number + password. Signup adds a name. **No OTP** (dropped to avoid SMS
  cost and infrastructure dependency).
- **Organization:** phone number + name + password. Signup also collects organization name,
  type, location, and a récépissé ministériel document upload.
- **Moderator:** separate platform, email + password, no role selector.

Note: donors must be logged in to see and donate to causes — the account exists so each
donation can be tied to a known phone number.

---

## 5. Core donor flow

1. Land on homepage (post-login) showing causes.
2. Causes are organized by category: **Santé, Alimentation, Matériel**. Secondary filters:
   **Urgent, Presque atteint, Récent**.
3. Each cause card shows: name, category, progress (e.g. "4 500 / 10 000 FCFA"), "Voir plus".
4. A **"Coup de cœur de la semaine"** editorial slot is manually curated by SUNUSOCIAL.
5. Cause detail page: banner image, full description, end condition, progress, and a list of
   similar causes in the same category.
6. Donation modal (styled like the itch.io purchase modal): preset amounts (500, 1 000,
   5 000 FCFA), a free custom-amount field, a **live fee line**, and the **net amount the
   structure will receive**. Mobile money only — **no credit card** (removed for both providers).
7. On success: thank-you state, progress bar increments, options to donate again or browse.
8. Donor dashboard/profile: donation history, proofs of reception, cumulative impact
   ("Vous avez contribué à 3 causes pour un total de 12 500 FCFA").

---

## 6. Core organization flow

1. Signup (with document upload) → pending moderator validation.
2. Dashboard: manage causes (create, edit, delete), see donations received and totals, see
   each cause's status (Approuvée / En attente / Refusée avec raison).
3. Create a cause: banner image, name, description, category, **end condition**
   (date/temporal OR monetary goal), target amount, urgency level.
4. Status timeline per cause: Soumise → En modération → Approuvée/Refusée → Active → Clôturée.
5. When a goal is met or funds received, upload **proof of reception** (photo or video).
   Suspicious proofs are **auto-flagged** and routed to the moderator.

---

## 7. Core moderator flow

- Separate platform, separate URL, separate login.
- Queues: **Structures à valider** (pending signups, with rendered récépissé + declared info +
  Valider/Refuser with reason), **Causes à modérer**, **Preuves à valider** (including
  auto-flagged proofs).
- Approve/refuse actions; refusal always requires a reason visible to the structure.

---

## 8. Payment provider — the central open decision **[OPEN]**

The board is choosing between two providers. The prototype simulates both via a toggle.

| | NabooPay | SycaPay |
|---|---|---|
| Transaction fee | 3% | 1.5% (mobile money only) |
| Credit card | Removed for MVP | Not supported anyway |
| Fund control | **Escrow / blocage**: holds funds until the cause condition is met | **No escrow**: funds go directly to the structure at each donation |
| Familiarity to JefTech | Known, architecture built around it | New tech, needs documentation study + possible delay |

**JefTech's technical position:** NabooPay is recommended because SycaPay has **no escrow/hold
feature**, which is central to SUNUSOCIAL's trust model (holding funds until a cause's goal or
deadline is met). Without escrow, the whole fund-control architecture changes. JefTech dropped
the "extra cost" argument; the position rests only on the escrow feature and the architectural
risk, not on billing.

**SycaPay credentials (from client):** BCEAO-approved payment institution, PCI-DSS certified,
~338M FCFA capital, processes 10–15 billion FCFA/month, references include Ecobank, VISA,
Orange Money, Allianz.

**Fund release rule (agreed for prototype):**
- Time-limited cause: at the deadline, **everything collected is released to the structure
  automatically**, even if only 1% of the goal was reached.
- Release is **automatic**, not manual (no moderator action to release funds).
- **[HYPOTHESIS]** A monetary-goal cause that never reaches its goal would otherwise hold funds
  forever under escrow. Proposed fix: every cause also carries a deadline; monetary causes
  release at the goal OR the deadline, whichever comes first. Needs board validation.

---

## 9. Money flow (agreed)

- Funds go **directly to the structure** (there is no SUNUSOCIAL-held central account), with
  escrow applied at the provider level if NabooPay is chosen.
- **Only monetary donations** for the MVP. There is **no logistics for in-kind donations**
  (food, materials delivered physically) yet.
- SUNUSOCIAL takes a **percentage** to cover maintenance (not profit). **[OPEN]** Whether to
  take a percentage on donations vs. a **subscription charged to organizations only** — the
  founder leans non-profit; the subscription-vs-percentage question is still to be decided.

---

## 10. Blood donation module

A secondary module. Hospitals act like structures but, instead of financial causes, they emit
**blood shortage alerts**.

- **Registration (donor): opt-in only.** A toggle "Je souhaite être alerté pour les dons de
  sang" (off by default). If on, the donor provides **residency** (Pikine, Mbour, Plateau,
  Autre) and **blood type** (A+, A−, B+, B−, AB+, AB−, O+, O−, or "Je ne connais pas mon groupe").
  Blood type is health data — hence opt-in, editable later, with a short explanation.
- **Alert creation:** for the prototype, the **moderator** creates alerts (final decision on
  whether hospitals self-serve belongs to SUNUSOCIAL). The form takes hospital name, hospital
  city, blood type needed, urgency level. Shows "X donneurs compatibles seront notifiés" before
  sending; active-alerts list with a "Clôturer l'alerte" action.
- **Donor receives:** informational only, no in-app action. In-app notification + SMS.
- **[OPEN]** Notification channel: SUNUSOCIAL must validate SMS (cost + a dedicated service
  number). For now show both in-app and an SMS preview labeled "en attente de validation".

---

## 11. WhatsApp

For anything the platform can't handle (e.g. physical/in-kind donations, questions), redirect
users to **SUNUSOCIAL's WhatsApp**. A "Nous contacter sur WhatsApp" button appears on the cause
detail page and in the footer.

---

## 12. Tech stack

- **Frontend/Hosting:** Next.js on Vercel (Pro).
- **Backend/Database:** Convex (Pro), chosen partly for real-time updates (live progress bars,
  blood alert notifications).
- **Payments:** NabooPay or SycaPay (see §8).
- Mobile-first, fully responsive. French throughout.

---

## 13. Branding

A charte graphique and logo have been delivered by the client. The design must be a **full
rebrand built from the charte**, not a recolor of an earlier prototype. Design system base:
"Industry" (structured, clean, serious-but-warm), with the charte's own colors/type layered on.

---

## 14. Open items to resolve (summary)

1. **[OPEN]** Final payment provider: NabooPay vs SycaPay (board decision, pending SycaPay doc review).
2. **[OPEN]** Revenue model: percentage on donations vs. organization subscription.
3. **[OPEN]** Blood alert notification channel: SMS validation (cost + dedicated number).
4. **[OPEN]** Who creates blood alerts long-term: hospitals vs. moderator.
5. **[OPEN]** Organization document verification: document-only vs. physical visit.
6. **[HYPOTHESIS]** Deadline-based release for monetary causes to avoid funds held forever.

---

## 15. What to generate

A full project documentation bundle. Where a decision is **[OPEN]**, document both options and
mark the decision as pending rather than inventing an answer. Where **[HYPOTHESIS]**, state the
assumption explicitly. Keep all user-facing copy in French; the docs themselves can be in English.
