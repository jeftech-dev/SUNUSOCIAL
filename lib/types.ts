// Shared types for Next.js and Convex.
//
// Enumerations are declared once as `as const` arrays: `convex/schema.ts` builds its validators
// from them and the UI iterates them, so the two can never drift. Entity types are derived from
// the schema (`Doc<"table">`) instead of being re-declared by hand.
// Spec: docs/TECHNICAL_ROADMAP.md §2, docs/DATABASE_SCHEMA.md.

import type { Doc, Id } from "../convex/_generated/dataModel";

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

export const ROLES = ["donor", "structure", "hospital", "moderator"] as const;
export type Role = (typeof ROLES)[number];

export const CATEGORIES = ["Santé", "Alimentation", "Matériel"] as const;
export type Category = (typeof CATEGORIES)[number];

export const URGENCIES = ["normal", "urgent"] as const;
export type Urgency = (typeof URGENCIES)[number];

/** Mobile-money methods. No card (DB-1). */
export const METHODS = ["orange_money", "wave"] as const;
export type Method = (typeof METHODS)[number];

/** Payment providers. `mock` is refused in production (DT-4). */
export const PROVIDERS = ["naboopay", "mock"] as const;
export type Provider = (typeof PROVIDERS)[number];

/** Cause lifecycle (DT-8). */
export const CAUSE_STATUSES = [
  "pending_review",
  "active",
  "refused",
  "withdrawn",
  "closed",
  "deleted",
] as const;
export type CauseStatus = (typeof CAUSE_STATUSES)[number];

/** Donation lifecycle: pending → held → released | refunded (DB-2). */
export const DONATION_STATUSES = ["pending", "held", "released", "refunded", "failed"] as const;
export type DonationStatus = (typeof DONATION_STATUSES)[number];

export const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "unknown"] as const;
export type BloodType = (typeof BLOOD_TYPES)[number];

export const BLOOD_ALERT_LEVELS = ["vitale", "urgente", "normale"] as const;
export type BloodAlertLevel = (typeof BLOOD_ALERT_LEVELS)[number];

export const END_TYPES = ["date", "goal"] as const;
export type EndType = (typeof END_TYPES)[number];

/** Secondary feed filters: Urgent, Presque atteint, Récent (DT-34). One at a time. */
export const CAUSE_FILTERS = ["urgent", "almost", "recent"] as const;
export type CauseFilter = (typeof CAUSE_FILTERS)[number];

/** The structure type that marks a hospital account (blood alerts only, no fundraising). */
export const HOSPITAL_TYPE = "Hôpital (don de sang)";

export const STRUCTURE_TYPES = [
  "Orphelinat",
  "Pouponnière",
  "Foyer",
  "Centre pour handicapés",
  "Prison pour femmes",
  HOSPITAL_TYPE,
  "Autre",
] as const;
export type StructureType = (typeof STRUCTURE_TYPES)[number];

/** Validation state of a structure: documents + payout account (DB-3). */
export const STRUCTURE_STATUSES = ["pending", "approved", "refused"] as const;
export type StructureStatus = (typeof STRUCTURE_STATUSES)[number];

/** Two-phase onboarding (DB-15, DT-31). */
export const ONBOARDING_PHASES = [1, 2] as const;
export type OnboardingPhase = (typeof ONBOARDING_PHASES)[number];

/** SMS one-time-code purposes (DT-2). */
export const OTP_PURPOSES = [
  "donor_signup",
  "login_2fa",
  "org_contact",
  "password_reset",
  "payout_number",
] as const;
export type OtpPurpose = (typeof OTP_PURPOSES)[number];

export const REFUND_STATUSES = ["pending", "refunded", "rejected"] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

export const PROOF_STATUSES = ["submitted", "validated", "escalated"] as const;
export type ProofStatus = (typeof PROOF_STATUSES)[number];

export const PROOF_ITEM_KINDS = ["photo", "video", "invoice", "delivery_note"] as const;
export type ProofItemKind = (typeof PROOF_ITEM_KINDS)[number];

export const PROOF_DEADLINE_REASONS = ["release", "deletion_payout"] as const;
export type ProofDeadlineReason = (typeof PROOF_DEADLINE_REASONS)[number];

export const DELETION_STATUSES = ["pending", "approved", "maintained"] as const;
export type DeletionStatus = (typeof DELETION_STATUSES)[number];

export const FUND_OUTCOMES = ["refund", "payout"] as const;
export type FundOutcome = (typeof FUND_OUTCOMES)[number];

export const PAYOUT_KINDS = ["release", "refund"] as const;
export type PayoutKind = (typeof PAYOUT_KINDS)[number];

/**
 * Payout worker states (DT-4). `unknown` = timeout or 5xx: reconcile, never resend.
 * `pending_review` = over 2,000,000 XOF, under NabooPay manual review.
 */
export const PAYOUT_STATUSES = [
  "queued",
  "sending",
  "completed",
  "pending_review",
  "unknown",
  "failed",
] as const;
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];

/** Cause-deadline extensions and proof delays (DT-30). */
export const EXTENSION_KINDS = ["cause_deadline", "proof_deadline"] as const;
export type ExtensionKind = (typeof EXTENSION_KINDS)[number];

export const EXTENSION_STATUSES = ["pending", "approved", "refused"] as const;
export type ExtensionStatus = (typeof EXTENSION_STATUSES)[number];

/** In-app notification kinds (DT-17). */
export const NOTIFICATION_KINDS = [
  "donation_confirmed",
  "donation_late_refund",
  "proof_published",
  "cause_decision",
  "structure_decision",
  "payout_account_decision",
  "extension_decision",
  "deletion_decision",
  "refund_decision",
  "blood_alert",
  "blood_thanks",
  "account_suspended",
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

// ---------------------------------------------------------------------------
// Entities (one per table, derived from convex/schema.ts)
// ---------------------------------------------------------------------------

export type User = Doc<"users">;
export type DonorProfile = Doc<"donorProfiles">;
export type Structure = Doc<"structures">;
export type PayoutAccount = NonNullable<Structure["payout"]>;
export type Cause = Doc<"causes">;
export type Donation = Doc<"donations">;
export type RefundRequest = Doc<"refundRequests">;
export type Proof = Doc<"proofs">;
export type SpendLine = Proof["spend"][number];
export type ProofItem = Doc<"proofItems">;
export type ProofDeadline = Doc<"proofDeadlines">;
export type DeletionRequest = Doc<"deletionRequests">;
export type PayoutJob = Doc<"payouts">;
export type ExtensionRequest = Doc<"extensionRequests">;
export type Notification = Doc<"notifications">;
export type AuditLogEntry = Doc<"auditLog">;
export type OtpCode = Doc<"otpCodes">;
export type BloodAlert = Doc<"bloodAlerts">;
export type BloodResponse = Doc<"bloodResponses">;
export type BloodStock = Doc<"bloodStock">;

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export interface CreateCauseInput {
  title: string;
  description: string;
  category: Category;
  bannerFileId: Id<"_storage">;
  endType: EndType;
  goalAmount: number;
  deadline: number;
  urgency: Urgency;
}

export interface UpdateCauseInput extends Partial<CreateCauseInput> {
  causeId: Id<"causes">;
}

export interface CreateDonationInput {
  causeId: Id<"causes">;
  amount: number;
  method: Method;
}

export interface SubmitProofInput {
  causeId: Id<"causes">;
  report: string;
  items: Array<Omit<ProofItem, "_id" | "_creationTime" | "proofId" | "flagged" | "flagReason">>;
  spend: SpendLine[];
}

export interface CreateAlertInput {
  hospitalId: Id<"structures">;
  bloodTypes: BloodType[];
  level: BloodAlertLevel;
  unitsNeeded: number;
  targetCommunes: string[];
  channels: { inApp: boolean; sms: boolean };
}

// ---------------------------------------------------------------------------
// Views (what the causes queries return; docs/API_CONTRACT.md "Causes")
// ---------------------------------------------------------------------------

/** Every cause ends at its deadline; a `goal` cause also ends as soon as the goal is reached. */
export interface EndCondition {
  type: EndType;
  deadline: number;
}

/** One card of the causes feed. */
export interface CauseCardView {
  id: Id<"causes">;
  title: string;
  category: Category;
  organization: { name: string; verified: boolean };
  bannerUrl: string | null;
  raised: number;
  goal: number;
  /** Integer, 0–100. */
  percent: number;
  urgent: boolean;
  endCondition: EndCondition;
}

/** One of the structure's own causes, with its moderation status (structure dashboard). */
export interface StructureCauseView {
  id: Id<"causes">;
  title: string;
  category: Category;
  bannerUrl: string | null;
  raised: number;
  goal: number;
  /** Integer, 0–100. */
  percent: number;
  urgent: boolean;
  status: CauseStatus;
  /** Shown when the cause was refused. */
  refusalReason: string | null;
  endCondition: EndCondition;
  donorCount: number;
  submittedAt: number;
  /** Funds released to the structure → a reception proof is due (Sprint 5 proof flow). */
  fundsReleased: boolean;
}

/** A structure's own cause with every editable field, to prefill the edit wizard. */
export interface OwnedCauseView {
  id: Id<"causes">;
  title: string;
  description: string;
  category: Category;
  endType: EndType;
  goalAmount: number;
  deadline: number;
  urgency: Urgency;
  bannerUrl: string | null;
  status: CauseStatus;
  refusalReason: string | null;
}

/** A card of the "Causes similaires" row. */
export interface SimilarCauseView {
  id: Id<"causes">;
  title: string;
  raised: number;
  goal: number;
  percent: number;
  bannerUrl: string | null;
}

/** The cause detail page. */
export interface CauseDetailView {
  id: Id<"causes">;
  title: string;
  description: string;
  category: Category;
  urgency: Urgency;
  organization: { id: Id<"structures">; name: string; verified: boolean; city: string };
  bannerUrl: string | null;
  raised: number;
  goal: number;
  percent: number;
  donorCount: number;
  endCondition: EndCondition;
  /** The goal minus the estimated fees: what the structure would receive. */
  estimatedNet: number;
  featured: boolean;
  status: CauseStatus;
  similar: SimilarCauseView[];
}

// ---------------------------------------------------------------------------
// Proofs (reception dossier; docs/API_CONTRACT.md "Proofs")
// ---------------------------------------------------------------------------

/** A flagged item reported back to the structure on submission ({ index, reason }). */
export interface ProofAutoFlag {
  index: number;
  reason: string;
}

/** One item of a dossier, as shown in the gallery. `flagged`/`flagReason` are moderator-only. */
export interface ProofItemView {
  id: Id<"proofItems">;
  kind: ProofItemKind;
  url: string | null;
  caption: string | null;
  supplier: string | null;
  ref: string | null;
  flagged: boolean;
  flagReason: string | null;
}

/** The full dossier of a cause (structure, moderator, or a donor once validated). */
export interface ProofDossierView {
  proofId: Id<"proofs">;
  causeId: Id<"causes">;
  causeTitle: string;
  organization: string;
  report: string;
  spend: SpendLine[];
  status: ProofStatus;
  /** Whole-dossier flags; empty for donors (moderator-only). */
  dossierFlags: string[];
  items: ProofItemView[];
  validatedAt: number | null;
}

/** A card in the donor dashboard / public feed of validated dossiers. */
export interface ProofFeedCard {
  proofId: Id<"proofs">;
  causeId: Id<"causes">;
  causeTitle: string;
  organization: string;
  itemCount: number;
  coverUrl: string | null;
  validatedAt: number | null;
}

// ---------------------------------------------------------------------------
// Moderation queues (docs/API_CONTRACT.md "Moderation")
// ---------------------------------------------------------------------------

export interface StructureQueueItem {
  id: Id<"structures">;
  name: string;
  type: StructureType;
  region: string;
  submittedAt: number;
  hasPayout: boolean;
}

export interface CauseQueueItem {
  id: Id<"causes">;
  title: string;
  organization: string;
  urgent: boolean;
}

export interface ProofQueueItem {
  id: Id<"proofs">;
  cause: string;
  flagged: boolean;
}

export interface ModerationQueue<T> {
  count: number;
  items: T[];
}

export interface ModerationQueues {
  structures: ModerationQueue<StructureQueueItem>;
  causes: ModerationQueue<CauseQueueItem>;
  proofs: ModerationQueue<ProofQueueItem>;
  /** Filled in Sprint 6. */
  deletions: ModerationQueue<never>;
  refunds: ModerationQueue<never>;
  payoutChanges: ModerationQueue<never>;
  featured: { causeId: Id<"causes">; since: number } | null;
}

// ---------------------------------------------------------------------------
// API wrappers
// ---------------------------------------------------------------------------

export type ApiErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "VALIDATION"
  | "NOT_FOUND"
  | "CONFLICT"
  | "PAYMENT_FAILED"
  | "RATE_LIMITED"
  | "MFA_REQUIRED"
  | "OTP_INVALID";

// A type alias (not an interface) so it is a Convex `Value` and can travel in a ConvexError.
export type ApiError = {
  code: ApiErrorCode;
  message: string;
  field?: string | null;
};

export type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: ApiError };

export interface PaginatedResponse<T> {
  page: T[];
  isDone: boolean;
  continueCursor: string | null;
}

// ---------------------------------------------------------------------------
// Derived views
// ---------------------------------------------------------------------------

/** A donation as its donor sees it on the success page and in the simulator (`donations.status`). */
export interface DonationStatusView {
  id: Id<"donations">;
  status: DonationStatus;
  amount: number;
  fee: number;
  net: number;
  /** Picked in the donation modal. */
  method: Method;
  /** NabooPay `selected_payment_method`, once paid. */
  paidMethod: Method | null;
  /** Paid after the cause closed: not counted, refunded automatically (DB-18). */
  lateRefund: boolean;
  createdAt: number;
  cause: {
    id: Id<"causes">;
    title: string;
    raised: number;
    goal: number;
    percent: number;
    status: CauseStatus;
  } | null;
}

/** One row of the donor's history (`donations.mine`, docs/API_CONTRACT.md). */
export interface DonationHistoryView {
  id: Id<"donations">;
  causeId: Id<"causes">;
  cause: string;
  organization: string;
  amount: number;
  net: number;
  method: Method;
  date: number;
  status: DonationStatus;
  lateRefund: boolean;
  proof: { available: boolean; proofId: Id<"proofs"> | null; itemCount: number };
  refund: {
    eligible: boolean;
    estimatedAmount: number;
    request: { status: RefundStatus; refundAmount: number | null } | null;
  };
  causeDeleted: { reason: string; outcome: "refunded" | "paidOut" } | null;
}

/** "Vous avez contribué à N causes pour X FCFA" (`donations.impact`). */
export interface DonorImpact {
  total: number;
  causeCount: number;
  donationCount: number;
}

/** Fee breakdown shown in the donation modal and recomputed on the server (DT-6). */
export interface FeeBreakdown {
  amount: number;
  provider: Provider;
  feeRate: number;
  fee: number;
  platformFeeRate: number;
  platformFee: number;
  net: number;
}
