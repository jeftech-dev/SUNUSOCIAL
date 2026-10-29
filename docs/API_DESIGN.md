# SUNUSOCIAL — API Design

| | |
|---|---|
| **Base URL** | `https://<convex-deployment>.convex.cloud` (via the Convex client) |
| **Protocol** | Convex function calls (queries / mutations / actions) over the Convex client; webhooks over HTTPS |
| **Auth** | Convex Auth sessions (JWT + refresh); role resolved server-side; SMS one-time code required for structure/hospital/moderator sessions; sessions ≤ 7 days. NabooPay webhook authenticated by signature. |
| **Format** | JSON documents; amounts are integer **FCFA** |
| **Version** | v1 |

> **Note on shape.** SUNUSOCIAL's backend is Convex, so the "API" is a set of **named functions** (queries, mutations, actions), not REST routes. This document maps those functions in a resource-oriented way, and the few true HTTP endpoints (the NabooPay webhook and Convex Auth routes, both in `convex/http.ts`) use REST conventions. Full request/response payloads are in `API_CONTRACT.md`.

## Design Principles

1. **Resource-oriented** — functions are grouped by resource (`causes`, `donations`, `proofs`, `structures`, `bloodAlerts`, …) in the `convex/` tree.
2. **Verb by function kind** — `queries` read (never write), `mutations` write transactionally, `actions` perform external side effects (payments, SMS).
3. **Plural resource names** — module files are plural nouns (`causes.ts`, `donations.ts`).
4. **Versioned** — breaking changes bump to a `v2` module rather than mutating `v1` semantics.
5. **Validated at the boundary** — every function declares Convex `v.*` validators; no unchecked client input reaches the DB.
6. **Authorized server-side** — every mutation/action re-checks role and ownership; the moderation functions reject non-moderator sessions.
7. **Paginated** — list queries use Convex cursor pagination, never unbounded reads.
8. **Idempotent money** — payment actions dedupe on the provider transaction id.

## Authentication

Sessions are established by Convex Auth (`signIn("password", …)`) and the JWT is attached to every Convex call by the client. Identity comes from `getAuthUserId(ctx)`; the role is read from `users.role` server-side. Clients never send the role.

```text
Authorization: Bearer <convex-auth-jwt>      # added automatically by the Convex client
```

Structure, hospital and moderator sessions must complete `otp.verifyLogin` (SMS code) before any other function accepts them (DT-2). Moderator sessions are only valid on the moderation subdomain. Every session expires after 7 days.

**Public (no session) reads:**
- Landing content and the **public proofs feed** (validated proof dossiers) — visible without an account.

Everything else requires a session. **Donors must be logged in to view and donate to causes.** Moderation functions require a moderator session and live behind the separate moderation URL.

## Resource Map

### Auth
| Kind | Function | Description | Auth |
|------|----------|-------------|------|
| action | `otp.send` | Send an SMS code (purpose: `donor_signup` \| `login_2fa` \| `password_reset` \| `payout_number`) | Public / pre-MFA session |
| mutation | `auth.registerDonor` | Create donor (name, phone, password, SMS code) — phone verified | Public |
| mutation | `auth.registerOrganization` | Create structure/hospital + upload récépissé/agrément + payout account for structures only (number verified by SMS code); pending validation | Public |
| action | `signIn("password")` / `signOut` | Convex Auth: phone+password (donor) or email+password (org/hospital/mod) | Public |
| mutation | `otp.verifyLogin` | Verify the SMS code; marks the session MFA-verified | Org/hospital/mod session, pre-MFA |
| mutation | `passwordReset.resetWithSmsCode` | Donor: new password with a valid SMS code | Public (code) |
| action | `passwordReset.requestEmailReset` | Organization: email a reset link (always returns ok) | Public |
| mutation | `passwordReset.resetWithToken` | Organization: new password with a valid token | Public (token) |
| query | `auth.me` | Current user + role + blood opt-in | Any session |
| mutation | `auth.updateBloodProfile` | Opt in/out, set blood type + region/commune + SMS pref | Donor |

### Causes
| Kind | Function | Description | Auth |
|------|----------|-------------|------|
| query | `causes.list` | Paginated approved causes; filter by category + Urgent/Presque atteint/Récent | Donor |
| query | `causes.featured` | Weekly editor's pick | Donor |
| query | `causes.get` | One cause with progress, end condition, similar causes | Donor |
| query | `causes.mine` | A structure's own causes with status timeline | Structure |
| mutation | `causes.create` | Submit a cause (→ Soumise/En modération) | Structure |
| mutation | `causes.update` | Edit a cause (pre-publication or allowed fields) | Structure |
| mutation | `causes.withdraw` | Withdraw a cause still in moderation (no donations) | Structure |
| mutation | `causes.requestDeletion` | Motivated deletion request for a published cause | Structure |
| mutation | `extensions.request` | Request a cause-deadline extension or a proof delay (reason, new date) | Structure |

### Donations
| Kind | Function | Description | Auth |
|------|----------|-------------|------|
| action | `donations.createCheckout` | Start Orange Money/Wave checkout; returns fee + net + redirect | Donor |
| http | `POST /payments/naboopay/webhook` | NabooPay callback (`X-Signature` HMAC) → `payments.recordPayment`: record donation (held), bump progress, schedule release at goal | Signature |
| query | `donations.status` | Success page: re-checks the transaction with NabooPay if still pending | Donor (owner) |
| query | `donations.mine` | Donor's history with proof links and refund/deletion status | Donor |
| mutation | `donations.requestRefund` | Request a refund (net amount) while funds are held; confirms the receiving number | Donor |
| query | `donations.forCause` | Donations/aggregates for a structure's cause | Structure |

### Proofs
| Kind | Function | Description | Auth |
|------|----------|-------------|------|
| mutation | `proofs.submit` | Submit dossier (≥5 items + report + fund breakdown); auto-flags suspicious items | Structure |
| query | `proofs.get` | One dossier (donor-facing shape) | Donor / Moderator |
| query | `proofs.publicFeed` | Validated dossiers for the landing feed | Public |
| query | `proofs.mine` | A donor's accessible validated dossiers | Donor |

### Structures
| Kind | Function | Description | Auth |
|------|----------|-------------|------|
| query | `structures.me` | Dashboard stats for the signed-in structure | Structure |
| mutation | `structures.update` | Edit profile | Structure |
| mutation | `structures.requestPayoutChange` | Request a new payout account (SMS code on the new number + moderator approval; payouts blocked meanwhile) | Structure |
| query | `notifications.mine` / mutation `notifications.markRead` | In-app notifications | Any session |

### Blood module
| Kind | Function | Description | Auth |
|------|----------|-------------|------|
| query | `bloodAlerts.forDonor` | Alerts matching the donor's blood type + commune | Donor (opted-in) |
| mutation | `bloodAlerts.respond` | Confirm a visit slot | Donor (opted-in) |
| query | `bloodAlerts.forHospital` | A hospital's alerts + responders | Hospital |
| mutation | `bloodAlerts.create` | Create and send an alert (types, units, urgency, communes) | Hospital |
| mutation | `moderation.closeAlert` | Close or disable any alert | Moderator |
| mutation | `bloodAlerts.confirmDonation` | Mark a donor as donated; stock +1 | Hospital |
| mutation | `bloodAlerts.close` | Close an alert | Hospital |
| mutation | `bloodAlerts.sendThanks` | Send thank-you to confirmed donors | Hospital |
| query | `bloodStock.get` / mutation `bloodStock.update` | Read / set per-group reserves | Hospital |

### Moderation
| Kind | Function | Description | Auth |
|------|----------|-------------|------|
| query | `moderation.queues` | Counts + items for all queues | Moderator |
| mutation | `moderation.decideStructure` | Approve / refuse a structure (reason on refuse) | Moderator |
| mutation | `moderation.decideCause` | Approve / refuse a cause (reason on refuse) | Moderator |
| mutation | `moderation.decideProof` | Validate / escalate a proof dossier | Moderator |
| mutation | `moderation.decideDeletion` | Arbitrate deletion + fund fate (refund/payout) | Moderator |
| mutation | `moderation.decideRefund` | Approve / reject a refund request (final) | Moderator |
| mutation | `moderation.decidePayoutAccount` | Approve / refuse a payout-account change | Moderator |
| mutation | `moderation.setFeatured` | Pick (or clear) the weekly "Coup de cœur" | Moderator |
| mutation | `moderation.liftSuspension` | Lift a structure's auto-suspension | Moderator |
| mutation | `moderation.decideExtension` | Approve / refuse a cause-deadline extension or proof delay (reason) | Moderator |
| query | `moderation.payouts` | Payout queue status, NabooPay balance, reconciliation alerts | Moderator |

## Error Responses

Functions throw a structured application error; the client maps it to a French user message.

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Action réservée à un modérateur.",
    "field": null
  }
}
```

| Code | Meaning | Typical cause |
|------|---------|---------------|
| `UNAUTHENTICATED` | No valid session | Not logged in |
| `FORBIDDEN` | Wrong role / not owner | Donor calling a moderation function |
| `VALIDATION` | Input failed validation | Missing field, bad amount, < 5 proof items |
| `NOT_FOUND` | Resource missing | Unknown cause/alert id |
| `CONFLICT` | State disallows action | Donating to a non-active cause; refund after release |
| `PAYMENT_FAILED` | Provider rejected/failed | Checkout or webhook failure |
| `OTP_INVALID` | Wrong or expired SMS code | Signup, 2FA or reset |
| `RATE_LIMITED` | Too many requests | Abusive client |

## Pagination Shape

Cursor-based (Convex `paginate`):

```json
{
  "page": [ { "_id": "…", "title": "…" } ],
  "isDone": false,
  "continueCursor": "eyJpZCI6Li4ufQ=="
}
```

Request the next page by passing `continueCursor` back as the cursor.

## Rate Limiting

| Category | Rule |
|----------|------|
| Auth (login/register) | 5 attempts / 10 min / phone or email; backoff on failure |
| Donation checkout | 10 / min / donor |
| Payment webhook | Unlimited but idempotent (dedupe on provider txn id) |
| Blood alert create | 20 / hour / hospital |
| Proof submission | 5 / hour / structure |
| General reads | 120 / min / session |

| SMS code send | 3 / 10 min / phone number |
| Calls to NabooPay | < 100 / 60 s / endpoint (NabooPay's own limit) |
| Password reset request | 3 / hour / email |

Implemented with `@convex-dev/rate-limiter` (DT-19). Numbers are first-pass defaults; tune against NabooPay limits and real traffic.
