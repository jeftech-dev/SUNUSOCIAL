# SUNUSOCIAL — Technical Roadmap

A code-level map of the SUNUSOCIAL codebase for developers and AI coding agents, to read before writing code. Stack: **Next.js (App Router) + React + TypeScript + Convex**, deployed on Vercel. Amounts are integer **FCFA**.

---

## 1. Project File Structure

```text
sunusocial/
├── app/                              # Next.js App Router
│   ├── layout.tsx                    # root layout, Convex provider, fonts (Montserrat/Inter)
│   ├── page.tsx                      # 01 public landing
│   ├── (auth)/
│   │   ├── connexion/page.tsx        # 02 login (donor phone / org email)
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
│   └── moderation/                   # separate platform (own URL), own layout
│       ├── layout.tsx                # moderator-only guard
│       ├── page.tsx                  # Mod 01 login
│       ├── file/page.tsx             # Mod 02 queues
│       └── [resource]/[id]/page.tsx  # Mod 03–07 review screens
├── components/                       # shared presentational + interactive components
│   ├── cause/CauseCard.tsx
│   ├── cause/DonationModal.tsx       # presets, provider fee line, net, success state
│   ├── cause/ProgressBar.tsx
│   ├── proof/ProofGallery.tsx        # dossier viewer (photo/video/invoice/delivery note)
│   ├── blood/AlertCard.tsx
│   ├── common/VerifiedBadge.tsx
│   └── common/WhatsAppButton.tsx
├── convex/                           # backend: schema + functions
│   ├── schema.ts                     # all tables (see DATABASE_SCHEMA.md)
│   ├── auth.ts                       # register/login/session/blood profile
│   ├── causes.ts                     # list/get/create/update/withdraw/requestDeletion
│   ├── donations.ts                  # checkout/history/refund request
│   ├── payments.ts                   # provider webhook + release sweep (action/mutation)
│   ├── proofs.ts                     # submit/get/feed + auto-flag
│   ├── structures.ts                 # dashboard + profile
│   ├── blood.ts                      # alerts/responses/stock/thanks
│   ├── moderation.ts                 # queues + decisions
│   ├── geo.ts                        # regions/communes reference
│   └── crons.ts                      # scheduled: auto-release, proof-deadline suspend
├── lib/
│   ├── money.ts                      # fee/net math per provider; FCFA formatting
│   ├── providers/index.ts            # provider adapter selector (PAYMENT_PROVIDER)
│   ├── providers/naboopay.ts         # escrow/hold + refund
│   ├── providers/sycapay.ts          # direct payout, no escrow
│   ├── geo.ts                        # region→commune lists (14 regions in prod)
│   ├── strings.fr.ts                 # centralized French UI copy
│   └── authz.ts                      # client-side route-role helpers
├── hooks/
│   ├── useCauses.ts                  # feed + filters (live)
│   ├── useDonation.ts                # modal state + checkout
│   ├── useProofDossier.ts            # dossier viewer state
│   └── useBloodAlerts.ts             # donor/hospital alert views (live)
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
export type Provider = "naboopay" | "sycapay";
export type CauseStatus = "pending" | "active" | "closed" | "refused" | "deleted";
export type DonationStatus = "pending" | "held" | "released" | "refunded" | "failed";
export type BloodType = "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-" | "unknown";
export type EndType = "date" | "goal";

// Entities (one per DB table; Id<T> is Convex's branded id)
export interface User { _id: Id<"users">; role: Role; name: string; phone?: string; email?: string; structureId?: Id<"structures">; createdAt: number; }
export interface DonorProfile { _id: Id<"donorProfiles">; userId: Id<"users">; bloodOptIn: boolean; bloodType?: BloodType; region?: string; commune?: string; smsOptIn: boolean; updatedAt: number; }
export interface Structure { _id: Id<"structures">; name: string; type: string; region: string; commune: string; contactName: string; phone: string; email: string; receiptNo?: string; receiptFileId: Id<"_storage">; status: "pending" | "approved" | "refused"; refusalReason?: string; suspended: boolean; createdAt: number; }
export interface Cause { _id: Id<"causes">; structureId: Id<"structures">; title: string; description: string; category: Category; bannerFileId: Id<"_storage">; endType: EndType; goalAmount: number; deadline: number; urgency: Urgency; raised: number; donorCount: number; status: CauseStatus; refusalReason?: string; featured: boolean; fundsReleased: boolean; createdAt: number; }
export interface Donation { _id: Id<"donations">; causeId: Id<"causes">; donorId: Id<"users">; amount: number; fee: number; net: number; method: Method; provider: Provider; providerTxnId: string; status: DonationStatus; createdAt: number; }
export interface SpendLine { label: string; amount: number; }
export interface Proof { _id: Id<"proofs">; causeId: Id<"causes">; structureId: Id<"structures">; report: string; spend: SpendLine[]; status: "submitted" | "validated" | "escalated"; validatedAt?: number; dueAt?: number; createdAt: number; }
export interface ProofItem { _id: Id<"proofItems">; proofId: Id<"proofs">; kind: "photo" | "video" | "invoice" | "delivery_note"; fileId?: Id<"_storage">; caption?: string; supplier?: string; ref?: string; lines?: SpendLine[]; durationSec?: number; flagged: boolean; flagReason?: string; }
export interface RefundRequest { _id: Id<"refundRequests">; donationId: Id<"donations">; donorId: Id<"users">; reason: string; status: "pending" | "refunded" | "rejected"; decidedBy?: Id<"users">; createdAt: number; }
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
export interface FeeBreakdown { amount: number; provider: Provider; feeRate: number; fee: number; net: number; fundControl: "held" | "direct"; }
```

## 3. Function Signatures

```typescript
// convex/causes.ts
export const list: Query<{ category?: Category; filter?: "urgent" | "almost" | "recent"; query?: string; cursor?: string | null; limit: number }, PaginatedResponse<CauseCardView>>;
export const featured: Query<{}, CauseCardView | null>;
export const get: Query<{ id: Id<"causes"> }, CauseDetailView>;
export const mine: Query<{}, Cause[]>;                              // structure's own
export const create: Mutation<CreateCauseInput, { id: Id<"causes">; status: CauseStatus }>;
export const update: Mutation<UpdateCauseInput, { ok: true }>;
export const withdraw: Mutation<{ causeId: Id<"causes"> }, { ok: true }>;      // only while pending, no donations
export const requestDeletion: Mutation<{ causeId: Id<"causes">; reason: string }, { requestId: Id<"deletionRequests"> }>;
```

```typescript
// convex/donations.ts  (checkout is an action — external side effect)
export const createCheckout: Action<CreateDonationInput, { donationId: Id<"donations">; checkoutUrl: string } & FeeBreakdown>;
export const mine: Query<{ cursor?: string | null; limit: number }, PaginatedResponse<DonationHistoryView>>;
export const requestRefund: Mutation<{ donationId: Id<"donations">; reason: string }, { requestId: Id<"refundRequests"> }>; // NabooPay only
export const forCause: Query<{ causeId: Id<"causes"> }, { total: number; count: number }>;
```

```typescript
// convex/payments.ts
export const webhook: Action<{ providerTxnId: string; donationId: Id<"donations">; status: "succeeded" | "failed"; amount: number; signature: string }, { ok: boolean }>;
export const releaseDue: InternalMutation<{}, { released: number }>;            // cron: release at goal/deadline (NabooPay)
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
export const decideRefund: Mutation<{ requestId: Id<"refundRequests">; decision: "refunded" | "rejected" }, { ok: true }>;
```

```typescript
// convex/auth.ts
export const registerDonor: Mutation<{ name: string; phone: string; password: string; bloodProfile?: Partial<DonorProfile> }, { userId: Id<"users">; session: string }>;
export const registerOrganization: Mutation<{ organizationName: string; type: string; region: string; commune: string; responsiblePhone: string; email: string; password: string; receiptFileId: Id<"_storage"> }, { structureId: Id<"structures">; status: "pending" }>;
export const login: Mutation<{ identifier: string; password: string; twoFactorCode?: string }, { userId: Id<"users">; role: Role; session: string; twoFactorRequired: boolean }>;
export const me: Query<{}, { user: User; profile?: DonorProfile } | null>;
export const updateBloodProfile: Mutation<Partial<DonorProfile>, { ok: true }>;

// lib/auth guards (server helpers used inside functions)
export function requireRole(ctx: Ctx, role: Role): asserts ctx is AuthedCtx;
export function requireOwner(ctx: Ctx, structureId: Id<"structures">): void;
```

```typescript
// lib/money.ts
export const PROVIDER_RATE: Record<Provider, number>;                 // naboopay: 0.03, sycapay: 0.015
export function computeFee(amount: number, provider: Provider): FeeBreakdown;
export function formatFCFA(amount: number): string;                   // "4 500 FCFA"

// lib/providers/index.ts  (adapter interface, selected by PAYMENT_PROVIDER)
export interface PaymentProvider {
  createCheckout(input: { donationId: string; amount: number; method: Method }): Promise<{ checkoutUrl: string; providerTxnId: string }>;
  verifyWebhook(payload: unknown, signature: string): boolean;
  releaseFunds(causeId: string): Promise<void>;                       // no-op for sycapay
  refund(donationId: string): Promise<void>;                          // throws CONFLICT for sycapay
  readonly supportsEscrow: boolean;
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
  provider → HTTP webhook → convex action payments.webhook
        → lib/providers.verifyWebhook(signature)
        → dedupe on providerTxnId
        → mutation: donations.status = held|released; causes.raised += amount; donorCount bump
  ← live query causes.get pushes new progress → ProgressBar animates for all viewers
```

```text
Submit proof
  app/(structure)/structure/preuve/[causeId]/page.tsx  (useProofDossier)
    → add ≥ 5 items (upload to Convex _storage) + report + spend
  "Envoyer la preuve"                     → convex mutation proofs.submit
        → validate items ≥ 5, report ≥ 10 chars
        → run auto-flag (image similarity / metadata) → proofItems.flagged
        → insert proofs (status: submitted)
  ← appears in moderation.queues.proofs (live)
  moderator validates → proofs.status = validated
  ← proofs.publicFeed + donations.mine[].proof.available = true  (donor dashboard)
```

```text
Auto fund release (NabooPay)
  convex/crons.ts (hourly) → payments.releaseDue
    → query causes where status=active AND (raised ≥ goal OR now ≥ deadline) AND NOT fundsReleased
    → lib/providers.releaseFunds(causeId)   [no-op under sycapay]
    → causes.fundsReleased = true; status = closed; donations.status = released
```

```text
Blood alert
  (prototype) moderation OR hopital/alerte/page.tsx → blood.createAlert
    → match donorProfiles where bloodOptIn AND bloodType ∈ types AND commune ∈ targetCommunes
    → estimatedRecipients; send in-app + SMS
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
| `convex/auth.ts`, `causes.ts`, `donations.ts`, `payments.ts`, `proofs.ts`, `structures.ts`, `blood.ts`, `moderation.ts`, `geo.ts`, `crons.ts` | Backend functions |
| `lib/money.ts`, `lib/providers/{index,naboopay,sycapay}.ts` | Fee math + payment adapter |
| `lib/geo.ts`, `lib/strings.fr.ts`, `lib/authz.ts` | Reference data, French copy, guards |
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
| Active payment provider | Env `PAYMENT_PROVIDER` (+ prototype localStorage toggle) | `lib/providers` + server |
| Proof dossier draft | Local until submit | `useProofDossier` |
| Blood alerts | Convex (live) | `useBloodAlerts` |
| Moderation queues | Convex (live) | `moderation.queues` |

## 7. Build Order

1. **Repo + tooling** — scaffold Next.js (App Router, TS strict), add Convex, ESLint/Prettier, `.env.example`.
2. **Types** — `types.ts` (§2) and the Convex `schema.ts`; run `npx convex dev` to generate `_generated`.
3. **Reference data** — `lib/geo.ts` + `convex/geo.ts` seed (regions/communes); `lib/strings.fr.ts`; `lib/money.ts`.
4. **Auth** — `convex/auth.ts` (register/login/session/blood profile) + `lib/authz.ts` + auth pages.
5. **Causes read path** — `causes.list/get/featured` + feed and detail pages + `CauseCard`, `ProgressBar`, `VerifiedBadge`.
6. **Payment adapter** — `lib/providers/*`, `donations.createCheckout`, `payments.webhook`; `DonationModal` + success state.
7. **Structure path** — `causes.create/update/withdraw`, org dashboard + create-cause wizard; status timeline.
8. **Proofs** — `proofs.submit/get/feed` + auto-flag; `ProofGallery`; donor dashboard proof access.
9. **Moderation** — `moderation.*` + queues and review screens; separate layout + role guard.
10. **Deletions & refunds** — `requestDeletion`, `requestRefund`, `decideDeletion`, `decideRefund`; fund-fate logic.
11. **Fund release cron** — `crons.ts` + `payments.releaseDue`; proof-deadline suspension cron.
12. **Blood module** — `blood.*`, donor `/sang`, hospital dashboard/alert/thanks.
13. **Edge cases & polish** — empty/loading/error states, responsive pass at 375px, French copy review, accessibility focus states.
