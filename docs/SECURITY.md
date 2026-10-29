# SUNUSOCIAL — Security

| | |
|---|---|
| **Version** | 1.0 |
| **Last Updated** | 28 October 2026 |

---

## 1. Threat Model

### Assets to Protect
- **Donors' money in flight** — donation amounts, fee/net integrity, held funds (NabooPay escrow).
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
| Fake structure collects donations | Medium | High | Document verification before publishing; moderation of every cause; held funds (NabooPay) release only at goal/deadline; proof-or-suspend rule |
| Faked proof dossier | Medium | High | Auto-flag suspicious media (similarity/metadata); moderator reviews full dossier; ≥ 5 items + invoices required; public visibility deters reuse |
| Donor health data (blood type/commune) leaked | Low | High | Opt-in only, off by default; hospitals never see address; expose only first name + group on responses; access checks on `donorProfiles` |
| Account takeover (structure/hospital/moderator) | Medium | High | Email + 12-char password + **SMS 2FA**; rate-limited login; hashed passwords; separate moderation URL |
| Refund fraud | Low | Medium | Refund only while funds held (NabooPay); moderator arbitration is final; reason required |
| Moderation surface reachable by non-moderator | Low | High | Separate URL + route group; server-side role check on every moderation function; no role selector |
| Over-broad PII access (insider) | Low | Medium | Least-privilege; donor PII limited to what a flow needs; audit log of moderation actions |

## 2. Authentication & Authorization

- **Donors:** phone + password, **no OTP** (deliberate, to avoid SMS cost). A donor must be logged in to view and donate — so every donation is tied to a known phone number.
- **Structures / Hospitals / Moderators:** professional email + password (**≥ 12 characters**) + **SMS two-factor** (code to the responsible's phone) on each login. <!-- assumed: 2FA depends on the pending SMS provider (§4, context.md §14); until live, enforce the password policy and stub 2FA behind a feature flag. -->
- **Moderator:** separate platform, separate URL, email + password, **no role selector**.
- **Sessions:** server-side session with a signed token (`AUTH_SECRET`); role and ownership are resolved server-side and never read from client input.
- **Authorization rules:**
  - Donors: read approved causes + validated proofs; read/write only their own donations, refund requests, and blood profile.
  - Structures: read/write only their own causes and proofs; cannot delete a published cause without moderator approval.
  - Hospitals: manage only their own alerts and stock; see responders' first name + group only — never addresses.
  - Moderators: read all queues; every refusal/deletion/refund decision requires a reason; refund arbitration is final.
- **Token expiry:** sessions expire after inactivity and have an absolute max lifetime. <!-- assumed: no explicit TTL was specified; default to 7-day absolute / 24-hour idle, shorter for moderators. -->

## 3. Data Security

- **Passwords:** hashed with a memory-hard algorithm (Argon2id preferred, or bcrypt); never stored or logged in plaintext.
- **PII fields:** `users.phone`, `users.name`, `users.email`, and `donorProfiles.bloodType`/`region`/`commune`. Blood data is treated as **health data**: opt-in, editable, minimized, and never exposed to hospitals beyond first name + blood group on a response.
- **Transit:** HTTPS/TLS everywhere (Vercel + Convex enforce it); payment redirects go only to the provider's HTTPS checkout.
- **At rest:** Convex-managed encryption for documents and file storage; uploaded récépissés and proof media are access-controlled, served via time-limited/authorized URLs rather than public links.
- **Data minimization:** donor addresses are never attached to blood alerts; moderation sees exactly the donor-facing dossier, nothing more.

## 4. Secrets Management

- **`.env` policy:** all secrets (`AUTH_SECRET`, provider API keys and webhook secrets, SMS keys) live in environment variables; `.env.local` is git-ignored; `.env.example` holds only placeholder names.
- **Production secrets:** stored in the Vercel project environment and Convex environment variables — never in the repo, never in client bundles. Only `NEXT_PUBLIC_*` values reach the browser (and those must be non-secret).
- **Rotation:** rotate `AUTH_SECRET`, payment webhook secrets, and SMS keys on staff change and at least annually; rotate immediately on suspected exposure. The payment provider's keys are re-issued per provider when the board finalizes NabooPay vs SycaPay.

## 5. API Security

- **Input validation:** every Convex function declares `v.*` validators; amounts are validated as positive integer FCFA; statuses/ids are validated against allowed values before any write.
- **Rate limiting:** per `API_DESIGN.md` — tight on auth and checkout; webhooks unlimited but idempotent.
- **CORS:** the Convex deployment accepts calls only from the configured app origins (`NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_MODERATION_URL`); the moderation origin is isolated.
- **Webhook verification:** payment webhooks are rejected unless the provider signature verifies against `*_WEBHOOK_SECRET`; processing is idempotent on `providerTxnId` so retries/forgeries can't double-count or double-pay.
- **No trust in client money math:** the fee/net shown in the modal is recomputed server-side at checkout; the authoritative amount comes from the provider webhook, not the client.
- **Payout/release guards:** fund release (NabooPay) happens only via the automatic goal/deadline sweep or a moderator deletion decision — never by a client call.

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

<!-- assumed: no formal IR contacts/SLAs were provided; escalate through the project owner to the SUNUSOCIAL board. Add a dedicated security contact before launch. -->
