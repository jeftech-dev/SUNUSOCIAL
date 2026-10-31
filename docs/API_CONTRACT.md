# SUNUSOCIAL — API Contract

Full request/response shapes for the core functions. Amounts are **integer FCFA**. Timestamps are epoch milliseconds unless noted. Fields marked `// required` must be present; others are optional. Errors use the envelope in `API_DESIGN.md` ("Error Responses").

---

## Auth

Errors from app functions are `ConvexError`s whose `data` is `{ code, message, field }` (`lib/types.ts` `ApiError`); `message` is French and can be shown as is. Implementation: `convex/auth.ts`, `convex/otp.ts`, `convex/passwordReset.ts`.

### action `otp.send`
SMS one-time codes (DT-2): 6 digits, stored as a keyed hash (`OTP_HASH_SECRET`), 10-min expiry, 5 attempts. Per number and purpose: at most 3 codes in 10 min, 10 in 24 h, and 60 s between two codes. Codes sent to signed-out people (every purpose except `login_2fa`) also count toward `SMS_DAILY_CAP` across all numbers.

**Request**
```json
{ "purpose": "donor_signup", "phone": "77 123 45 67" }   // purpose: donor_signup | org_contact | payout_number | password_reset | login_2fa
                                                           // phone: required except for login_2fa (sent to the signed-in account's phone)
```
**Response (success)**
```json
{ "channel": "sms", "to": "+221 77 ••• 45 67", "expiresAt": 1761750000000 }
```
**Errors:** `VALIDATION` (not a Senegalese mobile number), `RATE_LIMITED` (per-number limits, or "L'envoi de SMS est momentanément indisponible." once `SMS_DAILY_CAP` is reached), `UNAUTHENTICATED` / `FORBIDDEN` (`login_2fa`).

The answer never reveals whether an account exists: `donor_signup` on a registered number sends that number an "account exists" SMS instead of a code, and `password_reset` on an unknown number sends nothing. `login_2fa` asked again within 60 s by the same session (a page reload) keeps the code already sent and answers success.

### action `auth.registerDonor`
An action (Convex Auth hashes the password in an action). The account is created only if the SMS code is valid; then the client signs in. The code is checked first (a wrong one counts as an attempt) and marked used in the same transaction that creates the account, so a failed creation leaves it usable.

**Request**
```json
{
  "name": "Aminata Diop",      // required
  "phone": "+221771234567",    // required, Senegalese mobile, normalised to E.164
  "password": "••••••••",      // required, ≥ 8 chars
  "otpCode": "583014",         // required — from otp.send({ purpose: "donor_signup", phone })
  "bloodProfile": {            // optional — opt-in only, off by default
    "optIn": true,
    "bloodType": "O+",         // one of A±,B±,AB±,O±, or "unknown"
    "region": "Dakar",         // from lib/geo.ts
    "commune": "Médina",       // required when optIn is true
    "smsOptIn": true
  }
}
```
**Response (success)**
```json
{ "userId": "…", "role": "donor" }   // then signIn("password", { flow: "signIn", identifier: phone, password })
```
**Errors:** `VALIDATION` (`name`, `phone`, `password`, `region`, `commune`), `OTP_INVALID` (`otpCode`: "Code incorrect ou expiré." / "Trop d'essais. Demandez un nouveau code."), `CONFLICT` (`phone`, only after a valid code).

### HTTP `POST /signup/receipt` (Convex HTTP action)
Uploads the récépissé / agrément during an organisation signup (`convex/files.ts`). The URL is the deployment's `.convex.site` origin (`lib/convexSite.ts`); CORS allows `SITE_URL` only.

**Request:** the file as the body, with headers:
```
Content-Type: application/pdf          // application/pdf | image/jpeg | image/png, ≤ 5 MB
X-Signup-Phone: +221771234567          // the responsible's phone
X-Signup-Code: 583014                  // otp.send({ purpose: "org_contact", phone }) — checked, not used up
```
The type is checked against the file's first bytes. At most 5 uploads per phone in 10 min.

**Response:** `200 { "storageId": "kg2…" }`, or `{ "error": { code, message, field } }` with `400`/`415`/`413` (`VALIDATION`), `403` (`OTP_INVALID`), `429` (`RATE_LIMITED`). Uploads never attached to an account are deleted after 24 h (daily cron).

### action `auth.registerOrganization`
**Request**
```json
{
  "organizationName": "Pouponnière Keur Khadija", // required
  "type": "Pouponnière",                          // required: Hôpital (don de sang)|Orphelinat|Prison pour femmes|Centre pour handicapés|Pouponnière|Foyer|Autre
  "region": "Thiès",                              // required
  "commune": "Mbour",                             // required, within the region
  "responsibleName": "Khadija Sow",               // required
  "responsiblePhone": "+221771234567",            // required, mobile: receives the login SMS code
  "email": "contact@keurkhadija.sn",              // required, professional email (login identifier)
  "password": "••••••••••••",                     // required, ≥ 12 chars
  "receiptNo": "SG/DAGAT/2026-0417",              // optional
  "receiptFileId": "kg2…",                         // required — storageId from POST /signup/receipt for this responsiblePhone
  "contactOtpCode": "583014",                     // required — otp.send({ purpose: "org_contact", phone: responsiblePhone })
  "payout": {                                      // required for structures, omitted for hospitals
    "method": "wave",                             // orange_money | wave
    "accountNumber": "+221781112233",             // mobile number
    "holderName": "Khadija Sow",                  // the responsible's own name — informational, not checked by NabooPay
    "otpCode": "204817"                           // otp.send({ purpose: "payout_number", phone: accountNumber });
                                                  // omitted when accountNumber is the responsiblePhone (contactOtpCode proves it)
  }
}
```
**Response (success)**
```json
{ "structureId": "…", "status": "pending", "message": "Vérification par notre équipe en cours. …" }
```
**Errors:** `VALIDATION` (any field; `receiptFileId` for a file not uploaded through `/signup/receipt` for this phone, oversized or of the wrong type), `OTP_INVALID` (`contactOtpCode`, `payout.otpCode`), `CONFLICT` (`email`, only after valid codes). Codes are checked first and marked used with the account creation, as for donors.

### Sign-in (Convex Auth) + `otp.verifyLogin`
Sign-in uses Convex Auth's client call through the Next.js proxy (`/api/auth`, httpOnly cookies); there is no custom login mutation.

```ts
await signIn("password", {
  flow: "signIn",
  identifier: "+221771234567",   // phone for donors, email for organisations and moderators
  password: "••••••••",
  audience: "moderation",        // sent by the moderation subdomain's login form
});
```
Without `audience: "moderation"`, moderator accounts are refused, and with it, every other account is. This keeps each login form to its own accounts; it is not a security boundary, because the client sets `audience` (DT-9). Moderator access rests on the role check and the SMS code. Failed attempts are limited by Convex Auth (30 per hour per account). Errors carry only a message (`InvalidAccountId`, `InvalidSecret`, `TooManyFailedAttempts`, `AccountDisabled`); the UI shows a generic "Identifiant ou mot de passe incorrect."

Then, for structure, hospital and moderator accounts (`auth.me` returns `mfaRequired: true, mfaVerified: false`): `otp.send({ purpose: "login_2fa" })`, then:

**`otp.verifyLogin` request**
```json
{ "code": "428913" }
```
**Response** — returned, not thrown, so failed attempts are counted:
```json
{ "ok": true }
{ "ok": false, "error": { "code": "OTP_INVALID", "message": "Code incorrect ou expiré." } }
```

### query `auth.me`
```json
{
  "user": { "_id": "…", "role": "structure", "name": "Khadija Sow", "phone": "+221…", "email": "…" },
  "profile": null,                               // donorProfiles row for donors
  "structure": { "_id": "…", "name": "…", "type": "Pouponnière", "status": "pending", "refusalReason": null },
  "mfaRequired": true,
  "mfaVerified": false
}
```
`null` when signed out. Readable before the SMS step; every other function for these roles answers `MFA_REQUIRED` until it is done (`convex/lib/guards.ts`).

### mutation `auth.updateBloodProfile` (donor)
Same shape as `bloodProfile` above. Logged as `blood.optIn` or `profile.update`.

### Password reset
- Donors: `otp.send({ purpose: "password_reset", phone })`, then action `passwordReset.resetWithSmsCode({ phone, code, newPassword })` → `{ ok: true }`. Ends every session.
- Organisations and moderators: action `passwordReset.requestEmailReset({ email })` → always `{ ok: true }`; the email links to `/mot-de-passe/nouveau?token=…` (30 min, single use). Then action `passwordReset.resetWithToken({ token, newPassword })` → `{ ok: true, role }`. Ends every session; the SMS code is asked at the next login.

### internal action `admin.createModerator`
`npx convex run admin:createModerator '{"name": "…", "email": "…", "phone": "+221…"}'` creates the account without a password and emails a link to set one (DT-20).

---

## Causes

All three require a donor or moderator session. They only show **listed** causes: `active`, from a structure that is `approved` and not suspended (DT-34, DB-17). `causes.get` also shows a `closed` cause of such a structure.

### query `causes.list`
Paginated with Convex's standard pagination, for `usePaginatedQuery`.

**Request**
```json
{
  "category": "Alimentation",     // optional: Santé|Alimentation|Matériel
  "filter": "urgent",             // optional, one at a time: urgent|almost|recent
  "query": "lait",                // optional; searches cause titles (first 100 characters kept)
  "paginationOpts": { "numItems": 12, "cursor": null }   // numItems capped at 48
}
```
Order: soonest deadline first; `recent` = newest approval first; with `query`, by relevance (`recent` then has no effect). `urgent` = urgency `urgent`; `almost` = at least 75 % of the goal (`ALMOST_REACHED_PERCENT`).

**Response (success) — 200**
```json
{
  "page": [
    {
      "id": "…",
      "title": "Lait infantile pour 32 nourrissons",
      "category": "Alimentation",
      "organization": { "name": "Pouponnière Keur Khadija", "verified": true },
      "bannerUrl": "https://…",   // null if the file is missing
      "raised": 4500,
      "goal": 10000,
      "percent": 45,              // integer, rounded down, capped at 100
      "urgent": true,
      "endCondition": { "type": "date", "deadline": 1760486400000 }
    }
  ],
  "isDone": false,
  "continueCursor": "eyJ…"
}
```
A page can hold fewer items than asked when a structure stopped being verified; keep loading until `isDone`.

### query `causes.featured`
**Request** `{}` → **Response** one card (same shape as a `causes.list` item), or `null` when no listed cause is the Coup de cœur.

### query `causes.get`
**Request**
```json
{ "id": "…" }   // required; any string (an id from the URL)
```
**Response (success) — 200**
```json
{
  "id": "…",
  "title": "Lait infantile pour 32 nourrissons",
  "description": "…",
  "category": "Alimentation",
  "urgency": "urgent",
  "organization": { "id": "…", "name": "Pouponnière Keur Khadija", "verified": true, "city": "Mbour, Thiès" },
  "bannerUrl": "https://…",
  "raised": 4500,
  "goal": 10000,
  "percent": 45,
  "donorCount": 23,
  "endCondition": { "type": "goal", "deadline": 1765756800000 },
  "estimatedNet": 9700,        // goal minus the estimated fees — shown on the page
  "featured": false,
  "status": "active",          // active | closed
  "similar": [ { "id": "…", "title": "…", "raised": 55000, "goal": 55000, "percent": 100, "bannerUrl": "…" } ]  // ≤ 3, same category, listed
}
```
**Not found:** `null` when the id is malformed or unknown, or the cause isn't visible (pending, refused, withdrawn, deleted, or its structure isn't verified). The page shows « Cette cause n'existe plus. ». A live query returning `null` lets an open page switch to that state instead of failing.

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

Implementation: `convex/donations.ts`, `convex/payments.ts`, `lib/providers/*`. Only signed-in donors call these functions; every one checks the role and ownership on the server.

### action `donations.createCheckout`
Inserts the donation (`pending`, fee recomputed on the server), creates the NabooPay transaction, stores its `order_id`, then answers. The client only redirects to `checkoutUrl` (with the `mock` provider: the in-app simulator `/paiement/simulation/<donationId>`). Amounts and fees sent by the client are never used.
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
  "checkoutUrl": "https://checkout.naboopay.com/checkout/550e8400-…",
  "status": "pending"
}
```
**Response (error)**
```json
{ "error": { "code": "CONFLICT", "message": "Cette cause n'accepte plus de dons.", "field": null } }
```
| Code | When |
|---|---|
| `VALIDATION` (`field: "amount"`) | Not an integer, or under `MIN_DONATION` (500) |
| `CONFLICT` | The cause is not listed (closed, deleted, from a suspended structure: DB-17) or its deadline has passed |
| `NOT_FOUND` | Unknown cause |
| `RATE_LIMITED` | More than 10 checkouts in 10 minutes for this donor |
| `PAYMENT_FAILED` | NabooPay refused or did not answer; the donation is marked `failed` and nothing is charged |
| `UNAUTHENTICATED` / `FORBIDDEN` | Not signed in / not a donor |

### query `donations.status`
The success page (`/dons/<donationId>`, NabooPay's `success_url`) and the simulator read the donation live. Owner only; returns `null` for someone else's donation or a malformed id.
**Request**
```json
{ "donationId": "don_…" }
```
**Response (success) — 200**
```json
{
  "id": "don_…",
  "status": "held",               // pending | held | released | refunded | failed
  "amount": 5000,
  "fee": 150,                     // NabooPay's actual fee once paid
  "net": 4850,
  "method": "wave",               // chosen in the modal
  "paidMethod": "wave",           // null until paid
  "lateRefund": false,            // true: paid after the cause closed, refunded automatically (DB-18)
  "createdAt": 1760313600000,
  "cause": { "id": "cau_…", "title": "Lait infantile pour 40 bébés", "raised": 655000, "goal": 800000, "percent": 81, "status": "active" }
}
```

### action `donations.refreshStatus`
Called once by the success page: asks NabooPay (`GET /transactions/{order_id}`) about a donation still `pending` and records it if it is paid, in case the webhook was missed (DT-3). Owner only. Answers the donation status.
```json
{ "donationId": "don_…" }   →   { "status": "held" }
```

### action `payments.simulatePayment` (mock provider only)
The simulator's buttons. Refused (`FORBIDDEN`) unless `PAYMENT_PROVIDER=mock` and `APP_ENV` is not `production`; owner only, on a `pending` donation. `paid` signs a v2 webhook payload with the mock secret and runs it through the webhook handler; `cancelled` marks the donation `failed`.
```json
{ "donationId": "don_…", "outcome": "paid" }   →   { "redirectTo": "/dons/don_…" }   // cancelled → "/causes/cau_…?paiement=echec"
```

### `POST /payments/naboopay/webhook` (Convex httpAction, signed)
Payload checked against the `naboopay` skill (`references/webhooks.md`, Sprint 4 spike). Only `order_id`, `transaction_status` and `amount` exist in both webhook versions; when `fees` or `selected_payment_method` is missing (v1), the handler reads them with `GET /transactions/{order_id}`.
**Request** (from NabooPay, API v2 webhook — header `X-Signature: <hex HMAC-SHA256 of the raw body>`)
```json
{
  "order_id": "550e8400-e29b-41d4-a716-446655440000",  // = donations.providerTxnId (stored before redirect); idempotency key
  "transaction_status": "paid",       // paid | paid_and_blocked — both mean paid
  "amount": 5000,                     // must equal the donation amount
  "fees": 150,                        // actual NabooPay fee → stored on the donation
  "selected_payment_method": "wave",
  "currency": "XOF",
  "paid_at": "2026-11-15T10:35:00Z"
}
```
NabooPay only calls this on success and retries 3 times, 5 minutes apart; pending donations are also re-checked with `GET /transactions/{order_id}` (success page + 10-minute cron).
**Response (success) — 200**
```json
{ "ok": true }
```
**Response (error)**
```json
HTTP 401 with an empty body when the signature is missing or invalid (nothing is recorded).
HTTP 400 when the body is not JSON or lacks order_id / transaction_status / amount.
HTTP 503 when fees must be read from NabooPay and that call fails (NabooPay retries; the 10-minute cron also catches it).
```
`200` is also the answer for an unknown `order_id`, a status other than `paid` / `paid_and_blocked`, a duplicate delivery, and an `amount` that does not match the donation (audit-logged, nothing recorded), so NabooPay does not retry them.

**What a recorded payment does** (`payments.recordPayment`, internal mutation, idempotent on `order_id`): stores NabooPay's actual `fees`, the `net` and `paidMethod`, sets the donation `held`, and logs `donation.paid`. If the cause is still `active`: `raised += amount`, `donorCount + 1` on the donor's first confirmed gift to it, a `donation_confirmed` notification, and, for a goal cause that reaches its goal, the cause closes (DT-24). Otherwise (DB-18): the donation is flagged `lateRefundFlaggedAt`, not counted, and the donor gets a `donation_late_refund` notification and SMS.

### query `donations.mine`
The donor's history, newest first, for `usePaginatedQuery` (like `causes.list`). Owner only.
**Request**
```json
{ "paginationOpts": { "numItems": 20, "cursor": null } }
```
**Response (success) — 200**
```json
{
  "page": [
    {
      "id": "don_…",
      "cause": "Séances de kinésithérapie",
      "organization": "Centre Aw Handicap",
      "causeId": "cau_…",
      "amount": 10000,
      "net": 9700,
      "method": "wave",                                   // the method actually used (paidMethod), else the one chosen
      "date": 1760313600000,
      "status": "held",                                   // pending | held | released | refunded | failed
      "lateRefund": false,                                // paid after the cause closed: refunded automatically (DB-18)
      "proof": { "available": true, "proofId": "prf_…", "itemCount": 5 },
      "refund": { "eligible": true, "estimatedAmount": 9700 /* net */, "request": null },   // eligible only while held; request: null | { status, refundAmount }
      "causeDeleted": null                                // or { reason, outcome: "refunded"|"paidOut" }
    }
  ],
  "isDone": true,
  "continueCursor": null
}
```

### query `donations.impact`
The donor's cumulative impact, for "Vous avez contribué à N causes pour X FCFA": confirmed donations (`held` or `released`, late payments excluded).
```json
{}   →   { "total": 12500, "causeCount": 3, "donationCount": 4 }
```

### mutation `donations.requestRefund`
**Request**
```json
{ "donationId": "don_…", "reason": "Je me suis trompé de montant.", "receivingPhone": "+221771234567" }  // reason ≥ 5 chars; phone defaults to the verified one
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

### mutation `bloodAlerts.create` (hospital)
**Request**
```json
{
  // hospitalId comes from the session
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
{ "ok": true, "refundAmount": 9700, "payoutStatus": "queued", "message": "Remboursement de 9 700 FCFA (montant net) en cours vers Ousmane Ba sur Wave." }
```

### mutation `moderation.setFeatured`
**Request**
```json
{ "causeId": "…" }   // or null to clear; the cause must be listed (active, verified structure). Replaces the current Coup de cœur.
```
**Response (success) — 200**
```json
{ "ok": true, "message": "« Lait infantile pour 32 nourrissons » est le Coup de cœur de la semaine." }
```
Clearing answers `"Le Coup de cœur a été retiré."`. Logged as `featured.set` (details: the previous cause ids) or `featured.clear`. The Coup de cœur stays until replaced or removed; it is not cleared automatically.

**Response (error)**
```json
{ "error": { "code": "VALIDATION", "message": "Cette cause ne peut pas être choisie : elle doit être active et publiée par une structure vérifiée.", "field": "causeId" } }
```

### query `moderation.featuredCandidates`
**Request** `{}` → **Response** the listed causes, soonest deadline first (at most 200):
```json
[ { "id": "…", "title": "Trois fauteuils roulants adaptés", "organization": "Centre Aw Handicap", "category": "Matériel", "percent": 86, "urgent": false, "featured": true } ]
```

### mutation `extensions.request`
**Request**
```json
{ "kind": "cause_deadline", "targetId": "cau_…", "requestedUntil": 1765756800000, "reason": "Livraison du fournisseur retardée." }  // kind: cause_deadline | proof_deadline; ≤ 30 days later
```
**Response (success) — 200**
```json
{ "requestId": "ext_…", "status": "pending", "message": "Demande de prolongation envoyée au modérateur." }
```

### mutation `moderation.decideExtension`
**Request**
```json
{ "requestId": "ext_…", "decision": "approve", "reason": "Retard fournisseur justifié." }  // approve | refuse; reason required on refuse
```
**Response (success) — 200**
```json
{ "ok": true, "newDate": 1765756800000, "message": "Prolongation accordée. Les donateurs ont été informés." }
```
