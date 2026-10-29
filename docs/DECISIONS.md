# SUNUSOCIAL — Decision Log

| | |
|---|---|
| **Last Updated** | 29 October 2026 |
| **Status** | Authoritative. If another document disagrees with this log, this log is correct and the other document is a bug |

Two kinds of decisions are recorded here:

- **Board decisions (`DB-*`)**: made by SUNUSOCIAL and passed on by the project owner.
- **Technical decisions (`DT-*`)**: made by JefTech to close gaps found in `PROJECT_REVIEW.md`.

Product questions that are still open are listed in `BOARD_QUESTIONS.md` (in French, for the board). Until the board answers one, the code uses the **interim default** given for it below. Each default is a single config value, so changing it later doesn't require a refactor.

---

## 1. Board decisions

| ID | Decision | Consequences for the build |
|---|---|---|
| **DB-1** | **NabooPay is the payment provider** (3% fee, Orange Money + Wave, no card). SycaPay is dropped | One real provider adapter (`naboopay`) plus a `mock` adapter for local work and tests. Every "SycaPay branch" (refund hidden, deletion refund disabled, `fundControl: direct`) is removed |
| **DB-2** | **Funds are held** (escrow) until the cause's release condition is met | Donations go `pending → held → released` (or `refunded`). Refund requests and deletion refunds are always possible while funds are held |
| **DB-3** | **Structures are verified from documents only.** The moderator approves or refuses each one (no physical visit) | One validation step in the `Structures à valider` queue. The moderator checks the récépissé/agrément **and the payout account** (DT-5). The "Vérifié" badge means "documents approved by a moderator" |
| **DB-4** | **Lump-sum payout.** At release, everything held for the cause is paid out in one transfer | `releaseFunds(causeId)` makes a single payout per cause. No partial or staged payouts |
| **DB-5** | **Every cause has a deadline**, including causes with a monetary goal, so money is never held too long. Release happens at the goal **or** the deadline, whichever comes first; at the deadline everything collected is released, even if the goal wasn't reached | `causes.deadline` is required for every cause. Reaching the goal closes the cause and releases funds immediately (DT-24). The maximum allowed duration is still open (`BOARD_QUESTIONS.md` Q5); interim default `MAX_CAUSE_DURATION_DAYS = 90` |
| **DB-6** | **The moderator curates the "Coup de cœur de la semaine"** | New mutation `moderation.setFeatured(causeId)`, with a control in the moderation console. Only one active cause can be featured at a time; setting a new one clears the old one. The feed shows nothing in that slot when no cause is featured |

**Superseded:** every `[OPEN]` / `[HYPOTHESIS]` marker about the provider, fund control, verification depth, payout cadence, deadline-based release and featured curation in `context.md`, `PRD.md` and `ARCHITECTURE.md`.

---

## 2. Technical decisions

### Authentication & accounts

**DT-1 — Auth library: Convex Auth.**
- Use `@convex-dev/auth` with the Password provider rather than hand-rolled sessions.
- Donors sign in with their **phone number in E.164 format** as the account identifier.
- Structures, hospitals and moderators sign in with their **email**.
- The library hashes passwords (Scrypt) and manages sessions (JWT + refresh token). The env vars are `JWT_PRIVATE_KEY` and `JWKS`, set in Convex. `AUTH_SECRET` is removed.
- The `role` stays on `users` and is read server-side only.

**DT-2 — Second factor for structures, hospitals and moderators.**
- After the password is accepted, the server sends a 6-digit one-time code. Only a hash of the code is stored, in `twoFactorCodes`; it expires after 10 minutes and allows at most 5 attempts.
- The session is marked `mfaVerifiedAt` once the code is accepted. `requireRole()` rejects these roles until that is set.
- **Channel:** codes are sent by **email (Resend)** until the board approves SMS. After that, they go by SMS to the responsible person's phone.
- Switching channels means changing `OTP_CHANNEL=email|sms`. No code changes.

**DT-15 — Password reset.**
- **Structures, hospitals, moderators:** a reset link by email (single use, valid 30 minutes).
- **Donors, until SMS is approved:** reset is assisted by staff. The donor contacts SUNUSOCIAL on WhatsApp. A moderator checks their identity (name plus the amount of a recent donation), then generates a single-use reset link valid 30 minutes from the console. The link is sent back on WhatsApp, and the action is written to the audit log.
- **Donors, once SMS is approved:** self-service reset with an SMS code.
- The "Mot de passe oublié ?" link points to the right flow depending on `OTP_CHANNEL`.

**DT-20 — The first moderator account.**
- Created with an internal mutation, `admin.createModerator`, run by the lead developer through `npx convex run`.
- There is no public signup for moderators, and no role selector.

**DT-27 — Session lifetime.**
- Convex Auth defaults: 7-day total lifetime, refresh tokens with inactivity expiry.
- The moderation guard also rejects any moderator session older than 12 hours.

### Payments

**DT-3 — Payment webhook.**
- A Convex **`httpAction`** at `POST /payments/naboopay/webhook`, declared in `convex/http.ts`. There is no Next.js proxy route.
- It verifies the signature with `NABOOPAY_WEBHOOK_SECRET`, then calls the internal mutation `payments.recordPayment`.
- The mutation dedupes on `providerTxnId` (unique index).
- **Sprint 4 spike:** confirm NabooPay's real signature scheme, its escrow/hold API, how payouts are made, and its refund API against their documentation before writing the adapter. JefTech raises any gap directly with NabooPay.

**DT-4 — Provider adapter.**
- The `PaymentProvider` interface is kept: `createCheckout`, `verifyWebhook`, `releaseFunds`, `refund`.
- Implementations: `naboopay` and `mock`. The mock completes payments instantly and is used in development, preview deploys and e2e tests.
- Selected with `PAYMENT_PROVIDER=naboopay|mock`. Production refuses to start with `mock`.

**DT-5 — Where each structure gets paid.** New field `structures.payout`:

| Field | Meaning |
|---|---|
| `method` | `orange_money` \| `wave` |
| `accountNumber` | E.164 |
| `holderName` | Name on the account |
| `naboopayRecipientId?` | The structure's recipient id at NabooPay |
| `verifiedAt?` | When a moderator approved this account |
| `verifiedBy?` | Which moderator approved it |

- The account is collected at signup. The moderator checks it together with the documents (DB-3); a structure can't publish until the account is verified.
- **Changing the payout account sends it back to moderator review.** Payouts are blocked until it is re-approved, and the change is written to the audit log. This guards against account takeovers that redirect funds.
- Whether the account must be in the structure's own name is still open (`BOARD_QUESTIONS.md` Q9). Interim default: the responsible person's name is accepted.

**DT-6 — Money arithmetic.**

| Rule | Value |
|---|---|
| Units | Integer FCFA everywhere |
| Fee | `fee = Math.round(amount × 0.03)` |
| Platform fee | `platformFee = 0`. This is a separate line kept for the revenue-model decision (`BOARD_QUESTIONS.md` Q3) |
| Net to structure | `net = amount − fee − platformFee` |
| Invariant | `fee + platformFee + net = amount`, enforced by a unit test |

- `causes.raised` holds the **gross** amount. The progress bar and the goal check both use gross.
- The create-cause wizard and the cause page show an estimated net ("≈ X FCFA reçus par la structure").
- `donorCount` goes up only on a donor's first confirmed donation to that cause, checked with the index `donations_by_cause_donor`.
- Minimum donation: interim `MIN_DONATION = 500` (the smallest preset), see `BOARD_QUESTIONS.md` Q8.

**DT-7 — Refunds.**
- The money returned and the fees follow `REFUND_FEE_POLICY`, which is open (`BOARD_QUESTIONS.md` Q7). Interim default: the donor gets back the **net** amount, because the provider fee has already been charged.
- The moderation screen shows exactly how much will be refunded.

**DT-24 — When funds are released.**
- **At the goal:** when `raised ≥ goal`, `payments.recordPayment` schedules `payments.releaseCause` straight away (`ctx.scheduler.runAfter(0, …)`). The cause becomes `closed` and accepts no more donations.
- **At the deadline:** an hourly cron, `payments.releaseDue`, releases causes whose deadline has passed.
- **Overshoot:** a donation that pushes `raised` past the goal is accepted in full.
- Release is idempotent: it is guarded by `fundsReleasedAt`.

### Data model

**DT-8 — Cause lifecycle.** `status` takes these values:

| Status | Label shown | Notes |
|---|---|---|
| `pending_review` | "En modération" | The "Soumise" step on the timeline is the `createdAt` date |
| `active` | "Active" | |
| `refused` | "Refusée" | Shows the refusal reason |
| `withdrawn` | — | Withdrawn by the structure while in review; no donations possible |
| `closed` | "Clôturée" | Funds released |
| `deleted` | — | Deletion approved by a moderator |

New timestamps: `submittedAt`, `approvedAt`, `closedAt`, `fundsReleasedAt`.

**DT-17 — In-app notifications.**
- A `notifications` table: `userId`, `kind`, `title`, `body`, `link`, `readAt`, `createdAt`.
- The internal action `notify.send` writes the in-app row, then sends email or SMS according to the user's role, their preferences, and the SMS flag.

**DT-18 — Audit log.**
- An `auditLog` table: `actorId`, `action`, `targetTable`, `targetId`, `details`, `createdAt`.
- Written on every moderation decision, every payout and refund, every payout-account change, and every assisted password reset.
- Rows are never edited or deleted.

**DT-21 — Migrations.**
- Schema changes are deployed by `npx convex deploy`.
- Data backfills use `@convex-dev/migrations`.
- Seeds are internal mutations under `convex/seed.ts`.
- There are no numbered migration files.

**DT-22 — Regions and communes.**
- One static source of truth: `lib/geo.ts`, imported by both Next.js and Convex. The `geo` table is removed.
- Interim data is the prototype's 8 regions. The official list of all 14 is still open (`BOARD_QUESTIONS.md` Q4).

**DT-25 — Proof deadline after release.**
- The schema stores `proofs.dueAt` for every released cause.
- Auto-suspension is enforced for **deletion payouts** (already decided).
- For causes that were funded normally, it is behind the flag `ENFORCE_PROOF_DEADLINE_ON_RELEASE` (default `false`) until the board answers `BOARD_QUESTIONS.md` Q6.

### Frontend & design

**DT-9 — Moderation runs on its own subdomain.**
- Same Next.js app, served at `moderation.<domain>`. `middleware.ts` routes by host:
  - The moderation host only serves the `app/moderation` route group.
  - The main host returns 404 for `/moderation/*`.
- Locally: `http://moderation.localhost:3000`.
- Auth cookies are scoped to each host, so a donor or structure session can never reach moderation.

**DT-10 — Styling stack.**
- **Tailwind CSS + shadcn/ui** (Radix primitives), themed with the charte's tokens.
- **The charte graphique wins:** Montserrat for headings, Inter for body text, the charte palette, and the charte's logo rules.
- The `prototype/_ds` "Industry" package is reference material only. Its Barlow fonts, steel accent, blueprint corner marks and duotone images are **not** used.

**DT-11 — Accessible brand colours.**

| Token | Colour | Use |
|---|---|---|
| `--brand-blue` | `#174a7c` | Primary surfaces and links |
| `--brand-orange` | `#de7d28` | Decoration, icons, illustration; text on it must be dark `#1e293b` (4.9:1) |
| `--brand-orange-strong` | `#a9561a` | Orange CTA buttons with white text (5.2:1 on white, 4.9:1 on the cream `#faf7f2` background) |
| `--brand-green` | `#529e3b` | Badges and icons |
| `--brand-green-strong` | `#3b7a29` | Green text (5.3:1) |
| `--text` | `#1e293b` | Body text |

Every new colour pair is checked with the `contrast-checker` skill.

**DT-12 — Upload limits.**

| File type | Limit |
|---|---|
| Images | ≤ 5 MB, resized on the client to at most 2048 px on the longest side before upload |
| PDF | ≤ 5 MB |
| Video (proof dossiers only) | ≤ 50 MB and ≤ 90 seconds |

- Files go to Convex storage through upload URLs.
- File URLs are only returned by queries that have checked the caller's access.
- Récépissés/agréments are visible **only to moderators**.

**DT-28 — Framework versions.** Latest stable Next.js (App Router), React 19, TypeScript in strict mode, Node 20 LTS.

### Trust & safety

**DT-13 — Auto-flagging proofs (MVP).** A `"use node"` action runs on every submitted dossier. Each check flags an item, or the whole dossier, with a reason in French:

| Check | Flag raised when… |
|---|---|
| **Duplicate image** | A 64-bit perceptual hash (dHash, computed with `sharp`) is within Hamming distance ≤ 6 of any image already published, on any cause |
| **Photo date** | The EXIF `DateTimeOriginal` is missing, or earlier than the cause's `createdAt` |
| **Invoice reference** | The same invoice or delivery-note `ref` from the same supplier was already used in another dossier |
| **Spend vs. received** | The spend total differs from the net received by more than 5% (whole dossier) |

- Videos are not analysed in the MVP.
- Flags are advisory. The moderator decides.

**DT-19 — Rate limiting.** Done with `@convex-dev/rate-limiter`, at the limits in `API_DESIGN.md`.

**DT-26 — Who creates blood alerts.**
- `bloodAlerts.create` accepts moderators. It accepts hospitals only when `BLOOD_ALERTS_HOSPITAL_SELF_SERVE=true` (default `false`) until the board answers `BOARD_QUESTIONS.md` Q2.
- Both screens get built: the moderation form and the hospital `/hopital/alerte` page.

### Delivery

**DT-16 — Email.**
- Provider: **Resend**.
- Env vars: `RESEND_API_KEY`, `EMAIL_FROM` (on SUNUSOCIAL's own domain).
- Used for: 2FA codes until SMS is approved, password resets for organisations, and organisation and moderation notifications.

**DT-23 — Testing & CI.**
- **Tests:** Vitest + `convex-test` for backend logic (money invariants, status transitions, authz, release and refund paths), and Playwright e2e for the main donation flow using the `mock` provider.
- **CI:** GitHub Actions runs `lint`, `typecheck`, `test` and `npm audit --audit-level=high` on every PR into `develop`/`main`.

**DT-29 — The "SMS pending" preview.**
- While `SMS_ENABLED=false`, any screen that would send an SMS shows the in-app notification plus an SMS preview labelled "en attente de validation" (the same behaviour as the prototype).

---

## 3. Feature flags and config introduced by this log

| Name | Default | Changes when… |
|---|---|---|
| `PAYMENT_PROVIDER` | `naboopay` (prod), `mock` (dev/preview) | — |
| `OTP_CHANNEL` | `email` | Board approves SMS → `sms` |
| `SMS_ENABLED` | `false` | Board approves SMS |
| `BLOOD_ALERTS_HOSPITAL_SELF_SERVE` | `false` | Board answers Q2 |
| `ENFORCE_PROOF_DEADLINE_ON_RELEASE` | `false` | Board answers Q6 |
| `MAX_CAUSE_DURATION_DAYS` | `90` | Board answers Q5 |
| `MIN_DONATION` | `500` | Board answers Q8 |
| `PLATFORM_FEE_RATE` | `0` | Board answers Q3 |
| `REFUND_FEE_POLICY` | `refund_net` | Board answers Q7 |
