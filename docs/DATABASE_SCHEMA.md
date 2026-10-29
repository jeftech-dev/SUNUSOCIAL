# SUNUSOCIAL — Database Schema

| | |
|---|---|
| **Database** | Convex (document database). The shapes below are the logical model; the authoritative source is `convex/schema.ts` |
| **Naming convention** | Tables: plural `camelCase` (`causes`, `bloodAlerts`). Fields: `camelCase`. IDs: Convex `Id<"table">`. Amounts: integer **FCFA**. Timestamps: epoch ms (`number`) |
| **Last Updated** | 29 October 2026. Reflects `DECISIONS.md` (NabooPay with funds held, Convex Auth, payout accounts, audit log) |

> Convex documents are typed through `defineSchema` / `defineTable` with `v.*` validators. The "Type / Constraints" columns describe those validators. Foreign keys are `v.id("table")` references. There is no SQL-level cascade: deletes and state transitions are handled in mutations.

> **Auth tables.** Convex Auth (`@convex-dev/auth`) adds its own tables through `...authTables` (`authAccounts`, `authSessions`, `authRefreshTokens`, `authVerificationCodes`, …). Password hashes live in `authAccounts.secret`, managed by the library, and **never** on `users`. The `users` table below *extends* the Convex Auth users table.

## Tables

### users
The base account. Data specific to structures and hospitals lives in `structures`; donor preferences live in `donorProfiles`.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `_id` | Id<"users"> | PK | Convex id |
| `role` | string | `donor`\|`structure`\|`hospital`\|`moderator` | Account type. Set server-side only |
| `name` | string | required | Full name (donor) or the responsible person's name |
| `phone` | string | E.164; unique for donors | Donor login identifier; the responsible's phone for organisations |
| `email` | string | unique when present | Login identifier for organisations, hospitals and moderators |
| `structureId` | Id<"structures"> | optional | Set for `structure`/`hospital` accounts |
| `disabled` | boolean | default false | Account blocked by a moderator |
| `createdAt` | number | required | Epoch ms |

### twoFactorCodes
One-time codes for structure, hospital and moderator logins (DT-2).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `userId` | Id<"users"> | FK | Who the code belongs to |
| `sessionId` | Id<"authSessions"> | FK | The session the code unlocks |
| `codeHash` | string | required | Hash of the 6-digit code. The plaintext is never stored |
| `channel` | string | `email`\|`sms` | Where it was sent |
| `attempts` | number | max 5 | Failed attempts so far |
| `expiresAt` | number | now + 10 min | |
| `usedAt` | number | optional | |

`authSessions` is extended with `mfaVerifiedAt?: number`. `requireRole()` rejects sessions of structures, hospitals and moderators until it is set.

### passwordResets
Single-use reset tokens: email links for organisations, and assisted resets for donors issued by a moderator (DT-15).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `userId` | Id<"users"> | FK | |
| `tokenHash` | string | required | |
| `issuedBy` | Id<"users"> | optional | The moderator, for an assisted donor reset |
| `expiresAt` | number | now + 30 min | |
| `usedAt` | number | optional | |

### donorProfiles
Donor-only preferences, including the **opt-in** blood profile (health data, off by default).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `userId` | Id<"users"> | FK, unique | Owner |
| `bloodOptIn` | boolean | default false | Whether the donor receives blood alerts |
| `bloodType` | string | optional; `A+`…`O-` or `unknown` | Blood group |
| `region` | string | optional; from `lib/geo.ts` | Senegalese region |
| `commune` | string | optional; from `lib/geo.ts` | Commune within the region |
| `smsOptIn` | boolean | default false | SMS preference (used once SMS is enabled) |
| `updatedAt` | number | required | Last edit |

### structures
Organisations and hospitals. A hospital is a structure whose `type` is "Hôpital (don de sang)".

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `name` | string | required | Organisation name |
| `type` | string | enum | Orphelinat\|Pouponnière\|Foyer\|Centre pour handicapés\|Prison pour femmes\|Hôpital (don de sang)\|Autre |
| `region` | string | from `lib/geo.ts` | |
| `commune` | string | from `lib/geo.ts` | |
| `contactName` | string | required | Responsible person |
| `phone` | string | E.164 | Responsible's phone |
| `email` | string | required | Professional email |
| `receiptNo` | string | optional | Récépissé or agrément number |
| `receiptFileId` | Id<"_storage"> | required | Uploaded document. **Moderators only** |
| `payout` | object | required | `{ method: "orange_money"\|"wave", accountNumber (E.164), holderName, naboopayRecipientId?, verifiedAt?, verifiedBy? }`. See DT-5 |
| `payoutPending` | object | optional | A requested change to the payout account, waiting for moderator review. While it is set, payouts are blocked |
| `status` | string | `pending`\|`approved`\|`refused` | Validation state (documents + payout account, DB-3) |
| `refusalReason` | string | optional | Shown to the structure if refused |
| `suspendedAt` | number | optional | Set by an auto-suspension (missed proof deadline); cleared by a moderator |
| `createdAt` | number | required | |

### causes
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `structureId` | Id<"structures"> | FK | Owner |
| `title` | string | required | |
| `description` | string | required | |
| `category` | string | `Santé`\|`Alimentation`\|`Matériel` | |
| `bannerFileId` | Id<"_storage"> | required | Banner image |
| `endType` | string | `date`\|`goal` | Kind of end condition |
| `goalAmount` | number | integer > 0 | Target in FCFA, compared with gross `raised` |
| `deadline` | number | **required for every cause**; ≤ submission + `MAX_CAUSE_DURATION_DAYS` | Release happens at the goal or this date, whichever comes first (DB-5) |
| `urgency` | string | `normal`\|`urgent` | |
| `raised` | number | default 0 | Gross FCFA collected (denormalised from held/released donations) |
| `donorCount` | number | default 0 | Distinct donors, incremented only on a donor's first confirmed gift |
| `status` | string | `pending_review`\|`active`\|`refused`\|`withdrawn`\|`closed`\|`deleted` | Lifecycle (DT-8) |
| `refusalReason` | string | optional | Shown to the structure |
| `featuredAt` | number | optional | Set when a moderator picks the cause as "Coup de cœur" (DB-6). At most one active cause has it set |
| `submittedAt` | number | required | The "Soumise" step on the timeline |
| `approvedAt` | number | optional | |
| `closedAt` | number | optional | |
| `fundsReleasedAt` | number | optional | Set once, when the lump-sum payout is made (idempotency guard) |
| `payoutTxnId` | string | optional | NabooPay payout reference |

### donations
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `causeId` | Id<"causes"> | FK | |
| `donorId` | Id<"users"> | FK | Tied to a known phone number |
| `amount` | number | integer ≥ `MIN_DONATION` | Gross FCFA |
| `fee` | number | `round(amount × 0.03)` | NabooPay fee |
| `platformFee` | number | default 0 | SUNUSOCIAL share. Stays 0 until the revenue model is decided |
| `net` | number | `amount − fee − platformFee` | What the structure receives |
| `method` | string | `orange_money`\|`wave` | No card |
| `provider` | string | `naboopay`\|`mock` | |
| `providerTxnId` | string | unique once set | Idempotency key for webhooks |
| `status` | string | `pending`\|`held`\|`released`\|`refunded`\|`failed` | |
| `createdAt` | number | required | |

### refundRequests
Possible while the donation is `held`.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `donationId` | Id<"donations"> | FK, unique | |
| `donorId` | Id<"users"> | FK | |
| `reason` | string | required, ≥ 5 chars | The donor's reason |
| `status` | string | `pending`\|`refunded`\|`rejected` | Moderator decision (final) |
| `refundAmount` | number | optional | The amount actually returned (per `REFUND_FEE_POLICY`) |
| `decidedBy` | Id<"users"> | optional | Moderator |
| `createdAt` | number | required | |

### proofs
The reception dossier: at least 5 items, plus a report and a spend breakdown.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `causeId` | Id<"causes"> | FK, unique | One dossier per cause |
| `structureId` | Id<"structures"> | FK | |
| `report` | string | required, ≥ 10 chars | Written "compte rendu" |
| `spend` | array | required | `[{ label, amount }]` breakdown of how the funds were used |
| `status` | string | `submitted`\|`validated`\|`escalated` | Moderation state |
| `dossierFlags` | array<string> | default [] | Flags on the whole dossier, e.g. spend total vs. net received |
| `validatedAt` | number | optional | |
| `createdAt` | number | required | |

### proofDeadlines
Created whenever funds reach a structure: on release (DT-25) and on a deletion payout.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `causeId` | Id<"causes"> | FK, unique | |
| `structureId` | Id<"structures"> | FK | |
| `reason` | string | `release`\|`deletion_payout` | |
| `dueAt` | number | + 7 days | |
| `enforced` | boolean | | `true` for `deletion_payout`. For `release`, follows `ENFORCE_PROOF_DEADLINE_ON_RELEASE` |
| `metAt` | number | optional | Set when the proof is validated |

### proofItems
Individual items in a dossier, stored separately so each can be flagged on its own.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `proofId` | Id<"proofs"> | FK | |
| `kind` | string | `photo`\|`video`\|`invoice`\|`delivery_note` | |
| `fileId` | Id<"_storage"> | required | Images and PDFs ≤ 5 MB; video ≤ 50 MB / 90 s |
| `caption` | string | optional | |
| `supplier` | string | optional | For invoices and delivery notes |
| `ref` | string | optional | Document reference (checked for reuse) |
| `lines` | array | optional | `[{ label, amount }]` for invoices |
| `durationSec` | number | optional | For video |
| `phash` | string | optional | 64-bit dHash, hex-encoded (photos only) |
| `exifTakenAt` | number | optional | EXIF `DateTimeOriginal` |
| `flagged` | boolean | default false | Auto-flagged as suspicious (DT-13) |
| `flagReason` | string | optional | Why it was flagged (in French) |

### deletionRequests
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `causeId` | Id<"causes"> | FK | |
| `structureReason` | string | required, ≥ 5 chars | The structure's motivation |
| `status` | string | `pending`\|`approved`\|`maintained` | Moderator decision |
| `fundOutcome` | string | optional; `refund`\|`payout` | What happens to the funds collected |
| `moderatorReason` | string | optional, ≥ 10 chars | Shown to the structure and the donors |
| `decidedBy` | Id<"users"> | optional | |
| `createdAt` | number | required | |

### notifications
In-app notifications (DT-17).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `userId` | Id<"users"> | FK | Recipient |
| `kind` | string | enum | `donation_confirmed`\|`proof_published`\|`cause_decision`\|`deletion_decision`\|`refund_decision`\|`blood_alert`\|`blood_thanks`\|`account_suspended`\|… |
| `title` | string | required | French |
| `body` | string | required | French |
| `link` | string | optional | Deep link |
| `readAt` | number | optional | |
| `createdAt` | number | required | |

### auditLog
Append-only record of sensitive actions (DT-18). Rows are never edited or deleted.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `actorId` | Id<"users"> | optional | `null` means a system job (cron, webhook) |
| `action` | string | required | e.g. `structure.approve`, `cause.refuse`, `funds.release`, `refund.decide`, `payout.change`, `password.assistedReset`, `featured.set` |
| `targetTable` | string | required | |
| `targetId` | string | required | |
| `details` | object | optional | Amounts, reasons, before/after values |
| `createdAt` | number | required | |

### bloodAlerts
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `hospitalId` | Id<"structures"> | FK | |
| `bloodTypes` | array<string> | ≥ 1 | Groups needed |
| `level` | string | `vitale`\|`urgente`\|`normale` | Urgency |
| `unitsNeeded` | number | required | Target number of blood bags |
| `unitsCollected` | number | default 0 | Confirmed donations |
| `targetCommunes` | array<string> | ≥ 1; within the hospital's region | Targeting |
| `estimatedRecipients` | number | required | Preview: "X donneurs notifiés" |
| `channels` | object | `{ inApp, sms }` | `sms` only sends when `SMS_ENABLED` |
| `closed` | boolean | default false | |
| `thanksMessage` | string | optional | The hospital's thank-you |
| `createdBy` | Id<"users"> | required | Moderator, or the hospital when self-serve is enabled |
| `createdAt` | number | required | |

### bloodResponses
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `alertId` | Id<"bloodAlerts"> | FK | |
| `donorId` | Id<"users"> | FK | |
| `bloodType` | string | required | Snapshot of the donor's group |
| `commune` | string | required | The donor's commune (an address is never shared) |
| `slot` | string | required | Confirmed visit window |
| `donated` | boolean | default false | Confirmed on site by the hospital (stock +1) |
| `createdAt` | number | required | |

### bloodStock
Each hospital's reserves by blood group.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `hospitalId` | Id<"structures"> | FK | |
| `bloodType` | string | required | Group |
| `units` | number | default 0 | Bags in stock |
| `updatedAt` | number | required | |

### Reference data — regions and communes
These are **not a table**. Regions and communes are a static list in `lib/geo.ts`, imported by both Next.js and Convex (DT-22). Validators check every `region`/`commune` value against it. Interim data is the prototype's 8 regions; the official list of all 14 is pending (`BOARD_QUESTIONS.md` Q4).

## Indexes

```sql
-- Convex indexes are declared in schema.ts via .index(name, [fields]).
-- Shown here in SQL-equivalent form for review.

CREATE INDEX users_by_phone              ON users (phone);
CREATE INDEX users_by_email              ON users (email);
CREATE INDEX twoFactor_by_session        ON twoFactorCodes (sessionId);
CREATE INDEX resets_by_token             ON passwordResets (tokenHash);
CREATE INDEX donorProfiles_by_user       ON donorProfiles (userId);
CREATE INDEX donorProfiles_by_type_commune ON donorProfiles (bloodOptIn, bloodType, commune); -- blood alert targeting
CREATE INDEX structures_by_status        ON structures (status);
CREATE INDEX causes_by_status_cat        ON causes (status, category);       -- feed
CREATE INDEX causes_by_structure         ON causes (structureId);            -- org dashboard
CREATE INDEX causes_by_featured          ON causes (featuredAt);             -- Coup de cœur
CREATE INDEX causes_by_status_deadline   ON causes (status, deadline);       -- release cron
CREATE INDEX donations_by_cause          ON donations (causeId);
CREATE INDEX donations_by_cause_donor    ON donations (causeId, donorId);    -- distinct donorCount
CREATE INDEX donations_by_donor          ON donations (donorId);
CREATE INDEX donations_by_txn            ON donations (providerTxnId);       -- webhook idempotency (uniqueness enforced in mutation)
CREATE INDEX refunds_by_status           ON refundRequests (status);
CREATE INDEX refunds_by_donation         ON refundRequests (donationId);
CREATE INDEX proofs_by_cause             ON proofs (causeId);
CREATE INDEX proofs_by_status            ON proofs (status);
CREATE INDEX proofItems_by_proof         ON proofItems (proofId);
CREATE INDEX proofItems_by_ref           ON proofItems (supplier, ref);      -- reused invoice detection
CREATE INDEX proofDeadlines_by_due       ON proofDeadlines (metAt, dueAt);   -- suspension cron
CREATE INDEX deletions_by_status         ON deletionRequests (status);
CREATE INDEX notifications_by_user       ON notifications (userId, readAt);
CREATE INDEX audit_by_target             ON auditLog (targetTable, targetId);
CREATE INDEX alerts_by_hospital          ON bloodAlerts (hospitalId, closed);
CREATE INDEX alerts_open                 ON bloodAlerts (closed);
CREATE INDEX responses_by_alert          ON bloodResponses (alertId);
CREATE INDEX stock_by_hospital           ON bloodStock (hospitalId, bloodType);
```

> Convex has no unique constraints. Every field marked "unique" is enforced inside the writing mutation, by looking the value up through its index first. Mutations are serialisable, so this check is race-free.
>
> Duplicate-image detection compares a new `phash` against the existing ones within Hamming distance. At MVP volumes, a scan over photo items is acceptable. Revisit (e.g. bucketing by hash prefix) past roughly 50k photos.

## Relationships

- **users 1—1 donorProfiles**: each donor has one profile (the blood opt-in lives there).
- **users 1—1 structures** for `structure`/`hospital` accounts, through `users.structureId`.
- **structures 1—N causes**.
- **causes 1—N donations**. `raised`/`donorCount` are denormalised onto the cause.
- **users (donor) 1—N donations**.
- **donations 1—0..1 refundRequests**.
- **causes 1—0..1 proofs**, and **causes 1—0..1 proofDeadlines**.
- **proofs 1—N proofItems**: a dossier has at least 5 items, each flagged independently.
- **causes 1—N deletionRequests**: normally one active request per cause.
- **users 1—N notifications**.
- **structures (hospital) 1—N bloodAlerts**, and **bloodAlerts 1—N bloodResponses**.
- **structures (hospital) 1—N bloodStock**: one row per blood group per hospital.
- **auditLog** points to any table through `targetTable` + `targetId`.

## Access Control

Convex has no SQL row-level security. Authorisation is enforced in every query, mutation and action through `requireRole()` / `requireOwner()`. The rules below are the policy those functions implement.

```sql
-- Pseudo-policy (enforced in Convex function code, not SQL)

-- Donors read only active causes and validated proofs, plus their own donations.
POLICY causes_read_donor      ON causes          USING (status IN ('active','closed'));
POLICY donations_read_owner   ON donations       USING (donorId = auth.userId());
POLICY proofs_read_public     ON proofs          USING (status = 'validated');

-- Structures read/write only their own rows; a suspended structure cannot create causes.
POLICY causes_write_owner     ON causes          USING (structureId = auth.structureId() AND structure.suspendedAt IS NULL);
POLICY proofs_write_owner     ON proofs          USING (structureId = auth.structureId());
-- Payout account: owner may *request* a change (payoutPending); only a moderator applies it.

-- Récépissés/agréments: moderators only.
POLICY receipt_read_mod       ON _storage(receiptFileId) USING (auth.role() = 'moderator');

-- Hospitals manage only their own alerts and stock; creating alerts also requires the self-serve flag.
POLICY alerts_write_owner     ON bloodAlerts     USING (hospitalId = auth.structureId() AND auth.role() = 'hospital' AND flag('BLOOD_ALERTS_HOSPITAL_SELF_SERVE'));
POLICY stock_write_owner      ON bloodStock      USING (hospitalId = auth.structureId());

-- Donor blood data is health data: owner only; hospitals see first name + group via bloodResponses.
POLICY donor_blood_private    ON donorProfiles   USING (userId = auth.userId());

-- Moderators (separate subdomain, MFA-verified, session ≤ 12 h) read all queues and write decisions.
POLICY moderation_all         ON (structures, causes, proofs, deletionRequests, refundRequests, bloodAlerts, passwordResets)
                              USING (auth.role() = 'moderator' AND session.mfaVerifiedAt IS NOT NULL);

-- Audit log: insert-only from server code; readable by moderators.
POLICY audit_read_mod         ON auditLog        USING (auth.role() = 'moderator');
```

## Migrations & seeds

Convex applies schema changes on deploy (`npx convex deploy`), so there are no numbered migration files (DT-21).

- **Data backfills**: run with `@convex-dev/migrations`, in `convex/migrations.ts`.
- **Seeds**: `convex/seed.ts` (internal mutations). Demo structures, causes and donations for development and preview deploys, mirroring the prototype's content.
- **First moderator**: `npx convex run admin:createModerator '{"name": "…", "email": "…"}'` (DT-20).
