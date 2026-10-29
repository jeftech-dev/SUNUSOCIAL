# SUNUSOCIAL — API Contract

Full request/response shapes for the core functions. Amounts are **integer FCFA**. Timestamps are epoch milliseconds unless noted. Fields marked `// required` must be present; others are optional. Errors use the envelope in `API_DESIGN.md` ("Error Responses").

---

## Auth

### mutation `auth.registerDonor`
**Request**
```json
{
  "name": "Aminata Diop",      // required
  "phone": "+221771234567",    // required, E.164
  "password": "••••••••",      // required
  "bloodProfile": {            // optional — opt-in only, off by default
    "optIn": true,
    "bloodType": "O+",         // one of A±,B±,AB±,O±, or "unknown"
    "region": "Dakar",
    "commune": "Médina",
    "smsOptIn": true
  }
}
```
**Response (success) — 200**
```json
{ "userId": "usr_01H…", "role": "donor", "session": "sess_…" }
```
**Response (error)**
```json
{ "error": { "code": "VALIDATION", "message": "Ce numéro est déjà utilisé.", "field": "phone" } }
```

### mutation `auth.registerOrganization`
**Request**
```json
{
  "organizationName": "Pouponnière Keur Khadija", // required
  "type": "Pouponnière",                          // required: Hôpital (don de sang)|Orphelinat|Prison pour femmes|Centre pour handicapés|Pouponnière|Foyer|Autre
  "region": "Thiès",                              // required
  "commune": "Mbour",                             // required
  "responsiblePhone": "+221338001234",            // required
  "email": "contact@keurkhadija.sn",              // required, professional email
  "password": "••••••••••••",                     // required, ≥ 12 chars
  "receiptFileId": "file_…",                       // required — uploaded récépissé/agrément (PDF/JPG/PNG ≤ 5MB)
  "payout": {                                      // required — verified by the moderator with the documents
    "method": "wave",                             // orange_money | wave
    "accountNumber": "+221771234567",             // E.164
    "holderName": "Khadija Sow"
  }
}
```
**Response (success) — 200**
```json
{ "structureId": "str_…", "status": "pending", "message": "Dossier envoyé. Vérification par notre équipe en cours." }
```
**Response (error)**
```json
{ "error": { "code": "VALIDATION", "message": "Le mot de passe doit comporter au moins 12 caractères.", "field": "password" } }
```

### Sign-in (Convex Auth) + `mfa.verifyCode`
Sign-in uses Convex Auth's client call; there is no custom `auth.login` mutation.

```ts
await signIn("password", { flow: "signIn", email: "+221771234567" /* phone for donors, email for orgs */, password: "••••••••" });
```
Then, for structure/hospital/moderator accounts only (`auth.me` returns `mfaRequired: true`):

**`mfa.sendCode` request** `{}` → **response** `{ "channel": "email", "expiresAt": 1761750000000 }`

**`mfa.verifyCode` request**
```json
{ "code": "428913" }   // required, 6 digits; 10-min expiry; 5 attempts max
```
**Response (success) — 200**
```json
{ "ok": true }
```
**Response (error)**
```json
{ "error": { "code": "UNAUTHENTICATED", "message": "Code incorrect ou expiré.", "field": "code" } }
```

---

## Causes

### query `causes.list`
**Request**
```json
{
  "category": "Alimentation",     // optional: Santé|Alimentation|Matériel
  "filter": "urgent",             // optional: urgent|almost|recent
  "query": "lait",                // optional free text
  "cursor": null,                 // optional pagination cursor
  "limit": 12
}
```
**Response (success) — 200**
```json
{
  "page": [
    {
      "id": "cau_…",
      "title": "Lait infantile pour 32 nourrissons",
      "category": "Alimentation",
      "organization": { "name": "Pouponnière Keur Khadija", "verified": true },
      "bannerUrl": "https://…",
      "raised": 4500,
      "goal": 10000,
      "percent": 45,
      "urgent": true,
      "endCondition": { "type": "date", "deadline": 1760486400000 }
    }
  ],
  "isDone": false,
  "continueCursor": "eyJ…"
}
```

### query `causes.get`
**Request**
```json
{ "id": "cau_…" }   // required
```
**Response (success) — 200**
```json
{
  "id": "cau_…",
  "title": "Lait infantile pour 32 nourrissons",
  "description": "…",
  "category": "Alimentation",
  "urgency": "urgent",
  "organization": { "id": "str_…", "name": "Pouponnière Keur Khadija", "verified": true, "city": "Mbour, Thiès" },
  "bannerUrl": "https://…",
  "raised": 4500,
  "goal": 10000,
  "percent": 45,
  "donorCount": 23,
  "endCondition": { "type": "goal", "deadline": 1765756800000 },
  "estimatedNet": 9700,        // goal minus the 3% fee — shown on the page
  "featured": false,
  "status": "active",
  "similar": [ { "id": "cau_…", "title": "…", "raised": 55000, "goal": 55000, "percent": 100, "bannerUrl": "…" } ]
}
```
**Response (error)**
```json
{ "error": { "code": "NOT_FOUND", "message": "Cette cause n'existe plus.", "field": null } }
```

### mutation `causes.create`
**Request**
```json
{
  "title": "Couches et lingettes — trimestre 4", // required
  "description": "…",                             // required
  "category": "Matériel",                         // required
  "bannerFileId": "file_…",                       // required
  "endCondition": {                               // required
    "type": "goal",                               // date | goal — every cause also carries a deadline
    "deadline": 1765756800000,                    // required (safety deadline even for goal type)
    "goalAmount": 120000                          // required when type = goal
  },
  "targetAmount": 120000,                         // required
  "urgency": "normal"                             // normal | urgent
}
```
**Response (success) — 200**
```json
{ "id": "cau_…", "status": "pending", "message": "Cause soumise · en modération" }
```
**Response (error)**
```json
{ "error": { "code": "VALIDATION", "message": "La date limite est obligatoire.", "field": "endCondition.deadline" } }
```

### mutation `causes.requestDeletion`
**Request**
```json
{ "causeId": "cau_…", "reason": "Le besoin a été couvert par une ONG partenaire." }  // reason ≥ 5 chars
```
**Response (success) — 200**
```json
{ "requestId": "del_…", "status": "pending", "message": "Demande de suppression envoyée au modérateur" }
```

---

## Donations

### action `donations.createCheckout`
**Request**
```json
{
  "causeId": "cau_…",     // required
  "amount": 5000,         // required, integer FCFA
  "method": "wave"        // required: orange_money | wave
}
```
**Response (success) — 200**
```json
{
  "donationId": "don_…",
  "provider": "naboopay",        // mock in dev/preview
  "amount": 5000,
  "feeRate": 0.03,
  "fee": 150,
  "platformFee": 0,              // 0 until the revenue model is decided
  "net": 4850,                   // what the structure receives at release
  "checkoutUrl": "https://pay.naboopay.com/…",
  "status": "pending"
}
```
**Response (error)**
```json
{ "error": { "code": "CONFLICT", "message": "Cette cause n'accepte plus de dons.", "field": null } }
```

### `POST /payments/naboopay/webhook` (Convex httpAction, signed)
> Field names below are placeholders: the real payload and signature header follow NabooPay's documentation (Sprint 4 spike, DT-3).
**Request** (from provider)
```json
{
  "providerTxnId": "NB-93f1…",   // required — used for idempotency
  "donationId": "don_…",
  "status": "succeeded",         // succeeded | failed
  "amount": 5000,
  "method": "wave",
  "signature": "…"               // verified against the webhook secret
}
```
**Response (success) — 200**
```json
{ "ok": true }
```
**Response (error)**
```json
{ "error": { "code": "PAYMENT_FAILED", "message": "Signature de webhook invalide.", "field": null } }
```

### query `donations.mine`
**Request**
```json
{ "cursor": null, "limit": 20 }
```
**Response (success) — 200**
```json
{
  "page": [
    {
      "id": "don_…",
      "cause": "Séances de kinésithérapie",
      "organization": "Centre Aw Handicap",
      "amount": 10000,
      "method": "Wave",
      "date": 1760313600000,
      "status": "held",                                   // pending | held | released | refunded | failed
      "proof": { "available": true, "proofId": "prf_…", "itemCount": 5 },
      "refund": { "eligible": true, "estimatedAmount": 9700, "request": null },   // eligible only while held; request: null | { status, refundAmount }
      "causeDeleted": null                                // or { reason, outcome: "refunded"|"paidOut" }
    }
  ],
  "isDone": true,
  "continueCursor": null
}
```

### mutation `donations.requestRefund`
**Request**
```json
{ "donationId": "don_…", "reason": "Je me suis trompé de montant." }  // reason ≥ 5 chars
```
**Response (success) — 200**
```json
{ "requestId": "ref_…", "status": "pending", "message": "Demande envoyée. Un modérateur décidera." }
```
**Response (error)**
```json
{ "error": { "code": "CONFLICT", "message": "Remboursement indisponible : les fonds ont déjà été versés.", "field": null } }
```

---

## Proofs

### mutation `proofs.submit`
**Request**
```json
{
  "causeId": "cau_…",                 // required
  "report": "22 moustiquaires installées le 9 octobre…",  // required, ≥ 10 chars
  "items": [                          // required, ≥ 5
    { "kind": "photo", "fileId": "file_…", "caption": "Dortoir des garçons" },
    { "kind": "video", "fileId": "file_…", "caption": "Visite filmée", "durationSec": 42 },
    { "kind": "invoice", "fileId": "file_…", "supplier": "Pharmacie Kadior", "ref": "FAC-2026-1187", "lines": [ { "label": "Moustiquaire × 22", "amount": 48400 } ] },
    { "kind": "delivery_note", "fileId": "file_…", "supplier": "Casamance Express", "ref": "BL-0942" },
    { "kind": "photo", "fileId": "file_…", "caption": "Dortoir des filles" }
  ],
  "spend": [                          // required — fund-use breakdown
    { "label": "22 moustiquaires MILDA", "amount": 48400 },
    { "label": "Transport", "amount": 3000 }
  ]
}
```
**Response (success) — 200**
```json
{
  "proofId": "prf_…",
  "status": "submitted",
  "itemCount": 5,
  "autoFlagged": [ { "index": 0, "reason": "Image similaire à une photo déjà publiée (91 %)." } ],
  "message": "Preuve envoyée (5 éléments) · en attente de validation"
}
```
**Response (error)**
```json
{ "error": { "code": "VALIDATION", "message": "Ajoutez au moins 5 fichiers.", "field": "items" } }
```

---

## Blood module

### query `bloodAlerts.forDonor`
**Request**
```json
{ "status": "open" }   // open | all
```
**Response (success) — 200**
```json
{
  "alerts": [
    {
      "id": "alt_…",
      "hospital": "Hôpital Principal de Dakar",
      "place": "Dakar-Plateau",
      "bloodTypes": ["O+", "O-"],
      "level": "vitale",             // vitale | urgente | normale
      "unitsNeeded": 4,
      "unitsCollected": 2,
      "deadline": "Aujourd'hui",
      "targetCommunes": ["Médina", "Pikine"],
      "compatibleForMe": true,
      "myResponse": null             // null | { slot: "Aujourd'hui, 14 h – 16 h" }
    }
  ]
}
```

### mutation `bloodAlerts.respond`
**Request**
```json
{ "alertId": "alt_…", "slot": "Aujourd'hui, 14 h – 16 h" }  // required
```
**Response (success) — 200**
```json
{ "ok": true, "message": "Venue confirmée. L'hôpital voit votre prénom et votre groupe, pas votre adresse." }
```

### mutation `bloodAlerts.create` (moderator; hospital only when `BLOOD_ALERTS_HOSPITAL_SELF_SERVE`)
**Request**
```json
{
  "hospitalId": "str_…",          // required
  "bloodTypes": ["O+"],           // required, ≥ 1
  "level": "vitale",              // required
  "unitsNeeded": 10,              // required
  "targetCommunes": ["Médina", "Pikine"],  // required, within the hospital's region
  "channels": { "inApp": true, "sms": true }
}
```
**Response (success) — 200**
```json
{ "id": "alt_…", "estimatedRecipients": 470, "message": "470 donneurs compatibles seront notifiés." }
```

### mutation `bloodAlerts.confirmDonation`
**Request**
```json
{ "alertId": "alt_…", "responderId": "rsp_…" }
```
**Response (success) — 200**
```json
{ "ok": true, "bloodType": "O+", "stockBefore": 6, "stockAfter": 7 }
```

---

## Moderation

### query `moderation.queues`
**Request**
```json
{}
```
**Response (success) — 200**
```json
{
  "structures": { "count": 4, "items": [ { "id": "str_…", "name": "Foyer Keur Yaay", "type": "Foyer", "region": "Dakar", "submittedAt": 1760140800000 } ] },
  "causes": { "count": 3, "items": [ { "id": "cau_…", "title": "Réparation de la toiture", "organization": "Foyer Jàmm", "urgent": true } ] },
  "proofs": { "count": 3, "items": [ { "id": "prf_…", "cause": "Riz, huile et sucre", "flagged": true } ] },
  "deletions": { "count": 2, "items": [ { "id": "del_…", "title": "Fournitures scolaires 2026", "raised": 64000, "donors": 18 } ] },
  "refunds": { "count": 1, "items": [ { "id": "ref_…", "amount": 10000, "refundAmount": 9700 } ] },
  "payoutChanges": { "count": 0, "items": [] },
  "featured": { "causeId": "cau_…", "since": 1761523200000 }
}
```

### mutation `moderation.decideCause`
**Request**
```json
{ "causeId": "cau_…", "decision": "refuse", "reason": "Le devis des travaux est manquant." }  // reason required when decision = refuse
```
**Response (success) — 200**
```json
{ "ok": true, "status": "refused", "message": "Cause refusée — la structure a été notifiée." }
```
**Response (error)**
```json
{ "error": { "code": "VALIDATION", "message": "La raison du refus est obligatoire.", "field": "reason" } }
```

### mutation `moderation.decideDeletion`
**Request**
```json
{
  "requestId": "del_…",           // required
  "decision": "approve",          // approve | maintain
  "reason": "Besoin couvert par une ONG partenaire.",  // required, ≥ 10 chars
  "fundOutcome": "refund"         // required when funds > 0: refund | payout
}
```
**Response (success) — 200**
```json
{
  "ok": true,
  "outcome": "refund",
  "proofDeadline": null,          // set to a date when fundOutcome = payout
  "message": "« Fournitures scolaires 2026 » supprimée — 18 donateurs remboursés."
}
```
**Response (error)**
```json
{ "error": { "code": "VALIDATION", "message": "Choisissez le sort des fonds collectés.", "field": "fundOutcome" } }
```

### mutation `moderation.decideRefund`
**Request**
```json
{ "requestId": "ref_…", "decision": "refunded" }  // refunded | rejected — decision is final
```
**Response (success) — 200**
```json
{ "ok": true, "refundAmount": 9700, "message": "9 700 FCFA remboursés à Ousmane Ba sur Wave." }
```

### mutation `moderation.setFeatured`
**Request**
```json
{ "causeId": "cau_…" }   // or null to clear; the cause must be active. Replaces the current Coup de cœur.
```
**Response (success) — 200**
```json
{ "ok": true, "message": "« Lait infantile pour 32 nourrissons » est le Coup de cœur de la semaine." }
```
