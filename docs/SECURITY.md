# SUNUSOCIAL — Security

| | |
|---|---|
| **Version** | 1.0 |
| **Last Updated** | 29 October 2026 |

---

## 1. Threat Model

### Assets to Protect
- **Donors' money in flight** — donation amounts, fee/net integrity, held funds (in SUNUSOCIAL's NabooPay merchant account until payout), and **structures' payout accounts** (where released funds go).
- **Donor identity data** — names, phone numbers (the login id), and especially **blood type + commune**, which is health data.
- **Structure verification documents** — récépissés/agréments (uploaded PDFs/images).
- **Proof dossiers** — media and financial breakdowns that underpin the platform's trust promise.
- **The trust signal itself** — the "Vérifié" badge and published proofs; a fraudulent structure or faked proof damages every honest one.
- **Moderation authority** — the separate moderation platform and its decisions (approvals, fund fate, refunds).

### Threat Actors
- **Fraudulent "structure"** — registers with a fake/borrowed document to collect donations for a non-existent need, or submits a faked proof dossier (reused/stolen photos).
- **Opportunistic donor abuse** — attempts refund fraud, or repeated chargeback-style requests.
- **Credential attacker** — tries to take over a structure, hospital, or moderator account to redirect funds or approve bad content.
- **Snooping party** — tries to read donors' blood type/location (health data) or link donations to identities.
- **Payment-webhook forger** — spoofs a "payment succeeded" callback to inflate a cause or trigger a payout.
- **Curious insider** — over-broad access to donor PII or moderation tools.

### Key Risks
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Forged payment webhook inflates funds / triggers payout | Medium | High | Verify provider signature; idempotency on `providerTxnId`; never trust client-reported payment status |
| Fake structure collects donations | Medium | High | Document verification (documents + payout account) by a moderator before publishing; moderation of every cause; funds held until goal/deadline; proof-or-suspend rule |
| Payout account swapped to divert funds, or mistyped | Medium | High | Payout number verified by SMS code at signup and on every change; changes go to `payoutPending` and block payouts until a moderator re-approves; audit-logged; MFA on structure logins |
| Faked proof dossier | Medium | High | Auto-flags (perceptual-hash duplicates, EXIF date, reused invoice refs, spend vs. received — DT-13); moderator reviews full dossier; ≥ 5 items + invoices required; public visibility deters reuse |
| Donor health data (blood type/commune) leaked | Low | High | Opt-in only, off by default; hospitals never see address; expose only first name + group on responses; access checks on `donorProfiles` |
| Account takeover (structure/hospital/moderator) | Medium | High | Email + 12-char password + **SMS one-time code** at each login; rate-limited login and code entry; hashed passwords; separate moderation subdomain; sessions ≤ 7 days |
| SIM swap / stolen phone used for donor reset | Low | Medium | Reset by SMS code to the verified phone; rate-limited; audit-logged; donors hold no withdrawable balance; refunds only to the verified phone |
| Payout sent twice or to the wrong wallet | Low | High | Single payout worker (NabooPay allows one at a time); never auto-resend after timeout/5xx — reconcile via `GET /payouts`; verified payout account only; balance check before sending; audit log |
| NabooPay balance ≠ app ledger | Low | High | Daily reconciliation job compares `GET /accounts` main balance with Σ held − pending payouts; alert moderators on drift |
| Refund fraud | Low | Medium | Refund only while funds are held; moderator arbitration is final; reason required; refunds go back to the paying wallet only |
| Moderation surface reachable by non-moderator | Low | High | Separate URL + route group; server-side role check on every moderation function; no role selector |
| Over-broad PII access (insider) | Low | Medium | Least-privilege; donor PII limited to what a flow needs; audit log of moderation actions |

## 2. Authentication & Authorization

- **Donors:** phone + password. **The phone number is verified by SMS code at signup** (board decision) and donor activity is logged, so every donation is tied to a verified, traceable phone number. A donor must be logged in to view and donate.
- **Structures / Hospitals / Moderators:** professional email + password (**≥ 12 characters**) + **one-time code** on each login: 6 digits, hashed at rest, 10-min expiry, 5 attempts. Sent **by SMS** to the account's phone (DT-2); development uses a console provider that never sends.
- **Moderator:** separate platform on its own subdomain (host-routed in middleware, host-scoped cookies), email + password + one-time code, **no role selector**, accounts created only via an internal CLI mutation (DT-20).
- **Sessions:** Convex Auth (JWT + refresh tokens, keys `JWT_PRIVATE_KEY`/`JWKS` in Convex env). Role, MFA state and ownership are resolved server-side and never read from client input.
- **Password reset:** SMS code for donors; single-use email link for organizations, followed by the SMS code at next login (DT-15). Reset requests never reveal whether an account exists; a reset ends all sessions.
- **Authorization rules:**
  - Donors: read approved causes + validated proofs; read/write only their own donations, refund requests, and blood profile.
  - Structures: read/write only their own causes and proofs; cannot delete a published cause without moderator approval.
  - Hospitals: manage only their own alerts and stock; see responders' first name + group only — never addresses.
  - Moderators: read all queues; every refusal/deletion/refund decision requires a reason; refund arbitration is final.
- **Token expiry:** sessions expire after inactivity and have an absolute max lifetime. 7-day absolute lifetime for every role (board decision DB-8); logout or password change ends all sessions (DT-27).

## 3. Data Security

- **Passwords:** hashed by Convex Auth (Scrypt) in `authAccounts`; never stored on `users`, never logged.
- **PII fields:** `users.phone`, `users.name`, `users.email`, and `donorProfiles.bloodType`/`region`/`commune`. Blood data is treated as **health data**: opt-in, editable, minimized, and never exposed to hospitals beyond first name + blood group on a response.
- **Transit:** HTTPS/TLS everywhere (Vercel + Convex enforce it); payment redirects go only to the provider's HTTPS checkout.
- **At rest:** Convex-managed encryption for documents and file storage; uploaded files are only returned by queries that have checked access; récépissés/agréments are visible to moderators only. Note that a Convex storage URL, once handed out, is unguessable but not time-limited — never return one to a caller who isn't allowed to see the file.
- **Data minimization:** donor addresses are never attached to blood alerts; moderation sees exactly the donor-facing dossier, nothing more.

## 4. Secrets Management

- **`.env` policy:** all secrets (Convex Auth keys, NabooPay API key and webhook secret, Resend and SMS keys) live in environment variables; `.env.local` is git-ignored; `.env.example` holds only placeholder names.
- **Production secrets:** stored in the Vercel project environment and Convex environment variables — never in the repo, never in client bundles. Only `NEXT_PUBLIC_*` values reach the browser (and those must be non-secret).
- **Rotation:** rotate the Convex Auth keys, NabooPay keys (separate `checkout` and `payout` scoped keys — least privilege) and webhook secret, and Resend/SMS keys on staff change and at least annually; rotate immediately on suspected exposure. `PAYMENT_PROVIDER=mock` is refused in production.

## 5. API Security

- **Input validation:** every Convex function declares `v.*` validators; amounts are validated as positive integer FCFA; statuses/ids are validated against allowed values before any write.
- **Rate limiting:** `@convex-dev/rate-limiter`, per `API_DESIGN.md` — tight on auth, one-time codes, resets and checkout; webhooks unlimited but idempotent.
- **Origin isolation:** Convex functions are authorized by session, not by origin; the moderation app is isolated by subdomain, host-scoped cookies, MFA and the moderator role check on every moderation function.
- **Webhook verification:** the `httpAction` reads the raw body and rejects NabooPay calls unless `X-Signature` equals the hex HMAC-SHA256 of that body keyed with `NABOOPAY_WEBHOOK_SECRET` (constant-time compare); the amount is checked against the pending donation; processing is idempotent on `providerTxnId` so retries/forgeries can't double-count or double-pay.
- **No trust in client money math:** the fee/net shown in the modal is recomputed server-side at checkout; the authoritative amount comes from the provider webhook, not the client.
- **Payout/release guards:** fund release happens only via internal functions (goal reached, deadline cron) or a moderator deletion decision — never by a client call; it is idempotent (`fundsReleasedAt`), blocked while a payout-account change is pending, and audit-logged.
- **Audit log:** every moderation decision, payout, refund, payout-account change and extension decision — plus donor activity (signup, logins, donations, profile changes, refund requests) — is written to the append-only `auditLog` (DT-18). Donor login events are purged after 12 months.

## 6. Dependency Security

- **Audit process:** `npm audit` in CI on every PR; block merges on high/critical advisories affecting production deps.
- **Automated updates:** Dependabot/Renovate for Convex, Next.js, and provider SDKs; review and merge weekly.
- **CVE policy:** triage high/critical within 48 hours; patch or mitigate before the next release. Pin provider SDK versions and review their changelogs (the payment and SMS SDKs are the highest-risk dependencies).

## 7. Incident Response

1. **Detect** — alert on webhook signature failures spiking, auth brute-force patterns, payout anomalies, or a report of a fraudulent structure/proof.
2. **Contain** — disable the affected account/session; pause the relevant payment flow (freeze release for the affected cause); revoke exposed secrets.
3. **Assess** — determine scope: which donors, which funds, which PII; reconstruct from the donations ledger and moderation audit log.
4. **Notify** — inform SUNUSOCIAL (founder/board via the project owner) and affected donors/structures; for a health-data exposure, notify affected donors promptly and plainly, in French.
5. **Fix** — remediate the root cause (patch, rotate secrets, tighten a check), refund or reconcile any mis-moved funds with the provider.
6. **Post-mortem** — written, blameless; record timeline, impact, fix, and a prevention item tracked to completion.

Escalation goes through the project owner to the SUNUSOCIAL board. Add a dedicated security contact before launch. A health-data incident may also require notifying the CDP (see `BOARD_QUESTIONS.md` Q8).
