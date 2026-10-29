# SUNUSOCIAL — API Design

| | |
|---|---|
| **Base URL** | `https://<convex-deployment>.convex.cloud` (via the Convex client) |
| **Protocol** | Convex function calls (queries / mutations / actions) over the Convex client; webhooks over HTTPS |
| **Auth** | Session-based; role carried server-side. Payment webhooks authenticated by signature. |
| **Format** | JSON documents; amounts are integer **FCFA** |
| **Version** | v1 |

> **Note on shape.** SUNUSOCIAL's backend is Convex, so the "API" is a set of **named functions** (queries, mutations, actions), not REST routes. This document maps those functions in a resource-oriented way, and the few true HTTP endpoints (payment webhooks, and the Next.js route handlers that proxy them) use REST conventions. Full request/response payloads are in `API_CONTRACT.md`.

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

Sessions are established at login and carried on each call; the resolved identity and role live server-side. Clients never send the role.

```text
# Conceptual header carried by the Convex client session
Authorization: Session <session-token>
X-Role: donor | structure | hospital | moderator   (resolved server-side, not trusted from client)
```

**Public (no session) reads:**
- Landing content and the **public proofs feed** (validated proof dossiers) — visible without an account.

Everything else requires a session. **Donors must be logged in to view and donate to causes.** Moderation functions require a moderator session and live behind the separate moderation URL.

## Resource Map

### Auth
| Kind | Function | Description | Auth |
|------|----------|-------------|------|
| mutation | `auth.registerDonor` | Create donor (name, phone, password) | Public |
| mutation | `auth.registerOrganization` | Create structure/hospital + upload récépissé; pending validation | Public |
| mutation | `auth.login` | Phone+password (donor) or email+password (+2FA for org/hospital/mod) | Public |
| mutation | `auth.logout` | End session | Any session |
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

### Donations
| Kind | Function | Description | Auth |
|------|----------|-------------|------|
| action | `donations.createCheckout` | Start Orange Money/Wave checkout; returns fee + net + redirect | Donor |
| action | `payments.webhook` | Provider callback: confirm payment, record donation, bump progress | Signature |
| query | `donations.mine` | Donor's history with proof links and refund/deletion status | Donor |
| mutation | `donations.requestRefund` | Request refund while funds held (NabooPay only) | Donor |
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

### Blood module
| Kind | Function | Description | Auth |
|------|----------|-------------|------|
| query | `bloodAlerts.forDonor` | Alerts matching the donor's blood type + commune | Donor (opted-in) |
| mutation | `bloodAlerts.respond` | Confirm a visit slot | Donor (opted-in) |
| query | `bloodAlerts.forHospital` | A hospital's alerts + responders | Hospital |
| mutation | `bloodAlerts.create` | Create an alert (types, units, urgency, communes) | Moderator (prototype) / Hospital |
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
| `CONFLICT` | State disallows action | Donating to a non-active cause; refund under SycaPay |
| `PAYMENT_FAILED` | Provider rejected/failed | Checkout or webhook failure |
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

<!-- assumed: specific rate-limit numbers are first-pass defaults; tune against provider limits and real traffic. -->
