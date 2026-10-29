# SUNUSOCIAL — Database Schema

| | |
|---|---|
| **Database** | Convex (document database). Shapes below are the logical model; the authoritative source is `convex/schema.ts`. |
| **Naming convention** | Tables: plural `camelCase` (`causes`, `bloodAlerts`). Fields: `camelCase`. IDs: Convex `Id<"table">`. Amounts: integer **FCFA**. Timestamps: epoch ms (`Number`). |

> Convex is schemaless at the document level but typed via `defineSchema`/`defineTable` with `v.*` validators. The "Type / Constraints" columns describe those validators. Foreign keys are `v.id("table")` references; there is no SQL-level cascade — deletes/transitions are handled in mutations.

## Tables

### users
The base account. Role-specific data lives in `structures` (for structure/hospital) and inline here for donors.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `_id` | Id<"users"> | PK | Convex id |
| `role` | string | `donor`\|`structure`\|`hospital`\|`moderator` | Account type |
| `name` | string | required | Full name (donor) or responsible's name |
| `phone` | string | unique (donor); E.164 | Login id for donors; responsible phone for orgs |
| `email` | string | unique when present | Login id for org/hospital/moderator |
| `passwordHash` | string | required | Argon2/bcrypt hash — never the plaintext |
| `structureId` | Id<"structures"> | nullable | Set for `structure`/`hospital` accounts |
| `createdAt` | number | required | Epoch ms |

### donorProfiles
Donor-only preferences, including the **opt-in** blood profile (health data, off by default).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `_id` | Id<"donorProfiles"> | PK | |
| `userId` | Id<"users"> | FK → users, unique | Owner |
| `bloodOptIn` | boolean | default false | Whether the donor receives blood alerts |
| `bloodType` | string | nullable; `A+`…`O-` or `unknown` | Blood group |
| `region` | string | nullable | Senegalese region (fixed list) |
| `commune` | string | nullable | Commune within region (fixed list) |
| `smsOptIn` | boolean | default false | SMS channel preference |
| `updatedAt` | number | required | Last edit |

### structures
Organizations and hospitals (a hospital is a structure whose `type` is "Hôpital (don de sang)").

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `_id` | Id<"structures"> | PK | |
| `name` | string | required | Organization name |
| `type` | string | enum | Orphelinat\|Pouponnière\|Foyer\|Centre pour handicapés\|Prison pour femmes\|Hôpital (don de sang)\|Autre |
| `region` | string | required | Region (fixed list) |
| `commune` | string | required | Commune (fixed list) |
| `contactName` | string | required | Responsible person |
| `phone` | string | required | Responsible phone |
| `email` | string | required | Professional email |
| `receiptNo` | string | nullable | Récépissé/agrément number |
| `receiptFileId` | Id<"_storage"> | required | Uploaded document |
| `status` | string | `pending`\|`approved`\|`refused` | Validation state |
| `refusalReason` | string | nullable | Shown to the structure if refused |
| `suspended` | boolean | default false | Auto-suspended on missed proof deadline |
| `createdAt` | number | required | |

### causes
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `_id` | Id<"causes"> | PK | |
| `structureId` | Id<"structures"> | FK → structures | Owner |
| `title` | string | required | |
| `description` | string | required | |
| `category` | string | `Santé`\|`Alimentation`\|`Matériel` | |
| `bannerFileId` | Id<"_storage"> | required | Banner image |
| `endType` | string | `date`\|`goal` | End condition kind |
| `goalAmount` | number | required | Target FCFA |
| `deadline` | number | required | Safety deadline — **present even for `goal`** (funds never held forever) |
| `urgency` | string | `normal`\|`urgent` | |
| `raised` | number | default 0 | Collected FCFA (denormalized from donations) |
| `donorCount` | number | default 0 | Distinct donors (denormalized) |
| `status` | string | `pending`\|`active`\|`closed`\|`refused`\|`deleted` | Lifecycle (Soumise/En modération map to `pending`) |
| `refusalReason` | string | nullable | Shown to the structure |
| `featured` | boolean | default false | Weekly editor's pick |
| `fundsReleased` | boolean | default false | NabooPay: released at goal/deadline |
| `createdAt` | number | required | |

### donations
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `_id` | Id<"donations"> | PK | |
| `causeId` | Id<"causes"> | FK → causes | |
| `donorId` | Id<"users"> | FK → users | Tied to a known phone |
| `amount` | number | required | Gross FCFA |
| `fee` | number | required | Provider fee at time of donation |
| `net` | number | required | Amount the structure receives |
| `method` | string | `orange_money`\|`wave` | No card |
| `provider` | string | `naboopay`\|`sycapay` | Active provider at donation time |
| `providerTxnId` | string | unique | Idempotency key for webhooks |
| `status` | string | `pending`\|`held`\|`released`\|`refunded`\|`failed` | `held` only under NabooPay |
| `createdAt` | number | required | |

### refundRequests
NabooPay only (funds still held).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `_id` | Id<"refundRequests"> | PK | |
| `donationId` | Id<"donations"> | FK → donations, unique | |
| `donorId` | Id<"users"> | FK → users | |
| `reason` | string | required, ≥ 5 chars | Donor's reason |
| `status` | string | `pending`\|`refunded`\|`rejected` | Moderator decision (final) |
| `decidedBy` | Id<"users"> | nullable | Moderator |
| `createdAt` | number | required | |

### proofs
The reception dossier (≥ 5 items + report + spend).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `_id` | Id<"proofs"> | PK | |
| `causeId` | Id<"causes"> | FK → causes, unique | One dossier per cause |
| `structureId` | Id<"structures"> | FK → structures | |
| `report` | string | required, ≥ 10 chars | Written "compte rendu" |
| `spend` | array | required | `[{ label, amount }]` fund-use breakdown |
| `status` | string | `submitted`\|`validated`\|`escalated` | Moderation state |
| `validatedAt` | number | nullable | |
| `dueAt` | number | nullable | 7-day deadline when tied to a deletion payout |
| `createdAt` | number | required | |

### proofItems
Individual dossier elements (kept separate so items can be flagged independently).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `_id` | Id<"proofItems"> | PK | |
| `proofId` | Id<"proofs"> | FK → proofs | |
| `kind` | string | `photo`\|`video`\|`invoice`\|`delivery_note` | |
| `fileId` | Id<"_storage"> | nullable | Media file (null for rendered doc summaries) |
| `caption` | string | nullable | |
| `supplier` | string | nullable | For invoice/delivery_note |
| `ref` | string | nullable | Document reference |
| `lines` | array | nullable | `[{ label, amount }]` for invoices |
| `durationSec` | number | nullable | For video |
| `flagged` | boolean | default false | Auto-flagged suspicious |
| `flagReason` | string | nullable | Why flagged |

### deletionRequests
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `_id` | Id<"deletionRequests"> | PK | |
| `causeId` | Id<"causes"> | FK → causes | |
| `structureReason` | string | required, ≥ 5 chars | Structure's motivation |
| `status` | string | `pending`\|`approved`\|`maintained` | Moderator decision |
| `fundOutcome` | string | nullable; `refund`\|`payout` | Fate of collected funds (refund disabled under SycaPay) |
| `moderatorReason` | string | nullable, ≥ 10 chars | Shown to structure + donors |
| `decidedBy` | Id<"users"> | nullable | |
| `createdAt` | number | required | |

### bloodAlerts
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `_id` | Id<"bloodAlerts"> | PK | |
| `hospitalId` | Id<"structures"> | FK → structures | |
| `bloodTypes` | array<string> | ≥ 1 | Requested groups |
| `level` | string | `vitale`\|`urgente`\|… | Urgency |
| `unitsNeeded` | number | required | Target poches |
| `unitsCollected` | number | default 0 | Confirmed donations |
| `targetCommunes` | array<string> | ≥ 1; within hospital's region | Targeting |
| `estimatedRecipients` | number | required | Preview "X donneurs notifiés" |
| `channels` | object | `{ inApp, sms }` | |
| `closed` | boolean | default false | |
| `thanksMessage` | string | nullable | Hospital's thank-you |
| `createdBy` | Id<"users"> | required | Moderator (prototype) / hospital |
| `createdAt` | number | required | |

### bloodResponses
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `_id` | Id<"bloodResponses"> | PK | |
| `alertId` | Id<"bloodAlerts"> | FK → bloodAlerts | |
| `donorId` | Id<"users"> | FK → users | |
| `bloodType` | string | required | Snapshot of donor's group |
| `commune` | string | required | Donor's commune (address never shared) |
| `slot` | string | required | Confirmed visit window |
| `donated` | boolean | default false | Confirmed on-site by hospital (→ stock +1) |
| `createdAt` | number | required | |

### bloodStock
Per-hospital reserves by group.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `_id` | Id<"bloodStock"> | PK | |
| `hospitalId` | Id<"structures"> | FK → structures | |
| `bloodType` | string | required | Group |
| `units` | number | default 0 | Poches in stock |
| `updatedAt` | number | required | |

### geo
Reference data: regions and their communes (fixed lists; no free text).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `_id` | Id<"geo"> | PK | |
| `region` | string | required | 14 regions in production (8 in prototype) |
| `commune` | string | required | Commune within the region |

## Indexes

```sql
-- Convex indexes are declared in schema.ts via .index(name, [fields]).
-- Shown here in SQL-equivalent form for review.

CREATE INDEX users_by_phone        ON users (phone);
CREATE INDEX users_by_email        ON users (email);
CREATE INDEX donorProfiles_by_user ON donorProfiles (userId);
CREATE INDEX donorProfiles_by_type_commune ON donorProfiles (bloodOptIn, bloodType, commune); -- blood alert targeting
CREATE INDEX structures_by_status  ON structures (status);
CREATE INDEX causes_by_status_cat  ON causes (status, category);          -- feed
CREATE INDEX causes_by_structure   ON causes (structureId);               -- org dashboard
CREATE INDEX causes_featured       ON causes (featured, status);          -- editor's pick
CREATE INDEX causes_by_deadline    ON causes (status, deadline);          -- auto-release sweep
CREATE INDEX donations_by_cause    ON donations (causeId);
CREATE INDEX donations_by_donor    ON donations (donorId);
CREATE UNIQUE INDEX donations_by_txn ON donations (providerTxnId);        -- webhook idempotency
CREATE INDEX refunds_by_status     ON refundRequests (status);
CREATE UNIQUE INDEX proofs_by_cause ON proofs (causeId);
CREATE INDEX proofs_by_status      ON proofs (status);
CREATE INDEX proofItems_by_proof   ON proofItems (proofId);
CREATE INDEX deletions_by_status   ON deletionRequests (status);
CREATE INDEX alerts_by_hospital    ON bloodAlerts (hospitalId, closed);
CREATE INDEX alerts_open           ON bloodAlerts (closed);
CREATE INDEX responses_by_alert    ON bloodResponses (alertId);
CREATE INDEX stock_by_hospital     ON bloodStock (hospitalId, bloodType);
CREATE INDEX geo_by_region         ON geo (region);
```

## Relationships

- **users 1—1 donorProfiles** — each donor has one profile (blood opt-in lives here).
- **users 1—1 structures** (for `structure`/`hospital` accounts) — via `users.structureId`.
- **structures 1—N causes** — a structure owns many causes.
- **causes 1—N donations** — a cause receives many donations; `raised`/`donorCount` are denormalized onto the cause.
- **users (donor) 1—N donations** — a donor makes many donations.
- **donations 1—1 refundRequests** — at most one refund request per donation (NabooPay only).
- **causes 1—1 proofs** — one reception dossier per cause.
- **proofs 1—N proofItems** — a dossier has ≥ 5 items; items flag independently.
- **causes 1—N deletionRequests** — normally one active request per cause.
- **structures (hospital) 1—N bloodAlerts** — a hospital issues many alerts.
- **bloodAlerts 1—N bloodResponses** — donors respond to an alert.
- **structures (hospital) 1—N bloodStock** — one row per blood group per hospital.
- **geo** — reference list joined by `region`/`commune` strings on users, structures, alerts.

## Access Control

Convex has no SQL RLS; authorization is enforced in every query/mutation/action. The rules below are the policy those functions implement.

```sql
-- Pseudo-policy (enforced in Convex function code, not SQL)

-- Donors read only approved causes and public/validated proofs; their own donations.
POLICY causes_read_donor      ON causes          USING (status = 'active');
POLICY donations_read_owner   ON donations       USING (donorId = auth.userId());
POLICY proofs_read_public     ON proofs          USING (status = 'validated');

-- Structures read/write only their own rows.
POLICY causes_write_owner     ON causes          USING (structureId = auth.structureId());
POLICY proofs_write_owner     ON proofs          USING (structureId = auth.structureId());

-- Hospitals manage only their own alerts and stock.
POLICY alerts_write_owner     ON bloodAlerts     USING (hospitalId = auth.structureId() AND auth.role() = 'hospital');
POLICY stock_write_owner      ON bloodStock      USING (hospitalId = auth.structureId());

-- Donor blood data is sensitive: hospitals never see addresses; only first name + group are exposed via bloodResponses.
POLICY donor_blood_private    ON donorProfiles   USING (userId = auth.userId());

-- Moderators (separate platform) may read all queues and write decisions; refusal reasons mandatory.
POLICY moderation_all         ON (structures, causes, proofs, deletionRequests, refundRequests)
                              USING (auth.role() = 'moderator');
```

## Migrations

```text
convex/
└── migrations/
    ├── 0001_init_users_structures.ts        # users, donorProfiles, structures + indexes
    ├── 0002_causes_donations.ts             # causes, donations + idempotency index
    ├── 0003_proofs.ts                        # proofs, proofItems, auto-flag fields
    ├── 0004_deletions_refunds.ts             # deletionRequests, refundRequests
    ├── 0005_blood_module.ts                  # bloodAlerts, bloodResponses, bloodStock
    ├── 0006_geo_seed.ts                       # geo reference data (8 regions prototype → 14 prod)
    └── 0007_featured_and_release_flags.ts    # causes.featured, fundsReleased, deadline backfill
```

<!-- assumed: Convex applies schema changes continuously rather than via numbered SQL migrations; the tree above models the intended change-set order for review and for data seeds/backfills run as one-off Convex functions. -->
