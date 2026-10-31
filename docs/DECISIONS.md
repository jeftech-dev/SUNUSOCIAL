# SUNUSOCIAL — Decision Log

| | |
|---|---|
| **Last Updated** | 31 October 2026 (rev. 6: Sprint 4 payment details in DT-3, DT-7 and DT-24. Rev. 5: DB-16 NabooPay money circuit, DB-17 suspended structures, DB-18 payments confirmed after a cause closes) |
| **Status** | Authoritative. If another document disagrees with this log, this log wins and the other document is a bug |

Two kinds of entries:

- **Board decisions (`DB-*`)**: made by SUNUSOCIAL and relayed by the project owner.
- **Technical decisions (`DT-*`)**: made by JefTech.

Product questions that are still open live in `BOARD_QUESTIONS.md` (French). Each has an **interim default** in code, held in a single config value (§3).

---

## 1. Board decisions

| ID | Decision | Consequences for the build |
|---|---|---|
| **DB-1** | **NabooPay** is the payment provider (Orange Money + Wave, no card). SycaPay is dropped | One real adapter (`naboopay`) plus a `mock` adapter for development and tests |
| **DB-2** | **Funds are held** until the cause's release condition is met | Donations go `pending → held → released` or `refunded`. A held donation can be refunded. How funds are held with NabooPay: DT-3 |
| **DB-3** | **Structures are verified on documents only.** The moderator approves or refuses; there is no physical visit | One validation step that covers the documents **and** the payout account (DT-5) |
| **DB-4** | **Lump-sum payout** at release | One payout per cause (DT-4) |
| **DB-5** | **Every cause has a deadline**, including causes with a monetary goal. Funds are released at the goal or the deadline, whichever comes first | `causes.deadline` is required for every cause |
| **DB-6** | **The moderator curates the "Coup de cœur de la semaine"** | `moderation.setFeatured`. Only one cause is featured at a time |
| **DB-7** | **SMS is required** for: (a) the 2FA code of structures, hospitals and moderators; (b) **verifying a donor's phone number at signup**; (c) donor password recovery; (d) blood alerts; (e) important notifications. The provider, budget and sender ID are still open | SMS becomes a **launch dependency**: donor signup can't work without it. Development uses a `console` SMS provider that logs the codes (DT-2) |
| **DB-8** | **Sessions last at most 1 week** | Convex Auth session total duration = 7 days, for every role (DT-27) |
| **DB-9** | **Donor activity is logged** (signup, logins, donations, profile changes, refund requests) so each donor is a verified, traceable person | Covered by the activity/audit log (DT-18) |
| **DB-10** | **Hospitals send blood alerts themselves** (board Q2 → option A) | `bloodAlerts.create` is available to verified hospitals. Moderators can close or disable any alert. Rate limit: 20 per hour per hospital |
| **DB-11** | **A cause lasts at most 30 days.** A structure can request an extension, which the moderator approves or refuses | `MAX_CAUSE_DURATION_DAYS = 30`. Extension requests get their own moderation queue (DT-30) |
| **DB-12** | **A proof is mandatory for every funded cause**, due 7 days after the payout. The structure can ask for a delay (sursis), which the moderator approves or refuses. A missed deadline auto-suspends the structure | `proofDeadlines` is always enforced. Delay requests use the same extension flow (DT-30) |
| **DB-13** | **Refunds return the net amount** (the donation minus the NabooPay fee) | Refunds are paid out with NabooPay **payouts**, not its refund endpoint, because that endpoint only does full refunds (DT-7) |
| **DB-14** | **Minimum donation: 500 FCFA for now**, to be studied with the board | `MIN_DONATION = 500` |
| **DB-16** | **The money circuit is confirmed** (Q4, 31/10/2026): donations go to **SUNUSOCIAL's NabooPay merchant account**, stay held there until the cause ends, and are then paid out **automatically** to the structure (or refunded) | DT-3 and DT-4 stand as written. SUNUSOCIAL still has to open the account, pass KYB and send the keys (`BOARD_QUESTIONS.md` E1); until then the app runs with `PAYMENT_PROVIDER=mock` |
| **DB-17** | **A suspended structure's causes are hidden** (G4, 31/10/2026) until the suspension is lifted. *(The PARCOURS proposal, visible with a banner, was not retained.)* | The feed, Coup de cœur, "Causes similaires" and the detail page hide them (DT-34), and they take no new donations: `donations.createCheckout` refuses them |
| **DB-18** | **A payment confirmed after its cause has closed is refunded, with a clear message** (G15, 31/10/2026) | The donation does not count toward the cause. It is refunded automatically at the **net** amount (DB-13) to the donor's phone, and the donor is told plainly why (notification + SMS: the cause was already closed, how much is refunded, similar causes). Details: DT-7 |
| **DB-15** | **Payout account:** the responsible person chooses Orange Money or Wave and gives the number and their own name. **The number is verified by an SMS code** (agreed 29/10). **Structure onboarding has 2 phases**: phase 1 at signup, phase 2 later to collect the structure's full information | `structures.payout` holds the responsible's account. A NabooPay payout only needs the method and the number, so phase 1 is enough to pay a structure. `onboardingPhase` is tracked. What phase 2 collects, and what it unlocks, is open (`BOARD_QUESTIONS.md` Q5) |

### Note: the money flow goes through SUNUSOCIAL's NabooPay account

The original brief said there would be "no SUNUSOCIAL-held central account". NabooPay works with **one merchant account in SUNUSOCIAL's name**:
1. Every donation is credited to that account and held there.
2. Structures are paid, and donors refunded, through **payouts** from that account.

Once SUNUSOCIAL has set up the account (`BOARD_QUESTIONS.md` part E1), everything is **automatic**. A daily reconciliation keeps the app ledger and the NabooPay balance in step (DT-4). The board is asked to acknowledge this in `BOARD_QUESTIONS.md` Q4.

---

## 2. Technical decisions

### Authentication & accounts

**DT-1 — Auth library: Convex Auth.**
- `@convex-dev/auth` with the Password provider.
- Donors sign in with their phone number (E.164); structures, hospitals and moderators with their email.
- The library hashes passwords (Scrypt) and manages sessions. The env vars are `JWT_PRIVATE_KEY` and `JWKS`, set in Convex.
- The role is stored on `users` and read server-side only.

**DT-2 — One-time codes, sent by SMS.** A single `otp` module covers every code-based flow:

| Purpose | Who | When |
|---|---|---|
| `donor_signup` | Donor | The account is created only after the code is verified, which sets `phoneVerifiedAt` |
| `org_contact` | Structure / hospital | Proves the responsible's phone at signup, which then receives the login codes (DT-33) |
| `payout_number` | Structure (not hospitals) | Proves control of the OM/Wave payout number, at signup and on every change (DT-5). At signup, not needed when it is the responsible's phone |
| `login_2fa` | Structure / hospital / moderator | Every login. Sets `authSessions.mfaVerifiedAt`; `requireRole()` rejects the session until then |
| `password_reset` | Donor | Code sent to the verified phone, then a new password |

- Codes are 6 digits, expire after 10 minutes, and allow 5 attempts. They are stored only as an HMAC keyed with `OTP_HASH_SECRET` (set in Convex; required in production), so a leaked table can't be reversed by trying every code.
- Sending, per number and purpose: at most 3 codes per 10 minutes and 10 per 24 hours, with 60 s between two. The 24-hour cap bounds guessing: about 50 tries a day against one number instead of about 2,000. *(Rev. 3)*
- Codes sent to people who are not signed in (every purpose except `login_2fa`) also count toward `SMS_DAILY_CAP` across all numbers, a guard against SMS cost abuse. Once it is reached, those codes are refused until the window ends; `login_2fa` keeps working. *(Rev. 3)*
- Sending never reveals whether an account exists: a `donor_signup` request for a registered number sends that number an "account exists" SMS instead of a code, and a `password_reset` request for an unknown number sends nothing. Registration answers "already used" only after a valid code. *(Rev. 3)*
- Signup codes are checked first and marked used in the same transaction that creates the account, so a failed creation leaves the code usable.
- `SMS_PROVIDER=console|<provider>`: `console` logs codes in development and preview; production refuses `console`.
- Organisations reset their password through an **email link** (Resend), because they have a professional email.

**DT-15 — Password reset.**
- Donors: an SMS code (DT-2).
- Structures, hospitals and moderators: a single-use email link, valid 30 minutes, followed by the SMS 2FA at the next login.
- Reset requests never reveal whether an account exists.
- *(Supersedes the WhatsApp-assisted reset in rev. 1, which is no longer needed now that SMS is required.)*

**DT-33 — Organisations confirm the responsible's phone at signup.** *(Rev. 3)* The responsible's phone receives the login code at every login (DT-2), so a typo would lock the account for good. Structures and hospitals therefore confirm it with an `org_contact` SMS code at signup; a structure whose payout number is a different number also confirms that one (two codes on the same screen). The récépissé / agrément is uploaded after the code is sent, through `POST /signup/receipt` (`convex/files.ts`): the upload needs that code, is limited to 5 per phone in 10 minutes, and has its size and real type (first bytes) checked before storage. Uploads not attached to an account within 24 hours are deleted by a daily cron.

**DT-20 — The first moderator.** Created by the lead developer with `npx convex run admin:createModerator '{"name", "email", "phone"}'`. The account has no password until the moderator sets one through the emailed link (so no password goes through the CLI or shell history); the phone receives the login SMS code. There is no public moderator signup.

**DT-27 — Session lifetime.**
- Convex Auth `session.totalDurationMs` = 7 days for every role (DB-8). Access JWTs are short-lived (library default) and renewed with refresh tokens within that week.
- Logging out, or changing the password, ends all of that user's sessions.

### Payments: NabooPay API v2 (checked against `.claude/skills/naboopay`)

**DT-3 — Receiving payments and holding funds.**

*Creating the payment:*
- `donations.createCheckout` calls `POST /transactions` with:
  - `method_of_payment: [<the method the donor picked>]`: the donation modal asks for Orange Money or Wave (PARCOURS S18), so the checkout page offers only that one. *(Rev. 6: was both methods, which made the modal's choice meaningless.)* The method actually used is still read from `selected_payment_method`;
  - one product line (the cause title, `price = amount`, `quantity = 1`);
  - `customer` = the donor (name and verified phone);
  - `fees_customer_side: false`, so the fee is deducted from what SUNUSOCIAL receives;
  - `success_url` / `error_url` built from our own donation id, with no percent-encoded characters.
- The NabooPay `order_id` is stored on the donation **before** the donor is redirected.

*Confirming it:*
- The webhook is a Convex **`httpAction`** at `POST /payments/naboopay/webhook`. It:
  1. reads the raw body with `await request.text()`;
  2. checks `X-Signature`, which must equal the hex HMAC-SHA256 of that body keyed with `NABOOPAY_WEBHOOK_SECRET`, using a constant-time comparison; otherwise it returns 401;
  3. parses the JSON;
  4. accepts `transaction_status` `paid` **or** `paid_and_blocked`;
  5. checks that `amount` matches the donation;
  6. calls `payments.recordPayment` (idempotent on `order_id`);
  7. answers 2xx within 5 seconds and moves slow work to the scheduler.
- **Missed webhooks.** NabooPay only sends a webhook when a payment succeeds, and gives up after 3 retries. So:
  - the success page checks `GET /transactions/{order_id}` directly;
  - a cron every 10 minutes does the same for donations still `pending` after 5 minutes;
  - a donation still unpaid after 2 hours is cancelled with `DELETE /transactions/{order_id}` and marked `failed`.

*Holding the funds:*
- **The hold is implemented in our app**: the money stays in SUNUSOCIAL's main NabooPay account, and the app's ledger records which cause each amount belongs to.
- NabooPay's `is_escrow` flag is **not** used. It must be enabled per account, and its API documentation has no release endpoint.
- The Sprint 4 spike asks NabooPay whether escrow plus a documented release would be better. If so, we switch the adapter and nothing else changes. *(Rev. 6: the spike notes are in `ARCHITECTURE.md` §3.4; the question is still open with NabooPay.)*

*Details settled in Sprint 4 (rev. 6):*
- The donation row is inserted (`pending`, server-side fee estimate) **before** `POST /transactions`, because its id builds the return URLs: `success_url = SITE_URL/dons/<donationId>`, `error_url = SITE_URL/causes/<causeId>?paiement=echec`. If NabooPay refuses the checkout, the donation is marked `failed`.
- `createCheckout` refuses a cause that is not listed (DT-34: closed, deleted, or from a suspended structure, DB-17) or whose deadline has passed, an amount under `MIN_DONATION`, and more than 10 checkouts per donor in 10 minutes.
- Webhook v1 payloads have no `fees` or `selected_payment_method`: the handler then reads them with `GET /transactions/{order_id}`, and answers `503` (so NabooPay retries) if that call fails. Unknown `order_id`s and non-paid statuses get `200` and are ignored. An `amount` that differs from the donation is audit-logged and nothing is recorded.
- A paid webhook for a donation already marked `failed` (paid just before our cancellation) is still recorded: the money was received.
- The `mock` provider sends the donor to an in-app simulator (`/paiement/simulation/<donationId>`) whose "Payer" button signs a v2 payload and runs it through the same webhook handler, signature check included. The simulator is refused unless `PAYMENT_PROVIDER=mock` and `APP_ENV` is not `production`.

**DT-4 — Payouts (release and refunds).**

*How payouts are made:*
- Every outgoing transfer goes through a `payouts` table processed by a **single worker**, because NabooPay allows one payout at a time per organisation and answers `409` otherwise. The worker uses `@convex-dev/workpool` with `maxParallelism: 1`.
- Each payout row records: `kind` (`release` | `refund`), `amount`, `method`, `phone`, `name`, `status`, NabooPay's `order_id`, and `attempts`.

*What happens on each outcome:*

| Outcome | Action |
|---|---|
| `409` (another payout running) | Wait a few seconds and retry the same payout |
| Timeout or `5xx` | **Never resend automatically.** Mark the payout `unknown`, then reconcile with `GET /payouts?recipient_phone=…` |
| `payout_status: pending` (amounts > 2,000,000 XOF go to NabooPay manual review) | Mark it `pending_review` and poll until it completes |
| Insufficient balance | The worker checks `GET /accounts` (the `main` account) first. If the balance is short, it stops and alerts the moderators instead of failing halfway |

- Every outcome is written to the audit log.

*Two API keys, least privilege:*
- `NABOOPAY_CHECKOUT_KEY` (scope `checkout`) for transactions.
- `NABOOPAY_PAYOUT_KEY` (scope `payout`) for payouts.

*Adapter:* `PaymentProvider` (`createCheckout`, `verifyWebhook`, `getTransaction`, `cancelTransaction`, `payout`, `getPayout`, `listPayouts`, `getBalance`) with `naboopay` and `mock` implementations. Production refuses `mock`.

**DT-5 — The structure's payout account (DB-15).**
- **Only structures that raise money have one.** Hospitals only send blood alerts and never receive funds, so they don't give a payout account and `structures.payout` is absent for them.
- `structures.payout = { method: orange_money | wave, accountNumber (E.164), holderName (the responsible), phoneVerifiedAt?, verifiedAt?, verifiedBy? }`.
- **What NabooPay needs:** a payout only requires `selected_payment_method`, the amount and the recipient phone. The name is optional and NabooPay does not check it against the wallet holder. So the number is enough to pay, and **a wrong number sends money to a stranger, irreversibly**.
- **The number is therefore verified by an SMS code** (OTP purpose `payout_number`) at signup, which proves the responsible controls that SIM. The name is stored as information for the moderator and is passed to NabooPay as the recipient name.
- The moderator approves the account together with the documents.
- **Changing the account** requires an SMS code on the **new** number **and** a moderator re-approval. Payouts are blocked meanwhile, and the change is audit-logged.

**DT-6 — Money arithmetic.**

| Rule | Value |
|---|---|
| Units | Integer XOF/FCFA everywhere. NabooPay requires totals > 10; our minimum is 500 |
| Shown before payment | `estimatedFee = Math.round(amount × 0.03)` and the estimated net |
| Stored once paid | NabooPay's **actual** `fees` from the webhook or `GET /transactions`. If it differs from the estimate, we log it |
| Platform fee | `platformFee = 0` until the revenue model is decided (`PLATFORM_FEE_RATE`) |
| Net to structure | `net = amount − fees − platformFee` |
| Invariant | `fees + platformFee + net = amount`, enforced by a unit test |

- `causes.raised` is the **gross** amount and drives the progress bar and the goal check.
- The release payout is `Σ net` of the cause's held donations.
- `donorCount` goes up only on a donor's first confirmed gift to that cause (index `donations_by_cause_donor`).

**DT-7 — Refunds (DB-13).**
- An approved refund queues a `refund` payout of **`net`** to the donor's verified phone, on the method they paid with (`selected_payment_method`).
- The refund form lets the donor confirm the receiving number, which defaults to their verified phone.
- NabooPay's `GET /refund/{order_id}` is **not** used: it can only refund the full amount, and as a `GET` it is easy to trigger by accident.
- **Late payments (DB-18, G15).** When `payments.recordPayment` confirms a payment whose cause is no longer `active` (closed, released, deleted), the donation is **not** added to the cause's `raised` or `donorCount`. It is recorded as paid and flagged for an automatic `refund` payout of its `net`, with no moderator decision needed, and the donor gets a clear message (in-app notification and SMS, French copy in `lib/strings.fr.ts`): the cause was already closed, the amount refunded, and similar causes. Sprint 4 records and flags these donations (`donations.lateRefundFlaggedAt`, status stays `held`); the refund payout itself goes out once the payout worker exists (Sprint 6), which looks them up by that flag. A cause counts as closed here when its `status` is not `active`; a suspended structure's still-active cause keeps counting payments started before the suspension.

**DT-24 — When funds are released.**
- **Goal reached:** for a cause whose end condition is the goal (`endType = goal`), the payment that reaches it is accepted in full, even above the goal (PARCOURS S21); the cause closes (`status = closed`, `closedAt`) in the same transaction and stops accepting donations, and `recordPayment` schedules `payments.releaseCause` straight away. A `date` cause stays open until its deadline, as its detail page says. *(Rev. 6, Sprint 4: the cause closes, but `releaseCause` and the payout worker only arrive in Sprint 6. `releaseDue` then also releases every closed cause without `fundsReleasedAt`, so nothing is stubbed.)*
- **Deadline passed:** an hourly cron releases due causes.
- `releaseCause` queues one `release` payout to the verified account, marks the donations `released`, sets `fundsReleasedAt`, and creates the proof deadline (DB-12). It is idempotent, and it is skipped while a payout-account change is pending.

### Data model

**DT-8 — Cause statuses:** `pending_review` | `active` | `refused` | `withdrawn` | `closed` | `deleted`, plus the timestamps `submittedAt`, `approvedAt`, `closedAt`, `fundsReleasedAt`.

**DT-34 — The causes feed (donor read path).** *(Rev. 4)*
- **Who sees a cause.** The feed, the Coup de cœur slot and "Causes similaires" show only **listed** causes: `active`, from a structure that is `approved` **and not suspended**. The detail page also shows a `closed` cause of such a structure. Everything else reads as "not found" (`causes.get` returns `null`).
- *Suspended structures* (G4, decided: **DB-17**): a suspended structure's causes are **hidden**, everywhere, until the suspension is lifted.
- **Order and filters.** Default: soonest deadline first. **Récent**: newest approval first. **Urgent**: `urgency = urgent`. **Presque atteint**: at least `ALMOST_REACHED_PERCENT = 75` % of the goal (the prototype's threshold; a UI constant in `lib/causes.ts`, not a board rule). One filter at a time, combinable with a category.
- **Search** covers cause titles (Convex search index, relevance order). Matching structure names too would need a denormalised field; left for later.
- **Coup de cœur** (DB-6): `moderation.setFeatured` replaces the previous one in the same transaction, so at most one cause is featured; it is not cleared automatically, and it disappears from the feed as soon as the cause stops being listed. The moderator's picker (`/coup-de-coeur` on the moderation host) shipped in Sprint 3.
- **Progress** is an integer percentage rounded down (100 % only once the goal is met). The page shows the estimated net of the goal (`computeFee`, DT-6).
- **WhatsApp** links ("Nous contacter sur WhatsApp", PRD 5.9) use `NEXT_PUBLIC_WHATSAPP_NUMBER` and are hidden while it is unset (§3).

**DT-17 — Notifications.**
- A `notifications` table holds in-app notifications.
- `notify.send` also sends an SMS (important events, blood alerts) and an email (organisations).

**DT-18 — Activity / audit log (DB-9).** An append-only `auditLog` table; rows are never edited or deleted. It records:
- **Moderation and money:** every decision, payout, refund, payout-account change and extension decision.
- **Donor activity:** `auth.signup`, `auth.login`, `donation.create`, `donation.paid`, `profile.update`, `refund.request`, `blood.optIn`.
- **Organisation logins.**

Each row keeps the IP and user-agent when available. Donor login events are kept for 12 months, then purged by a cron (data minimisation).

**DT-21 — Migrations.** `@convex-dev/migrations` for backfills, `convex/seed.ts` for seeds.

**DT-22 — Regions and communes.** One static `lib/geo.ts`, shared by Next.js and Convex. Interim data: the prototype's 8 regions.

**DT-25 — Proof deadlines (DB-12).**
- A `proofDeadlines` row is created on every release and on every deletion payout, due 7 days later, always enforced.
- The suspension cron sets `structures.suspendedAt` when a deadline passes without a validated proof.
- An approved delay moves `dueAt`. A moderator can lift a suspension.

**DT-30 — Extension requests (DB-11, DB-12).** A table `extensionRequests`:

| Field | Values |
|---|---|
| `kind` | `cause_deadline` \| `proof_deadline` |
| `targetId`, `requestedUntil`, `reason`, `status`, `moderatorReason`, `decidedBy` | |

- Each request can extend by at most `MAX_EXTENSION_DAYS = 30`.
- They appear in a new moderation queue, **"Demandes de prolongation"**.
- For a cause, a longer deadline means funds are held longer. That is shown to the moderator, and the cause's donors are notified.

**DT-31 — Structure onboarding phases (DB-15).**
- `structures.onboardingPhase: 1 | 2` and `profileCompletedAt?`.
- Phase 1 is the current signup: organisation, type, location, responsible, documents, payout account.
- The phase 2 fields, and whether phase 2 is required before the first payout, are open (`BOARD_QUESTIONS.md`). Until then the gate `REQUIRE_PHASE2_BEFORE_PAYOUT` stays `false`.

### Frontend & design

**DT-9 — Moderation subdomain.**
- The same Next.js app serves `moderation.<domain>`. `proxy.ts` (Next 16's middleware) routes by host; the main host returns 404 for `/moderation/*`.
- Cookies are scoped to each host.
- The moderation login form signs in with `audience: "moderation"`, and the main form without it; each refuses the other's accounts. The client sets `audience`, so this keeps people on the right form but is not a security boundary: moderator access rests on the role check and the SMS code (`requireRole`).

**DT-10 — Styling.**
- Tailwind CSS + shadcn/ui, themed with the charte (Montserrat / Inter, charte palette).
- `prototype/_ds` "Industry" is reference only.

**DT-11 — Accessible brand colours.**

| Token | Colour | Use |
|---|---|---|
| `--brand-blue` | `#174a7c` | Primary surfaces and links |
| `--brand-orange` | `#de7d28` | Decoration; any text on it must be dark `#1e293b` (4.9:1) |
| `--brand-orange-strong` | `#a9561a` | White-text CTA buttons (5.2:1) |
| `--brand-green` | `#529e3b` | Badges and icons |
| `--brand-green-strong` | `#3b7a29` | Green text (5.3:1) |
| `--text` | `#1e293b` | Body text |

**DT-12 — Upload limits.**

| File type | Limit |
|---|---|
| Images | ≤ 5 MB, resized on the client to ≤ 2048 px |
| PDF | ≤ 5 MB |
| Video | ≤ 50 MB and ≤ 90 seconds |

Récépissés and agréments are visible to moderators only.

**DT-28 — Framework versions.** Latest stable Next.js (App Router), React 19, TypeScript in strict mode, Node 20 LTS.

### Trust & safety

**DT-13 — Proof auto-flags.** A `"use node"` action checks each new dossier:

| Check | Flag raised when… |
|---|---|
| Duplicate image | Its dHash is within Hamming distance ≤ 6 of an image already published |
| Photo date | The EXIF date is missing, or earlier than the cause's creation date |
| Invoice reference | The same invoice ref from the same supplier was already used |
| Spend vs. received | The spend total differs from the net received by more than 5% |

Flags are advisory; the moderator decides.

**DT-19 — Rate limiting.** A small fixed-window limiter on a `rateLimits` table (`convex/lib/rateLimit.ts`), plus Convex Auth's own limit on failed sign-ins (30 per hour per account) and the per-number limits of `otpCodes` (DT-2). Limits are keyed per phone, email or account wherever possible: a single shared counter would let one script block everyone. The only global one is `SMS_DAILY_CAP` (DT-2), a cost guard. *(Rev. 3: replaces `@convex-dev/rate-limiter`, so the app has no Convex component yet; it can be swapped in later without changing callers.)* Calls to NabooPay must also stay under its limit of 100 requests per 60 s per endpoint, so the pending-payment poller works in batches.

**DT-26 — Blood alerts (DB-10).**
- Verified hospitals create, close and thank on their own alerts.
- Moderators see every alert and can close or disable one.
- The SMS fan-out runs through `notify.send`, batched to stay within the SMS provider's limits.

### Delivery

**DT-16 — Email.** Resend (`RESEND_API_KEY`, `EMAIL_FROM`), used for organisation password resets and organisation and moderation notifications.

**DT-23 — Testing & CI.**
- Vitest + `convex-test` for the backend: money invariants, status transitions, authz, release/refund/payout worker with a mocked NabooPay (409, timeout and `pending` cases included).
- Playwright e2e for the donation flow with the `mock` provider.
- GitHub Actions runs lint, typecheck, test and `npm audit` on every PR.

**DT-32 — Who creates and owns which account.**

| Account | Created and administered by | Owner / billing |
|---|---|---|
| Vercel, Convex, Resend | **JefTech** | Billed to **SUNUSOCIAL's card** (contract: the client pays the infrastructure directly) |
| NabooPay | **SUNUSOCIAL** (merchant account, KYB, API keys, webhook) | SUNUSOCIAL |
| SMS provider | SUNUSOCIAL (sender ID registration) | SUNUSOCIAL |
| Domain + DNS | SUNUSOCIAL | SUNUSOCIAL; JefTech gets DNS access |

- Keys are shared through a secrets manager, never by chat or plain email.
- Production secrets live only in the Vercel and Convex environments.
- The full checklist for SUNUSOCIAL is in `BOARD_QUESTIONS.md` part E.

**DT-29 — Before an SMS provider is chosen.** In development and preview, `SMS_PROVIDER=console`. Production cannot launch without a real provider (DB-7).

---

## 3. Config values

| Name | Value | Notes |
|---|---|---|
| `PAYMENT_PROVIDER` | `naboopay` (prod), `mock` (dev/preview) | |
| `SMS_PROVIDER` | `console` (dev/preview) → real provider | Waiting on the board: provider, budget, sender ID |
| `SMS_DAILY_CAP` | `1000` | Interim: codes per 24 h to signed-out people (DT-2), until the board sets the SMS budget |
| `MAX_CAUSE_DURATION_DAYS` | `30` | Decided (DB-11) |
| `MAX_EXTENSION_DAYS` | `30` | Technical cap per extension request |
| `PROOF_DUE_DAYS` | `7` | Decided (DB-12) |
| `MIN_DONATION` | `500` | Interim, to be studied with the board (DB-14) |
| `PLATFORM_FEE_RATE` | `0` | Waiting on the revenue model |
| `REQUIRE_PHASE2_BEFORE_PAYOUT` | `false` | Waiting on the phase 2 definition |
| `SESSION_TOTAL_DAYS` | `7` | Decided (DB-8) |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | *(unset)* | SUNUSOCIAL's official WhatsApp number, waiting on the board (`BOARD_QUESTIONS.md` part E). The WhatsApp buttons are hidden while it is unset |

*Removed since rev. 1:* `OTP_CHANNEL` (codes always go by SMS), `SMS_ENABLED`, `BLOOD_ALERTS_HOSPITAL_SELF_SERVE` (decided: hospitals), `ENFORCE_PROOF_DEADLINE_ON_RELEASE` (decided: always), `REFUND_FEE_POLICY` (decided: net).
