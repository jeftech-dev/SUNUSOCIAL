# SUNUSOCIAL — User Blueprint

| | |
|---|---|
| **Version** | 1.0 |
| **Last Updated** | 28 October 2026 |
| **Purpose** | The end-to-end journeys for every user type — screens, steps, and what happens next — so design and build stay anchored to real flows. French UI; screen numbers match the prototype's `data-screen-label`. |

## User Types

| User Type | Description | Entry Point |
|-----------|-------------|-------------|
| Donor (Donateur) | Individual giving via Orange Money / Wave | Landing → "Je suis Donateur" → signup/login (phone) |
| Organization (Structure) | Verified social org publishing needs | Landing → "Je suis une Structure" → signup (email + récépissé) |
| Hospital (Hôpital) | Transfusion service issuing blood alerts | Structure signup, type = "Hôpital (don de sang)" → hospital space |
| Moderator (Modérateur) | SUNUSOCIAL trust & safety staff | Separate URL → "Espace modération" login |

---

## Journey — Donor

### Phase 1 — Discovery & Onboarding
_Goal: first meaningful action = create an account and reach the causes feed._

| Step | Screen/Page | What user does | What happens next | Notes |
|------|-------------|----------------|-------------------|-------|
| 1 | 01 Accueil public (`/`) | Reads value prop, "Comment ça marche", proof feed | Clicks "Je suis Donateur" | Proof feed visible without login |
| 2 | 02 Authentification (`/inscription`) | Enters name, phone (+221), password; optionally opts into blood alerts (type + commune) | Account created, logged in | **No OTP**; blood opt-in off by default |
| 3 | 03 Accueil donateur (`/causes`) | Sees greeting + verified causes | Browses | Must be logged in to view causes |

### Phase 2 — Core Usage
_Goal: main value action = make a transparent donation and see progress move._

| Step | Screen/Page | What user does | What happens next | Notes |
|------|-------------|----------------|-------------------|-------|
| 1 | 03 Accueil donateur | Filters by category / Urgent / Presque atteint / Récent; may open the "Coup de cœur" | Picks a cause | Featured slot is editor-curated |
| 2 | 04 Détail de la cause (`/causes/[id]`) | Reads description, progress, end condition | Clicks "Faire un don" | Shows fund-control note + WhatsApp |
| 3 | 05 Modal de don | Picks preset (500/1 000/5 000) or custom; chooses Orange Money or Wave; sees live fee + net | Confirms → provider checkout | No card; net shown before paying |
| 4 | 05 Modal de don (success) | Sees thank-you + incremented progress | Donate again or browse | Progress animates for all viewers |

### Phase 3 — Retention & Return
_Goal: user comes back on their own = sees proof their gift was used._

| Step | Screen/Page | What user does | What happens next | Notes |
|------|-------------|----------------|-------------------|-------|
| 1 | Notification (in-app/SMS) | Learns a supported cause published a proof | Opens dashboard | SMS pending provider |
| 2 | 06 Profil donateur (`/profil`) | Sees history, cumulative impact, proof availability | Opens a dossier | "Vous avez contribué à N causes pour X FCFA" |
| 3 | 06b Dossier de preuve | Views gallery, report, fund-use breakdown | Trust reinforced; may donate again | Same dossier the moderator validated |
| 4 | 06 Profil (if held funds) | May request a refund with a reason | Moderator decides (final) | NabooPay only |

---

## Journey — Organization (Structure)

### Phase 1 — Discovery & Onboarding
_Goal: first meaningful action = submit a verifiable signup._

| Step | Screen/Page | What user does | What happens next | Notes |
|------|-------------|----------------|-------------------|-------|
| 1 | 01 Accueil public | Clicks "Je suis une Structure" | Opens structure signup | |
| 2 | 02 Authentification (structure) | Enters org name, type, region→commune, responsible phone, email, 12-char password; uploads récépissé | Dossier submitted → pending validation | Cannot publish until approved |
| 3 | Pending state | Waits for moderation | Email/notification on decision | Refusal carries a reason |

### Phase 2 — Core Usage
_Goal: main value action = publish a cause and receive traceable donations._

| Step | Screen/Page | What user does | What happens next | Notes |
|------|-------------|----------------|-------------------|-------|
| 1 | 07 Tableau de bord structure (`/structure`) | Sees stats + causes with status timeline | Clicks "Créer une cause" | |
| 2 | 08 Créer une cause | Step 1 info, Step 2 objectif (date or goal + mandatory deadline), Step 3 aperçu | Submits → Soumise → En modération | Every cause carries a deadline |
| 3 | 07 Tableau de bord | Tracks Approuvée/Refusée (with reason)/Active | Cause goes live when approved | Can withdraw while in moderation |
| 4 | 07 Tableau de bord | Watches donations accumulate | Goal or deadline reached | Funds release automatically |

### Phase 3 — Retention & Return
_Goal: user comes back on their own = proves good use and keeps standing._

| Step | Screen/Page | What user does | What happens next | Notes |
|------|-------------|----------------|-------------------|-------|
| 1 | 09 Preuve de réception | Uploads ≥5 items + report + fund breakdown | Submitted → moderation | Blocked under 5 items |
| 2 | 07 Tableau de bord | Sees proof validated + published | Donors can view it | Builds track record |
| 3 | Suspension flow | If a payout proof is missed within 7 days | Account auto-suspended | Moderator can lift |

---

## Journey — Hospital

### Phase 1 — Discovery & Onboarding
_Goal: first meaningful action = get verified as a hospital._

| Step | Screen/Page | What user does | What happens next | Notes |
|------|-------------|----------------|-------------------|-------|
| 1 | 02 Authentification | Signs up, type = "Hôpital (don de sang)", uploads Ministry of Health agrément | Pending validation (same queue) | Does not create cagnottes |
| 2 | 09 Tableau de bord hôpital (`/hopital`) | Lands after approval | Sees stock + active alerts | |

### Phase 2 — Core Usage
_Goal: main value action = call in compatible donors fast._

| Step | Screen/Page | What user does | What happens next | Notes |
|------|-------------|----------------|-------------------|-------|
| 1 | 09b Réserves de sang | Reviews/edits per-group stock | Keeps reserves accurate | |
| 2 | 10 Émettre une alerte | Picks blood types, units, urgency, target communes | Preview "X donneurs notifiés" → send | Prototype: moderator may also create |
| 3 | 09 Tableau de bord | Sees responders + slots | Confirms attendees | Each confirmation: stock +1 |

### Phase 3 — Retention & Return
_Goal: user comes back on their own = closes the loop and thanks donors._

| Step | Screen/Page | What user does | What happens next | Notes |
|------|-------------|----------------|-------------------|-------|
| 1 | 09 Tableau de bord | Closes alert when met | Alert archived | |
| 2 | 10b Remercier les donneurs | Writes + sends thank-you | Confirmed donors notified | No automatic SUNUSOCIAL message |

---

## Journey — Moderator

### Phase 1 — Discovery & Onboarding
_Goal: first meaningful action = reach the queues securely._

| Step | Screen/Page | What user does | What happens next | Notes |
|------|-------------|----------------|-------------------|-------|
| 1 | Mod 01 Connexion (`/moderation`) | Email + password (+ 2FA) | Enters moderation platform | Separate URL; no role selector |
| 2 | Mod 02 Files d'attente | Sees counts for all queues | Picks an item | |

### Phase 2 — Core Usage
_Goal: main value action = keep the platform trustworthy._

| Step | Screen/Page | What user does | What happens next | Notes |
|------|-------------|----------------|-------------------|-------|
| 1 | Mod 03 Revue d'inscription | Reviews récépissé + declared info | Valider / Refuser (reason) | Reason visible to structure |
| 2 | Mod 04 Revue de cause | Reviews a submitted cause | Approve / refuse (reason) | |
| 3 | Mod 05 Revue de preuve | Inspects the exact donor dossier; checks flags | Validate / escalate | Auto-flagged items highlighted |

### Phase 3 — Retention & Return
_Goal: recurring arbitration keeps money fair._

| Step | Screen/Page | What user does | What happens next | Notes |
|------|-------------|----------------|-------------------|-------|
| 1 | Mod 06 Demande de suppression | Reviews a deletion request | Approve (refund/payout) or maintain (reason) | Refund disabled under SycaPay |
| 2 | Mod 07 Demandes de remboursement | Reviews donor refund requests | Accept / reject (final) | Hidden entirely under SycaPay |

---

## Page Index

| Page | Route | Purpose | Used in Journey |
|------|-------|---------|-----------------|
| Accueil public | `/` | Value prop, how it works, public proofs | Donor/Structure P1 |
| Authentification | `/connexion`, `/inscription` | Signup/login (role-aware) | All P1 |
| Accueil donateur | `/causes` | Causes feed, filters, featured | Donor P2 |
| Détail de la cause | `/causes/[id]` | Full cause + donation entry | Donor P2 |
| Modal de don | (overlay on detail) | Amount, method, fee/net, success | Donor P2 |
| Profil donateur | `/profil` | History, impact, proofs, refunds | Donor P3 |
| Dossier de preuve | (overlay on profil) | Gallery + report + spend | Donor P3 |
| Don de sang | `/sang` | Blood profile + alerts + respond | Donor P2/P3 |
| Confirmer sa venue | (overlay on sang) | Visit-slot confirmation | Donor P2 |
| Tableau de bord structure | `/structure` | Stats + causes + timeline | Structure P2 |
| Créer une cause | `/structure/causes/nouvelle` | 3-step cause wizard | Structure P2 |
| Preuve de réception | `/structure/preuve/[causeId]` | Submit dossier | Structure P3 |
| Tableau de bord hôpital | `/hopital` | Stock + alerts + responders | Hospital P2/P3 |
| Émettre une alerte | `/hopital/alerte` | Create alert + thank donors | Hospital P2/P3 |
| Modération | `/moderation` + queues | Login + all review screens | Moderator all |

## Edge Cases & Alternate Flows

| Scenario | Trigger | Where user lands | How it's handled |
|----------|---------|------------------|------------------|
| Donor not logged in tries to view a cause | Direct link while logged out | Redirect to login | Must be logged in to view/donate |
| Payment fails/cancelled at provider | Provider webhook `failed` or abandon | Back on cause detail | Donation stays `failed`/`pending`; no progress change |
| Duplicate payment webhook | Provider retry | No-op | Idempotent on `providerTxnId` |
| Cause refused | Moderator refuses | Structure dashboard | Refusal reason shown inline |
| Structure deletes published cause | Deletion request approved | Donor dashboard notice | Reason + funds refunded or paid out shown |
| Refund requested under SycaPay | Donor opens profil | Refund action absent | Impossible — funds already paid |
| Proof missing after payout | 7-day deadline passes | Structure dashboard | Account auto-suspended until moderator lifts |
| Monetary cause never reaches goal | Deadline passes | — | Releases everything collected at deadline [HYPOTHESIS] |
| Blood alert, donor's group not requested | Alert sent | Donor `/sang` | Alert hidden / "Groupe non recherché" |
| No alerts for donor's group | Donor opens `/sang` | Empty state | "Aucune alerte pour votre groupe en ce moment." |
| Structure in moderation withdraws cause | No donations yet | Structure dashboard | Structure can self-withdraw |

## Notifications & Async Events

| Event | Trigger | Channel | Deep link destination |
|-------|---------|---------|-----------------------|
| Proof published for a supported cause | Moderator validates proof | In-app + SMS | `/profil` → dossier |
| Donation confirmed | Payment webhook success | In-app | `/profil` |
| Cause approved / refused | Moderator decision | In-app (+ email) | `/structure` |
| Deletion decision | Moderator arbitration | In-app | `/profil` (donor), `/structure` (org) |
| Refund decision | Moderator arbitration | In-app + SMS | `/profil` |
| Blood alert (compatible) | Alert created | In-app + SMS | `/sang` → alert |
| Blood visit reminder | ~2h before slot | SMS | `/sang` |
| Account suspended | Missed proof deadline | In-app + email | `/structure` |
| Thank-you from hospital | Alert closed | In-app + SMS | `/sang` |

<!-- assumed: SMS channel for all SMS rows is pending the SMS provider decision (context.md §14); until then show in-app + an "en attente de validation" SMS preview. -->
