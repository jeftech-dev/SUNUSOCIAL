# SUNUSOCIAL — Technical Roadmap

A code-level map of the SUNUSOCIAL codebase for developers and AI coding agents, to read before writing code. Stack: **Next.js (App Router) + React 19 + TypeScript + Convex (+ Convex Auth) + Tailwind CSS/shadcn/ui**, deployed on Vercel. Payments: **NabooPay** (funds held). Amounts are integer **FCFA**. Decisions referenced as `DB-*`/`DT-*` are in `DECISIONS.md`.

---

## 1. Project File Structure

```text
sunusocial/
├── app/                              # Next.js App Router
│   ├── layout.tsx                    # root layout, Convex Auth provider, fonts (Montserrat/Inter)
│   ├── globals.css                   # Tailwind + charte tokens (DT-10, DT-11)
│   ├── page.tsx                      # 01 public landing
│   ├── (auth)/
│   │   ├── connexion/page.tsx        # 02 login (donor phone / org email) + one-time code step
│   │   ├── mot-de-passe/page.tsx     # password reset (SMS code for donors / email link for orgs)
│   │   └── inscription/page.tsx      # 02 signup (donor / structure / hospital)
│   ├── (donor)/                      # donor-session route group
│   │   ├── causes/page.tsx           # 03 feed (categories, filters, featured)
│   │   ├── causes/[id]/page.tsx      # 04 cause detail (+ 05 donation modal)
│   │   ├── profil/page.tsx           # 06 donor dashboard (+ 06b proof dossier)
│   │   └── sang/page.tsx             # 07 blood module (+ 08 confirm visit)
│   ├── (structure)/
│   │   ├── structure/page.tsx        # 07 org dashboard
│   │   ├── structure/causes/nouvelle/page.tsx  # 08 create cause wizard
│   │   └── structure/preuve/[causeId]/page.tsx # 09 proof submission
│   ├── (hospital)/
│   │   ├── hopital/page.tsx          # 09 hospital dashboard + 09b stock
│   │   └── hopital/alerte/page.tsx   # 10 emit alert + 10b thank donors
│   └── moderation/                   # separate platform, served on moderation.<domain> (DT-9)
│       ├── layout.tsx                # moderator-only guard (MFA-verified)
│       ├── page.tsx                  # Mod 01 login
│       ├── file/page.tsx             # Mod 02 queues
│       ├── [resource]/[id]/page.tsx  # Mod 03–07 review screens
│       ├── coup-de-coeur/page.tsx    # pick the weekly featured cause (DB-6) — since Sprint 3
│       ├── prolongations/page.tsx    # extension + proof-delay requests (DT-30)
│       ├── versements/page.tsx       # payout queue, NabooPay balance, reconciliation (DT-4)
│       └── alertes/page.tsx          # oversee blood alerts (close/disable; DT-26)
├── proxy.ts                          # Next 16 proxy (ex-middleware): Convex Auth + moderation subdomain routing (DT-9)
├── components/                       # shared presentational + interactive components
│   ├── ui/                           # shadcn/ui primitives (generated, themed)
│   ├── cause/CauseCard.tsx
│   ├── cause/DonationModal.tsx       # presets, provider fee line, net, success state
│   ├── cause/ProgressBar.tsx
│   ├── proof/ProofGallery.tsx        # dossier viewer (photo/video/invoice/delivery note)
│   ├── blood/AlertCard.tsx
│   ├── common/VerifiedBadge.tsx
│   └── common/WhatsAppButton.tsx
├── convex/                           # backend: schema + functions
│   ├── schema.ts                     # all tables + ...authTables (see DATABASE_SCHEMA.md)
│   ├── auth.ts                       # Convex Auth config (Password provider) + register/blood profile
│   ├── auth.config.ts                # Convex Auth JWT config
│   ├── otp.ts                        # SMS codes: donor_signup | login_2fa | password_reset (DT-2)
│   ├── passwordReset.ts              # SMS-code (donors) + email-token (orgs) resets (DT-15)
│   ├── payouts.ts                    # single-flight payout worker + reconciliation (DT-4)
│   ├── extensions.ts                 # cause-deadline extensions + proof delays (DT-30)
│   ├── http.ts                       # httpRouter: auth routes + NabooPay webhook (DT-3)
│   ├── causes.ts                     # list/get/create/update/withdraw/requestDeletion
│   ├── donations.ts                  # checkout/history/refund request
│   ├── payments.ts                   # recordPayment, releaseCause, releaseDue, refunds
│   ├── proofs.ts                     # submit/get/feed
│   ├── proofChecks.ts                # "use node": dHash, EXIF, invoice-ref, spend checks (DT-13)
│   ├── structures.ts                 # dashboard + profile
│   ├── blood.ts                      # alerts/responses/stock/thanks
│   ├── moderation.ts                 # queues + decisions + setFeatured + payout verification
│   ├── notify.ts                     # in-app + email (+ SMS when enabled) (DT-17)
│   ├── audit.ts                      # append-only audit log helper (DT-18)
│   ├── admin.ts                      # internal: createModerator (DT-20)
│   ├── seed.ts                       # dev/preview seed data
│   ├── migrations.ts                 # @convex-dev/migrations backfills
│   ├── convex.config.ts              # components: rate-limiter, migrations
│   └── crons.ts                      # scheduled: deadline release (hourly), proof-deadline suspend, abandoned signup uploads (daily)
├── lib/
│   ├── money.ts                      # fee/net math (DT-6); FCFA formatting
│   ├── config.ts                     # typed access to product flags (DECISIONS.md §3)
│   ├── providers/index.ts            # provider adapter selector (PAYMENT_PROVIDER)
│   ├── providers/naboopay.ts         # API v2: transactions, X-Signature verify, payouts, balance
│   ├── sms/index.ts                  # SMS adapter selector (SMS_PROVIDER: console | provider)
│   ├── providers/mock.ts             # instant-success provider for dev/preview/e2e
│   ├── geo.ts                        # region→commune lists — single source, shared with Convex (DT-22)
│   ├── strings.fr.ts                 # centralized French UI copy
│   └── authz.ts                      # client-side route-role helpers
├── hooks/
│   ├── useCauses.ts                  # feed + filters (live)
│   ├── useDonation.ts                # modal state + checkout
│   ├── useProofDossier.ts            # dossier viewer state
│   └── useBloodAlerts.ts             # donor/hospital alert views (live)
├── tests/                            # Vitest (convex-test) unit + Playwright e2e (DT-23)
├── .github/workflows/ci.yml          # lint, typecheck, test, npm audit
├── public/                           # static assets (logos from design/)
├── .env.example
├── package.json
└── tsconfig.json                     # strict: true
```

## 2. Type Definitions

```typescript
// Shared enums
export type Role = "donor" | "structure" | "hospital" | "moderator";
export type Category = "Santé" | "Alimentation" | "Matériel";
export type Urgency = "normal" | "urgent";
export type Method = "orange_money" | "wave";
export type Provider = "naboopay" | "mock";
export type CauseStatus = "pending_review" | "active" | "refused" | "withdrawn" | "closed" | "deleted";
export type DonationStatus = "pending" | "held" | "released" | "refunded" | "failed";
export type BloodType = "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-" | "unknown";
export type EndType = "date" | "goal";

// Entities (one per DB table; Id<T> is Convex's branded id)
export interface User { _id: Id<"users">; role: Role; name: string; phone?: string; email?: string; structureId?: Id<"structures">; phoneVerifiedAt?: number; disabled: boolean; createdAt: number; }
export interface DonorProfile { _id: Id<"donorProfiles">; userId: Id<"users">; bloodOptIn: boolean; bloodType?: BloodType; region?: string; commune?: string; smsOptIn: boolean; updatedAt: number; }
export interface PayoutAccount { method: Method; accountNumber: string; holderName: string; phoneVerifiedAt: number; verifiedAt?: number; verifiedBy?: Id<"users">; }
export interface Structure { _id: Id<"structures">; name: string; type: string; region: string; commune: string; contactName: string; phone: string; email: string; receiptNo?: string; receiptFileId: Id<"_storage">; payout?: PayoutAccount /* structures only, not hospitals */; payoutPending?: PayoutAccount; status: "pending" | "approved" | "refused"; refusalReason?: string; suspendedAt?: number; onboardingPhase: 1 | 2; profileCompletedAt?: number; createdAt: number; }
export interface Cause { _id: Id<"causes">; structureId: Id<"structures">; title: string; description: string; category: Category; bannerFileId: Id<"_storage">; endType: EndType; goalAmount: number; deadline: number; urgency: Urgency; raised: number; donorCount: number; status: CauseStatus; refusalReason?: string; featuredAt?: number; submittedAt: number; approvedAt?: number; closedAt?: number; fundsReleasedAt?: number; payoutTxnId?: string; }
export interface Donation { _id: Id<"donations">; causeId: Id<"causes">; donorId: Id<"users">; amount: number; fee: number; platformFee: number; net: number; method: Method; provider: Provider; providerTxnId: string; status: DonationStatus; createdAt: number; }
export interface SpendLine { label: string; amount: number; }
export interface Proof { _id: Id<"proofs">; causeId: Id<"causes">; structureId: Id<"structures">; report: string; spend: SpendLine[]; status: "submitted" | "validated" | "escalated"; dossierFlags: string[]; validatedAt?: number; createdAt: number; }
export interface ProofDeadline { _id: Id<"proofDeadlines">; causeId: Id<"causes">; structureId: Id<"structures">; reason: "release" | "deletion_payout"; dueAt: number; enforced: boolean; metAt?: number; }
export interface PayoutJob { _id: Id<"payouts">; kind: "release" | "refund"; targetId: string; amount: number; method: Method; phone: string; name: string; status: "queued" | "sending" | "completed" | "pending_review" | "unknown" | "failed"; providerOrderId?: string; attempts: number; error?: string; createdAt: number; completedAt?: number; }
export interface ExtensionRequest { _id: Id<"extensionRequests">; kind: "cause_deadline" | "proof_deadline"; targetId: string; structureId: Id<"structures">; requestedUntil: number; reason: string; status: "pending" | "approved" | "refused"; moderatorReason?: string; decidedBy?: Id<"users">; createdAt: number; }
export interface Notification { _id: Id<"notifications">; userId: Id<"users">; kind: string; title: string; body: string; link?: string; readAt?: number; createdAt: number; }
export interface ProofItem { _id: Id<"proofItems">; proofId: Id<"proofs">; kind: "photo" | "video" | "invoice" | "delivery_note"; fileId?: Id<"_storage">; caption?: string; supplier?: string; ref?: string; lines?: SpendLine[]; durationSec?: number; phash?: string; exifTakenAt?: number; flagged: boolean; flagReason?: string; }
export interface RefundRequest { _id: Id<"refundRequests">; donationId: Id<"donations">; donorId: Id<"users">; reason: string; status: "pending" | "refunded" | "rejected"; refundAmount?: number; decidedBy?: Id<"users">; createdAt: number; }
export interface DeletionRequest { _id: Id<"deletionRequests">; causeId: Id<"causes">; structureReason: string; status: "pending" | "approved" | "maintained"; fundOutcome?: "refund" | "payout"; moderatorReason?: string; decidedBy?: Id<"users">; createdAt: number; }
export interface BloodAlert { _id: Id<"bloodAlerts">; hospitalId: Id<"structures">; bloodTypes: BloodType[]; level: string; unitsNeeded: number; unitsCollected: number; targetCommunes: string[]; estimatedRecipients: number; channels: { inApp: boolean; sms: boolean }; closed: boolean; thanksMessage?: string; createdBy: Id<"users">; createdAt: number; }
export interface BloodResponse { _id: Id<"bloodResponses">; alertId: Id<"bloodAlerts">; donorId: Id<"users">; bloodType: BloodType; commune: string; slot: string; donated: boolean; createdAt: number; }

// Input types
export interface CreateCauseInput { title: string; description: string; category: Category; bannerFileId: Id<"_storage">; endType: EndType; goalAmount: number; deadline: number; urgency: Urgency; }
export interface UpdateCauseInput extends Partial<CreateCauseInput> { causeId: Id<"causes">; }
export interface CreateDonationInput { causeId: Id<"causes">; amount: number; method: Method; }
export interface SubmitProofInput { causeId: Id<"causes">; report: string; items: Array<Omit<ProofItem, "_id" | "proofId" | "flagged" | "flagReason">>; spend: SpendLine[]; }
export interface CreateAlertInput { hospitalId: Id<"structures">; bloodTypes: BloodType[]; level: string; unitsNeeded: number; targetCommunes: string[]; channels: { inApp: boolean; sms: boolean }; }

// API wrapper types
export interface ApiError { code: "UNAUTHENTICATED" | "FORBIDDEN" | "VALIDATION" | "NOT_FOUND" | "CONFLICT" | "PAYMENT_FAILED" | "RATE_LIMITED"; message: string; field?: string | null; }
export type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: ApiError };
export interface PaginatedResponse<T> { page: T[]; isDone: boolean; continueCursor: string | null; }

// Derived view type used by the donation modal
export interface FeeBreakdown { amount: number; provider: Provider; feeRate: number; fee: number; platformFeeRate: number; platformFee: number; net: number; }
```

## 3. Function Signatures

```typescript
// convex/causes.ts
export const list: Query<{ category?: Category; filter?: "urgent" | "almost" | "recent"; query?: string; paginationOpts: PaginationOptions }, PaginationResult<CauseCardView>>; // DT-34
export const featured: Query<{}, CauseCardView | null>;
export const get: Query<{ id: string }, CauseDetailView | null>;    // null: unknown, malformed or not visible
export const mine: Query<{}, Cause[]>;                              // structure's own
export const create: Mutation<CreateCauseInput, { id: Id<"causes">; status: CauseStatus }>;
export const update: Mutation<UpdateCauseInput, { ok: true }>;
export const withdraw: Mutation<{ causeId: Id<"causes"> }, { ok: true }>;      // only while pending, no donations
export const requestDeletion: Mutation<{ causeId: Id<"causes">; reason: string }, { requestId: Id<"deletionRequests"> }>;

// convex/extensions.ts (DT-30)
export const request: Mutation<{ kind: "cause_deadline" | "proof_deadline"; targetId: string; requestedUntil: number; reason: string }, { requestId: Id<"extensionRequests"> }>;
```

```typescript
// convex/donations.ts  (checkout is an action — external side effect)
export const createCheckout: Action<CreateDonationInput, { donationId: Id<"donations">; checkoutUrl: string } & FeeBreakdown>;
export const mine: Query<{ cursor?: string | null; limit: number }, PaginatedResponse<DonationHistoryView>>;
export const requestRefund: Mutation<{ donationId: Id<"donations">; reason: string; receivingPhone?: string }, { requestId: Id<"refundRequests"> }>; // only while held; net amount
export const forCause: Query<{ causeId: Id<"causes"> }, { total: number; count: number }>;
```

```typescript
// convex/payments.ts
// convex/http.ts: POST /payments/naboopay/webhook → httpAction: verify signature, then:
export const recordPayment: InternalMutation<{ orderId: string; status: "paid" | "paid_and_blocked"; amount: number; fees: number; method: Method }, { ok: boolean; duplicate: boolean }>;
export const checkPending: InternalAction<{}, { checked: number; paid: number; cancelled: number }>;   // cron 10 min + success page
export const releaseCause: InternalAction<{ causeId: Id<"causes"> }, { released: boolean }>;   // goal reached (scheduled) or deadline (cron); one lump-sum payout; idempotent
export const releaseDue: InternalMutation<{}, { scheduled: number }>;           // hourly cron: schedules releaseCause for causes past deadline
// convex/payouts.ts — single-flight worker (@convex-dev/workpool, maxParallelism 1)
export const enqueue: InternalMutation<{ kind: "release" | "refund"; targetId: string; amount: number; method: Method; phone: string; name: string }, { payoutId: Id<"payouts"> }>;
export const reconcile: InternalAction<{ payoutId: Id<"payouts"> }, { status: string }>;     // after timeout/5xx — never resend blindly
export const dailyLedgerCheck: InternalAction<{}, { drift: number }>;
```

```typescript
// convex/proofs.ts
export const submit: Mutation<SubmitProofInput, { proofId: Id<"proofs">; autoFlagged: Array<{ index: number; reason: string }> }>;
export const get: Query<{ proofId: Id<"proofs"> }, ProofDossierView>;
export const publicFeed: Query<{ cursor?: string | null; limit: number }, PaginatedResponse<ProofFeedCard>>;  // public, no auth
export const mine: Query<{}, ProofFeedCard[]>;                                  // donor's accessible dossiers
```

```typescript
// convex/blood.ts
export const forDonor: Query<{ status: "open" | "all" }, BloodAlertDonorView[]>;
export const respond: Mutation<{ alertId: Id<"bloodAlerts">; slot: string }, { ok: true }>;
export const forHospital: Query<{}, BloodAlertHospitalView[]>;
export const createAlert: Mutation<CreateAlertInput, { id: Id<"bloodAlerts">; estimatedRecipients: number }>;
export const confirmDonation: Mutation<{ alertId: Id<"bloodAlerts">; responseId: Id<"bloodResponses"> }, { stockBefore: number; stockAfter: number }>;
export const closeAlert: Mutation<{ alertId: Id<"bloodAlerts"> }, { ok: true }>;
export const sendThanks: Mutation<{ alertId: Id<"bloodAlerts">; message: string }, { ok: true }>;
export const getStock: Query<{}, Array<{ bloodType: BloodType; units: number }>>;
export const updateStock: Mutation<{ entries: Array<{ bloodType: BloodType; units: number }> }, { ok: true }>;
```

```typescript
// convex/moderation.ts  (all require moderator role)
export const queues: Query<{}, ModerationQueues>;
export const decideStructure: Mutation<{ structureId: Id<"structures">; decision: "approve" | "refuse"; reason?: string }, { ok: true }>;
export const decideCause: Mutation<{ causeId: Id<"causes">; decision: "approve" | "refuse"; reason?: string }, { ok: true }>;
export const decideProof: Mutation<{ proofId: Id<"proofs">; decision: "validate" | "escalate" }, { ok: true }>;
export const decideDeletion: Mutation<{ requestId: Id<"deletionRequests">; decision: "approve" | "maintain"; reason: string; fundOutcome?: "refund" | "payout" }, { ok: true }>;
export const decideRefund: Mutation<{ requestId: Id<"refundRequests">; decision: "refunded" | "rejected" }, { ok: true; refundAmount?: number }>;
export const decidePayoutAccount: Mutation<{ structureId: Id<"structures">; decision: "approve" | "refuse"; reason?: string }, { ok: true }>;
export const setFeatured: Mutation<{ causeId: Id<"causes"> | null }, { ok: true; message: string }>; // DB-6; null clears
export const featuredCandidates: Query<{}, FeaturedCandidate[]>;                                    // picker
export const liftSuspension: Mutation<{ structureId: Id<"structures">; reason: string }, { ok: true }>;
export const decideExtension: Mutation<{ requestId: Id<"extensionRequests">; decision: "approve" | "refuse"; reason?: string }, { ok: true; newDate?: number }>;
export const closeAlert: Mutation<{ alertId: Id<"bloodAlerts">; reason: string }, { ok: true }>;
```

```typescript
// convex/auth.ts — Convex Auth (DT-1). Sign-in uses the library's signIn("password", …) flow;
// these are the app-specific mutations around it.
export const { auth, signIn, signOut, store } = convexAuth({ providers: [Password({ profile: /* phone for donors, email for orgs */ })] });
export const registerDonor: Mutation<{ name: string; phone: string; password: string; otpCode: string; bloodProfile?: Partial<DonorProfile> }, { userId: Id<"users"> }>; // phone verified by SMS code
export const registerOrganization: Action<{ organizationName: string; type: string; region: string; commune: string; responsiblePhone: string; email: string; password: string; receiptFileId: Id<"_storage"> /* from POST /signup/receipt */; contactOtpCode: string /* org_contact, DT-33 */; payout?: { method: Method; accountNumber: string; holderName: string; otpCode?: string /* unless accountNumber = responsiblePhone */ } /* required unless type = hospital */ }, { structureId: Id<"structures">; status: "pending" }>;
export const me: Query<{}, { user: User; profile?: DonorProfile; mfaRequired: boolean } | null>;
export const updateBloodProfile: Mutation<Partial<DonorProfile>, { ok: true }>;

// convex/otp.ts (DT-2) — always SMS
export const send: Action<{ purpose: "donor_signup" | "org_contact" | "login_2fa" | "password_reset" | "payout_number"; phone?: string }, { expiresAt: number }>;
export const verifyLogin: Mutation<{ code: string }, { ok: true }>;   // sets authSessions.mfaVerifiedAt

// convex/passwordReset.ts (DT-15)
export const resetWithSmsCode: Mutation<{ phone: string; code: string; newPassword: string }, { ok: true }>; // donors
export const requestEmailReset: Action<{ email: string }, { ok: true }>;  // orgs; always ok (no account enumeration)
export const resetWithToken: Mutation<{ token: string; newPassword: string }, { ok: true }>;

// convex/structures.ts
export const requestPayoutChange: Mutation<{ payout?: { method: Method; accountNumber: string; holderName: string; otpCode: string } /* required unless type = hospital */ }, { ok: true }>; // → payoutPending, payouts blocked

// convex/lib/guards.ts (server helpers used inside functions)
export async function requireRole(ctx: Ctx, ...roles: Role[]): Promise<AuthedUser>;   // also checks disabled and MFA for org/hospital/moderator; sessions ≤ 7 days via Convex Auth
export async function requireOwner(ctx: Ctx, structureId: Id<"structures">): Promise<void>;
```

```typescript
// lib/money.ts
export const PROVIDER_RATE: Record<Provider, number>;                 // naboopay: 0.03 (estimate — the stored fee is NabooPay's actual `fees`), mock: 0.03
export function computeFee(amount: number, provider: Provider, platformFeeRate?: number): FeeBreakdown; // fee = Math.round(amount*rate); fee + platformFee + net === amount
export function formatFCFA(amount: number): string;                   // "4 500 FCFA"

// lib/providers/index.ts  (adapter interface, selected by PAYMENT_PROVIDER)
export interface PaymentProvider {
  createCheckout(input: { donationId: string; amount: number; method: Method }): Promise<{ checkoutUrl: string; providerTxnId: string }>;
  verifyWebhook(payload: unknown, signature: string): boolean;
  getTransaction(orderId: string): Promise<{ status: "pending" | "paid" | "paid_and_blocked" | "cancelled" | "refunded"; amount: number; fees: number; method?: Method }>;
  cancelTransaction(orderId: string): Promise<void>;                  // unpaid > 2 h
  payout(input: { method: Method; amount: number; phone: string; name: string; reason: string }): Promise<{ orderId: string; status: "completed" | "pending" | "failed" }>; // NEVER auto-retried on timeout/5xx
  getPayout(orderId: string): Promise<{ status: "pending" | "completed" | "failed" | "cancelled" }>;
  listPayouts(filter: { recipientPhone: string; since: number }): Promise<Array<{ orderId: string; amount: number; status: string }>>; // reconciliation
  getBalance(): Promise<number>;                                      // "main" account
}
```

```typescript
// hooks/useDonation.ts
export function useDonation(cause: CauseDetailView): {
  amount: number; setAmount: (n: number) => void;
  method: Method; setMethod: (m: Method) => void;
  breakdown: FeeBreakdown;            // live fee + net
  confirm: () => Promise<void>;       // calls donations.createCheckout → redirect
  state: "idle" | "loading" | "success" | "error";
};
```

## 4. Exact Data Flow

```text
Donate (core loop)
  components/cause/CauseCard "Voir plus"  → app/(donor)/causes/[id]/page.tsx
  page uses useCauses + causes.get (live)
  "Faire un don"                          → opens DonationModal
  DonationModal uses useDonation
    → lib/money.computeFee(amount, provider)   [live fee line + net, client preview]
  "Confirmer le don"                      → useDonation.confirm()
    → convex action donations.createCheckout
        → lib/money.computeFee (authoritative, server)
        → lib/providers.createCheckout()       [Orange Money / Wave]
        → insert donations row (status: pending)
    ← { checkoutUrl }                     → browser redirects to provider
  NabooPay → POST /payments/naboopay/webhook (convex/http.ts httpAction)
        → lib/providers.verifyWebhook(signature)
        → internal mutation payments.recordPayment
            → dedupe on providerTxnId
            → donations.status = held; causes.raised += amount; donorCount bump on first gift
            → if raised ≥ goal: scheduler.runAfter(0, payments.releaseCause)
            → notify donor (donation_confirmed)
  ← live query causes.get pushes new progress → ProgressBar animates for all viewers
```

```text
Submit proof
  app/(structure)/structure/preuve/[causeId]/page.tsx  (useProofDossier)
    → add ≥ 5 items (upload to Convex _storage) + report + spend
  "Envoyer la preuve"                     → convex mutation proofs.submit
        → validate items ≥ 5, report ≥ 10 chars
        → insert proofs (status: submitted)
        → scheduler → proofChecks.run ("use node": dHash, EXIF, invoice ref, spend vs net) → proofItems.flagged
  ← appears in moderation.queues.proofs (live)
  moderator validates → proofs.status = validated
  ← proofs.publicFeed + donations.mine[].proof.available = true  (donor dashboard)
```

```text
Fund release (DB-4, DB-5)
  goal reached → payments.recordPayment schedules payments.releaseCause immediately
  convex/crons.ts (hourly) → payments.releaseDue
    → causes where status=active AND now ≥ deadline → schedule releaseCause
  payments.releaseCause
    → skip if fundsReleasedAt set, or structure.payoutPending set (payout blocked)
    → insert payouts row { kind: release, amount: Σ net of held donations, verified OM/Wave account }   [one transfer]
    → payout worker (maxParallelism 1): balance check → providers.payout → completed | pending_review | unknown→reconcile
    → causes.fundsReleasedAt, payoutTxnId, status = closed; donations.status = released
    → insert proofDeadlines (reason: release, dueAt +7 d, enforced per flag); auditLog funds.release
```

```text
Blood alert
  hopital/alerte → blood.createAlert   (moderators oversee via moderation/alertes)
    → match donorProfiles where bloodOptIn AND bloodType ∈ types AND commune ∈ targetCommunes
    → estimatedRecipients; notify.send in-app + SMS (batched)
  donor app/(donor)/sang/page.tsx (useBloodAlerts) sees matching alert
    → "Je peux donner" → blood.respond(slot)
  hospital confirms attendee → blood.confirmDonation
    → bloodResponses.donated = true; bloodStock.units += 1; alert.unitsCollected += 1
  on close → blood.sendThanks(message) → confirmed donors notified
```

## 5. Files to Create vs. Modify

### Create from scratch
| File | Purpose |
|------|---------|
| `convex/schema.ts` | All tables + indexes (DATABASE_SCHEMA.md) |
| `convex/{auth,mfa,passwordReset,http,causes,donations,payments,proofs,proofChecks,structures,blood,moderation,notify,audit,admin,seed,migrations,crons}.ts` | Backend functions |
| `lib/money.ts`, `lib/config.ts`, `lib/providers/{index,naboopay,mock}.ts` | Fee math, flags, payment adapter |
| `lib/geo.ts`, `lib/strings.fr.ts`, `lib/authz.ts` | Reference data, French copy, client route helpers |
| `middleware.ts` | Host-based routing for the moderation subdomain |
| `tests/**`, `.github/workflows/ci.yml` | Tests and CI |
| `components/cause/*`, `components/proof/*`, `components/blood/*`, `components/common/*` | UI, ported from the prototype screens |
| `hooks/useCauses.ts`, `useDonation.ts`, `useProofDossier.ts`, `useBloodAlerts.ts` | Client data hooks |
| `app/**` pages | All screens (see §1) |
| `.env.example` | Env template (created in repo setup) |

### Modify existing
| File | What to change |
|------|----------------|
| `prototype/*.dc.html` | Reference only — do not edit; port markup/logic into `app/` + `components/` |
| `netlify.toml` (now under `prototype/`) | Keep for the prototype deploy; production deploy is Vercel, configured separately |
| `README.md` | Update install steps once the Next.js app is scaffolded |
| `package.json` | Add scripts (`dev`, `lint`, `typecheck`), Convex + Next deps |

## 6. Component Interaction Map

```text
app/(donor)/causes/[id]/page.tsx
  └─ useCauses / causes.get (live)
  ├─ <VerifiedBadge/>
  ├─ <ProgressBar/>                 (reads cause.raised/goal)
  ├─ <WhatsAppButton/>
  └─ <DonationModal/>               ← opened by "Faire un don"
       └─ useDonation
            ├─ lib/money.computeFee  (live fee/net preview)
            └─ donations.createCheckout (action) → redirect

app/(structure)/structure/preuve/[causeId]/page.tsx
  └─ useProofDossier
       ├─ upload items to _storage
       └─ proofs.submit → auto-flag

app/moderation/[resource]/[id]/page.tsx
  └─ moderation.queues (live)
       ├─ <ProofGallery/>           (same dossier donors see)
       └─ moderation.decide* (reason required on refuse)
```

**State ownership**
| State | Lives in | Shared via |
|-------|----------|------------|
| Session / role | Convex session + `auth.me` | `useAuth` context at root layout |
| Cause feed + filters | Convex (live) | `useCauses` |
| Cause progress (`raised`) | Convex `causes` (denormalized) | live query → `ProgressBar` |
| Donation modal (amount, method, fee) | Local component state | `useDonation` |
| Active payment provider | Env `PAYMENT_PROVIDER` (`naboopay` \| `mock`) | `lib/providers` (server only) |
| Product flags | Env (DECISIONS.md §3) | `lib/config.ts` |
| Proof dossier draft | Local until submit | `useProofDossier` |
| Blood alerts | Convex (live) | `useBloodAlerts` |
| Moderation queues | Convex (live) | `moderation.queues` |

## 7. Build Order

1. **Repo + tooling** — scaffold Next.js (App Router, TS strict), Tailwind + shadcn/ui with charte tokens, Convex, ESLint/Prettier, Vitest, CI workflow.
2. **Types** — `types.ts` (§2) and the Convex `schema.ts` (with `authTables`); run `npx convex dev` to generate `_generated`.
3. **Reference data** — `lib/geo.ts`, `lib/strings.fr.ts`, `lib/money.ts` (+ invariant tests), `lib/config.ts`, `convex/seed.ts`.
4. **Auth** — Convex Auth, `mfa.ts`, `passwordReset.ts`, guards, `middleware.ts` (moderation subdomain), auth pages, `admin.createModerator`.
5. **Causes read path** — `causes.list/get/featured` + feed and detail pages + `CauseCard`, `ProgressBar`, `VerifiedBadge`.
6. **Payment adapter** — NabooPay sandbox check against `.claude/skills/naboopay` (keys/scopes, escrow question, payout limits); `lib/providers/{naboopay,mock}`, `donations.createCheckout`, `http.ts` webhook + `payments.recordPayment`; `DonationModal` + success state.
7. **Structure path** — `causes.create/update/withdraw`, org dashboard + create-cause wizard; status timeline.
8. **Proofs** — `proofs.submit/get/feed` + `proofChecks`; `ProofGallery`; donor dashboard proof access.
9. **Moderation** — `moderation.*` + queues, review screens, payout verification, Coup de cœur picker (shipped early, in Sprint 3), audit log, notifications.
10. **Deletions, refunds, payouts, extensions** — `requestDeletion`, `requestRefund`, `decideDeletion`, `decideRefund`; payout worker + reconciliation; extension requests.
11. **Fund release** — `payments.releaseCause` (goal) + `crons.ts`/`releaseDue` (deadline); proof-deadline suspension cron.
12. **Blood module** — `blood.*`, donor `/sang`, hospital dashboard/alert/thanks.
13. **Edge cases & polish** — empty/loading/error states, responsive pass at 375px, French copy review, accessibility focus states, Playwright e2e on the donate flow.
