// The SUNUSOCIAL data model. Spec: docs/DATABASE_SCHEMA.md (this file is authoritative).
//
// - Amounts are integer FCFA. Timestamps are epoch ms.
// - Convex has no unique constraints: fields documented as unique are enforced in the writing
//   mutation, through the index listed here.
// - Region/commune values are plain strings, checked against lib/geo.ts in mutations (DT-22).

import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

import {
  bloodAlertLevelV,
  bloodTypeV,
  categoryV,
  causeStatusV,
  deletionStatusV,
  donationStatusV,
  endTypeV,
  extensionKindV,
  extensionStatusV,
  fundOutcomeV,
  methodV,
  notificationKindV,
  onboardingPhaseV,
  otpPurposeV,
  payoutAccountV,
  payoutKindV,
  payoutStatusV,
  proofDeadlineReasonV,
  proofItemKindV,
  proofStatusV,
  providerV,
  refundStatusV,
  roleV,
  spendLineV,
  structureStatusV,
  structureTypeV,
  urgencyV,
} from "./validators";

export default defineSchema({
  ...authTables,

  // -------------------------------------------------------------------------
  // Accounts & auth
  // -------------------------------------------------------------------------

  /**
   * Extends the Convex Auth users table. The library's fields and its `email`/`phone` index
   * names are kept as-is: Convex Auth looks users up through them. Password hashes live in
   * `authAccounts.secret`, never here.
   */
  users: defineTable({
    ...authTables.users.validator.fields,
    name: v.string(),
    role: roleV,
    structureId: v.optional(v.id("structures")),
    /** Set when the signup SMS code to `phone` is verified (DB-7; organisations: DT-33). */
    phoneVerifiedAt: v.optional(v.number()),
    disabled: v.boolean(),
    createdAt: v.number(),
  })
    .index("email", ["email"])
    .index("phone", ["phone"]),

  /** Extends Convex Auth sessions with the SMS 2FA step for organisations and moderators (DT-2). */
  authSessions: defineTable({
    ...authTables.authSessions.validator.fields,
    mfaVerifiedAt: v.optional(v.number()),
  }).index("userId", ["userId"]),

  /** SMS one-time codes (DT-2). Only the hash is stored. */
  otpCodes: defineTable({
    purpose: otpPurposeV,
    phone: v.string(),
    userId: v.optional(v.id("users")),
    sessionId: v.optional(v.id("authSessions")),
    codeHash: v.string(),
    attempts: v.number(),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
  })
    .index("by_phone_purpose", ["phone", "purpose"])
    .index("by_session", ["sessionId"]),

  /** Single-use email reset tokens for organisations (DT-15). */
  passwordResets: defineTable({
    userId: v.id("users"),
    tokenHash: v.string(),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
  })
    .index("by_token", ["tokenHash"])
    .index("by_user", ["userId"]),

  /** Donor preferences, including the opt-in blood profile (health data, off by default). */
  donorProfiles: defineTable({
    userId: v.id("users"),
    bloodOptIn: v.boolean(),
    bloodType: v.optional(bloodTypeV),
    region: v.optional(v.string()),
    commune: v.optional(v.string()),
    smsOptIn: v.boolean(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_optin_type_commune", ["bloodOptIn", "bloodType", "commune"]),

  /** Organisations and hospitals. A hospital is a structure of type HOSPITAL_TYPE. */
  structures: defineTable({
    name: v.string(),
    type: structureTypeV,
    region: v.string(),
    commune: v.string(),
    contactName: v.string(),
    phone: v.string(),
    email: v.string(),
    receiptNo: v.optional(v.string()),
    /** Récépissé / agrément. Moderators only. */
    receiptFileId: v.id("_storage"),
    /** Required for structures, absent for hospitals (DT-5). */
    payout: v.optional(payoutAccountV),
    /** A requested payout-account change awaiting moderator review. Blocks payouts while set. */
    payoutPending: v.optional(payoutAccountV),
    status: structureStatusV,
    refusalReason: v.optional(v.string()),
    suspendedAt: v.optional(v.number()),
    onboardingPhase: onboardingPhaseV,
    profileCompletedAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_status", ["status"]),

  // -------------------------------------------------------------------------
  // Causes & money
  // -------------------------------------------------------------------------

  causes: defineTable({
    structureId: v.id("structures"),
    title: v.string(),
    description: v.string(),
    category: categoryV,
    bannerFileId: v.id("_storage"),
    endType: endTypeV,
    goalAmount: v.number(),
    /** Required for every cause; ≤ submission + MAX_CAUSE_DURATION_DAYS (DB-5, DB-11). */
    deadline: v.number(),
    extensionCount: v.number(),
    urgency: urgencyV,
    /** Gross FCFA from held/released donations. Drives progress and the goal check. */
    raised: v.number(),
    donorCount: v.number(),
    status: causeStatusV,
    refusalReason: v.optional(v.string()),
    /** "Coup de cœur de la semaine" (DB-6). At most one active cause has it set. */
    featuredAt: v.optional(v.number()),
    submittedAt: v.number(),
    approvedAt: v.optional(v.number()),
    closedAt: v.optional(v.number()),
    /** Set once, when the lump-sum payout is queued: the release idempotency guard. */
    fundsReleasedAt: v.optional(v.number()),
    releasePayoutId: v.optional(v.id("payouts")),
  })
    .index("by_status_category", ["status", "category"])
    .index("by_structure", ["structureId"])
    .index("by_featured", ["featuredAt"])
    .index("by_status_deadline", ["status", "deadline"]),

  donations: defineTable({
    causeId: v.id("causes"),
    donorId: v.id("users"),
    /** Gross FCFA, ≥ MIN_DONATION. */
    amount: v.number(),
    /** NabooPay's actual fee once paid (estimate before). */
    fee: v.number(),
    platformFee: v.number(),
    /** amount − fee − platformFee. */
    net: v.number(),
    method: methodV,
    provider: providerV,
    /** NabooPay order_id, stored before the redirect. Idempotency key (unique once set). */
    providerTxnId: v.optional(v.string()),
    /** NabooPay selected_payment_method. Refunds go back on it. */
    paidMethod: v.optional(methodV),
    status: donationStatusV,
    createdAt: v.number(),
  })
    .index("by_cause", ["causeId"])
    .index("by_cause_donor", ["causeId", "donorId"])
    .index("by_donor", ["donorId"])
    .index("by_txn", ["providerTxnId"])
    .index("by_status_created", ["status", "createdAt"]),

  /** Refund requests, possible while the donation is held. The decision is final (DB-13). */
  refundRequests: defineTable({
    donationId: v.id("donations"),
    donorId: v.id("users"),
    reason: v.string(),
    status: refundStatusV,
    receivingPhone: v.string(),
    /** The donation's net amount. */
    refundAmount: v.optional(v.number()),
    payoutId: v.optional(v.id("payouts")),
    decidedBy: v.optional(v.id("users")),
    createdAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_donation", ["donationId"]),

  /** Every outgoing transfer, processed one at a time by the payout worker (DT-4). */
  payouts: defineTable({
    kind: payoutKindV,
    /** Cause id (release) or refund-request id (refund). */
    targetId: v.string(),
    amount: v.number(),
    method: methodV,
    phone: v.string(),
    name: v.string(),
    status: payoutStatusV,
    providerOrderId: v.optional(v.string()),
    /** Incremented on 409 retries only. */
    attempts: v.number(),
    error: v.optional(v.string()),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  }).index("by_status_created", ["status", "createdAt"]),

  // -------------------------------------------------------------------------
  // Proofs
  // -------------------------------------------------------------------------

  /** The reception dossier: ≥ 5 items, a report and a spend breakdown. One per cause. */
  proofs: defineTable({
    causeId: v.id("causes"),
    structureId: v.id("structures"),
    report: v.string(),
    spend: v.array(spendLineV),
    status: proofStatusV,
    dossierFlags: v.array(v.string()),
    validatedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_cause", ["causeId"])
    .index("by_status", ["status"]),

  proofItems: defineTable({
    proofId: v.id("proofs"),
    kind: proofItemKindV,
    fileId: v.id("_storage"),
    caption: v.optional(v.string()),
    supplier: v.optional(v.string()),
    ref: v.optional(v.string()),
    lines: v.optional(v.array(spendLineV)),
    durationSec: v.optional(v.number()),
    /** 64-bit dHash, hex (photos only). */
    phash: v.optional(v.string()),
    exifTakenAt: v.optional(v.number()),
    flagged: v.boolean(),
    /** French, shown to the moderator. */
    flagReason: v.optional(v.string()),
  })
    .index("by_proof", ["proofId"])
    .index("by_supplier_ref", ["supplier", "ref"]),

  /** Created whenever funds reach a structure; due PROOF_DUE_DAYS later (DB-12, DT-25). */
  proofDeadlines: defineTable({
    causeId: v.id("causes"),
    structureId: v.id("structures"),
    reason: proofDeadlineReasonV,
    dueAt: v.number(),
    enforced: v.boolean(),
    metAt: v.optional(v.number()),
  })
    .index("by_cause", ["causeId"])
    .index("by_met_due", ["metAt", "dueAt"]),

  // -------------------------------------------------------------------------
  // Requests decided by moderators
  // -------------------------------------------------------------------------

  deletionRequests: defineTable({
    causeId: v.id("causes"),
    structureReason: v.string(),
    status: deletionStatusV,
    fundOutcome: v.optional(fundOutcomeV),
    moderatorReason: v.optional(v.string()),
    decidedBy: v.optional(v.id("users")),
    createdAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_cause", ["causeId"]),

  /** Cause-deadline extensions (DB-11) and proof delays (DB-12), DT-30. */
  extensionRequests: defineTable({
    kind: extensionKindV,
    /** Cause id, or proofDeadline id. */
    targetId: v.string(),
    structureId: v.id("structures"),
    requestedUntil: v.number(),
    reason: v.string(),
    status: extensionStatusV,
    moderatorReason: v.optional(v.string()),
    decidedBy: v.optional(v.id("users")),
    createdAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_structure", ["structureId"]),

  // -------------------------------------------------------------------------
  // Notifications & audit
  // -------------------------------------------------------------------------

  notifications: defineTable({
    userId: v.id("users"),
    kind: notificationKindV,
    title: v.string(),
    body: v.string(),
    link: v.optional(v.string()),
    readAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_user_read", ["userId", "readAt"]),

  /** Append-only (DB-9, DT-18). Rows are never edited; donor logins are purged after 12 months. */
  auditLog: defineTable({
    /** Absent for system jobs (cron, webhook). */
    actorId: v.optional(v.id("users")),
    /** e.g. auth.login, donation.paid, structure.approve, funds.release, payout.change. */
    action: v.string(),
    targetTable: v.string(),
    targetId: v.string(),
    details: v.optional(v.record(v.string(), v.any())),
    ip: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_actor", ["actorId", "createdAt"])
    .index("by_target", ["targetTable", "targetId"])
    .index("by_action_created", ["action", "createdAt"]),

  /**
   * Receipts uploaded during an organisation signup, until `registerOrganization` attaches them.
   * Rows left after 24 h are abandoned signups: a daily cron deletes them and their files.
   */
  signupUploads: defineTable({
    storageId: v.id("_storage"),
    /** The contact phone whose SMS code authorised the upload. */
    phone: v.string(),
    createdAt: v.number(),
  })
    .index("by_storage", ["storageId"])
    .index("by_created", ["createdAt"]),

  /** Fixed-window counters for rate limits (convex/lib/rateLimit.ts). */
  rateLimits: defineTable({
    key: v.string(),
    windowStart: v.number(),
    count: v.number(),
  }).index("by_key", ["key"]),

  // -------------------------------------------------------------------------
  // Blood module
  // -------------------------------------------------------------------------

  bloodAlerts: defineTable({
    hospitalId: v.id("structures"),
    bloodTypes: v.array(bloodTypeV),
    level: bloodAlertLevelV,
    unitsNeeded: v.number(),
    unitsCollected: v.number(),
    /** Communes within the hospital's region. */
    targetCommunes: v.array(v.string()),
    estimatedRecipients: v.number(),
    channels: v.object({ inApp: v.boolean(), sms: v.boolean() }),
    closed: v.boolean(),
    thanksMessage: v.optional(v.string()),
    createdBy: v.id("users"),
    closedBy: v.optional(v.id("users")),
    createdAt: v.number(),
  })
    .index("by_hospital_closed", ["hospitalId", "closed"])
    .index("by_closed", ["closed"]),

  bloodResponses: defineTable({
    alertId: v.id("bloodAlerts"),
    donorId: v.id("users"),
    /** Snapshot of the donor's group. */
    bloodType: bloodTypeV,
    /** The donor's commune. An address is never shared. */
    commune: v.string(),
    slot: v.string(),
    donated: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_alert", ["alertId"])
    .index("by_alert_donor", ["alertId", "donorId"]),

  bloodStock: defineTable({
    hospitalId: v.id("structures"),
    bloodType: bloodTypeV,
    units: v.number(),
    updatedAt: v.number(),
  }).index("by_hospital_type", ["hospitalId", "bloodType"]),
});
