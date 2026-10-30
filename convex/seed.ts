// Development / preview seed data, mirroring the prototype's content.
//
//   npx convex run seed:run
//
// Idempotent: does nothing if the database already holds structures. Refused in production.
// Every seeded donation keeps `fee + platformFee + net === amount`, and each cause's `raised`
// and `donorCount` match its donations exactly.

import { v } from "convex/values";

import { DAY_MS, loadConfig } from "../lib/config";
import { isValidCommune } from "../lib/geo";
import { computeFee } from "../lib/money";
import {
  HOSPITAL_TYPE,
  type BloodType,
  type Category,
  type EndType,
  type Method,
  type StructureStatus,
  type StructureType,
} from "../lib/types";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";

// ---------------------------------------------------------------------------
// Data (from prototype/Donateur-v2.dc.html and prototype/Moderateur-v2.dc.html)
// ---------------------------------------------------------------------------

interface SeedStructure {
  key: string;
  name: string;
  type: StructureType;
  region: string;
  commune: string;
  contactName: string;
  phone: string;
  email: string;
  receiptNo: string;
  status: StructureStatus;
  /** Absent for hospitals (DT-5). */
  payoutMethod?: Method;
}

const STRUCTURES: SeedStructure[] = [
  {
    key: "keurKhadija",
    name: "Pouponnière Keur Khadija",
    type: "Pouponnière",
    region: "Thiès",
    commune: "Mbour",
    contactName: "Khadija Ndiaye",
    phone: "+221770000201",
    email: "keur-khadija@sunusocial.test",
    receiptNo: "MFFGPE/2025-0310",
    status: "approved",
    payoutMethod: "wave",
  },
  {
    key: "awHandicap",
    name: "Centre Aw Handicap",
    type: "Centre pour handicapés",
    region: "Thiès",
    commune: "Thiès",
    contactName: "Mamadou Aw",
    phone: "+221770000202",
    email: "aw-handicap@sunusocial.test",
    receiptNo: "MI/AS/2026-0045",
    status: "approved",
    payoutMethod: "orange_money",
  },
  {
    key: "maisonArret",
    name: "Maison d'arrêt des femmes",
    type: "Prison pour femmes",
    region: "Dakar",
    commune: "Rufisque",
    contactName: "Fatou Ndiaye",
    phone: "+221770000203",
    email: "maison-arret-femmes@sunusocial.test",
    receiptNo: "MJ/AP/2026-0092",
    status: "approved",
    payoutMethod: "wave",
  },
  {
    key: "darouSalam",
    name: "Orphelinat Darou Salam",
    type: "Orphelinat",
    region: "Kaolack",
    commune: "Kaolack",
    contactName: "Abdou Cissé",
    phone: "+221770000204",
    email: "darou-salam@sunusocial.test",
    receiptNo: "SG/DAGAT/2024-1180",
    status: "approved",
    payoutMethod: "orange_money",
  },
  {
    key: "keurYaay",
    name: "Foyer Keur Yaay",
    type: "Foyer",
    region: "Dakar",
    commune: "Grand Dakar",
    contactName: "Awa Sow",
    phone: "+221770000205",
    email: "keur-yaay@sunusocial.test",
    receiptNo: "SG/DAGAT/2026-0417",
    status: "approved",
    payoutMethod: "wave",
  },
  {
    key: "daaraFallou",
    name: "Daara Serigne Fallou",
    type: "Autre",
    region: "Diourbel",
    commune: "Touba",
    contactName: "Serigne Mbacké",
    phone: "+221770000206",
    email: "daara-fallou@sunusocial.test",
    receiptNo: "MI/AS/2025-0712",
    status: "approved",
    payoutMethod: "wave",
  },
  {
    key: "espoirZiguinchor",
    name: "Centre Espoir Ziguinchor",
    type: "Autre",
    region: "Ziguinchor",
    commune: "Ziguinchor",
    contactName: "Marie Diatta",
    phone: "+221770000207",
    email: "espoir-ziguinchor@sunusocial.test",
    receiptNo: "MI/AS/2025-0954",
    status: "approved",
    payoutMethod: "orange_money",
  },
  {
    key: "hopitalPrincipal",
    name: "Hôpital Principal de Dakar",
    type: HOSPITAL_TYPE,
    region: "Dakar",
    commune: "Dakar-Plateau",
    contactName: "Dr Ousmane Ba",
    phone: "+221770000208",
    email: "transfusion-hpd@sunusocial.test",
    receiptNo: "MSAS/DES/2015-0011",
    status: "approved",
  },
  // Waiting for moderation, as in the moderator prototype.
  {
    key: "baamtaare",
    name: "Centre Baamtaare Handicap",
    type: "Centre pour handicapés",
    region: "Kaolack",
    commune: "Kaolack",
    contactName: "Modou Faye",
    phone: "+221770000209",
    email: "baamtaare@sunusocial.test",
    receiptNo: "MI/AS/2026-1188",
    status: "pending",
    payoutMethod: "orange_money",
  },
  {
    key: "hopitalThies",
    name: "Hôpital régional de Thiès",
    type: HOSPITAL_TYPE,
    region: "Thiès",
    commune: "Thiès",
    contactName: "Dr Mame Diarra Sarr",
    phone: "+221770000210",
    email: "transfusion-hrt@sunusocial.test",
    receiptNo: "MSAS/DES/2019-0231",
    status: "pending",
  },
];

interface SeedCause {
  structure: string;
  title: string;
  description: string;
  category: Category;
  urgent: boolean;
  endType: EndType;
  goalAmount: number;
  raised: number;
  /** Distinct donors, capped by the number of seeded donors. */
  donors: number;
  /** Days from now. Causes were submitted 2 days ago, so this stays ≤ 28 (DB-11). */
  deadlineInDays: number;
  /** Unsplash photo id used for the banner (placeholder when unreachable). */
  photo: string;
  featured?: boolean;
}

const CAUSES: SeedCause[] = [
  {
    structure: "keurKhadija",
    title: "Lait infantile pour 32 nourrissons",
    description:
      "La pouponnière accueille 32 nourrissons de 0 à 2 ans, orphelins ou abandonnés. Notre réserve de lait 1er âge sera épuisée dans moins de deux semaines. Une boîte de 800 g coûte 5 000 FCFA et nourrit un bébé pendant cinq jours.",
    category: "Alimentation",
    urgent: true,
    endType: "date",
    goalAmount: 10_000,
    raised: 4_500,
    donors: 6,
    deadlineInDays: 6,
    photo: "photo-1584367368243-c0c59fd4a1f9",
  },
  {
    structure: "awHandicap",
    title: "Trois fauteuils roulants adaptés",
    description:
      "Trois adolescents du centre attendent un fauteuil adapté à leur morphologie depuis plus d'un an. Le devis de l'atelier orthopédique de Thiès s'élève à 120 000 FCFA par fauteuil, réglages et suivi compris.",
    category: "Matériel",
    urgent: false,
    endType: "goal",
    goalAmount: 360_000,
    raised: 312_000,
    donors: 41,
    deadlineInDays: 28,
    photo: "photo-1642680936843-b09109c69104",
    featured: true,
  },
  {
    structure: "maisonArret",
    title: "Kits d'hygiène pour 80 détenues",
    description:
      "Savon, serviettes hygiéniques, dentifrice et brosses à dents pour les 80 femmes détenues accompagnées par notre association. Un kit mensuel revient à 1 500 FCFA.",
    category: "Santé",
    urgent: true,
    endType: "date",
    goalAmount: 120_000,
    raised: 61_000,
    donors: 18,
    deadlineInDays: 10,
    photo: "photo-1509099863731-ef4bff19e808",
  },
  {
    structure: "darouSalam",
    title: "Riz, huile et sucre pour novembre",
    description:
      "45 enfants vivent à l'orphelinat. Nous cherchons à couvrir un mois de denrées de base : 6 sacs de riz de 50 kg, 40 litres d'huile et 25 kg de sucre.",
    category: "Alimentation",
    urgent: false,
    endType: "goal",
    goalAmount: 175_000,
    raised: 158_000,
    donors: 37,
    deadlineInDays: 14,
    photo: "photo-1644377949116-c4a6b529241c",
  },
  {
    structure: "keurYaay",
    title: "Consultations pédiatriques mensuelles",
    description:
      "Visite mensuelle d'un pédiatre pour les 24 enfants du foyer, médicaments de première nécessité compris, pendant trois mois.",
    category: "Santé",
    urgent: false,
    endType: "date",
    goalAmount: 90_000,
    raised: 22_500,
    donors: 9,
    deadlineInDays: 25,
    photo: "photo-1758691462268-fbe66c4f3e28",
  },
  {
    structure: "daaraFallou",
    title: "60 nattes et couvertures",
    description:
      "Les talibés du daara dorment à même le sol. 60 nattes et 60 couvertures avant la saison fraîche permettront à chacun de dormir au sec.",
    category: "Matériel",
    urgent: true,
    endType: "date",
    goalAmount: 150_000,
    raised: 18_000,
    donors: 5,
    deadlineInDays: 4,
    photo: "photo-1567057419565-4349c49d8a04",
  },
  {
    structure: "espoirZiguinchor",
    title: "Moustiquaires imprégnées",
    description:
      "Avec l'hivernage, les cas de paludisme se multiplient. 22 moustiquaires imprégnées à longue durée protégeront les deux dortoirs du centre.",
    category: "Santé",
    urgent: false,
    endType: "goal",
    goalAmount: 55_000,
    raised: 47_000,
    donors: 22,
    deadlineInDays: 20,
    photo: "photo-1533633310920-cc9bf1e7f9b0",
  },
];

interface SeedDonor {
  name: string;
  phone: string;
  region: string;
  commune: string;
  bloodType?: BloodType;
}

const DONORS: SeedDonor[] = [
  {
    name: "Aminata Diop",
    phone: "+221770000101",
    region: "Dakar",
    commune: "Médina",
    bloodType: "O+",
  },
  {
    name: "Moussa Sarr",
    phone: "+221770000102",
    region: "Dakar",
    commune: "Dakar-Plateau",
    bloodType: "O-",
  },
  {
    name: "Fatou Kiné Ndiaye",
    phone: "+221770000103",
    region: "Dakar",
    commune: "Pikine",
    bloodType: "A+",
  },
  { name: "Ibrahima Fall", phone: "+221770000104", region: "Thiès", commune: "Mbour" },
  { name: "Mariama Ba", phone: "+221770000105", region: "Saint-Louis", commune: "Saint-Louis" },
  { name: "Cheikh Mbaye", phone: "+221770000106", region: "Kaolack", commune: "Kaolack" },
  { name: "Ndeye Coumba Gueye", phone: "+221770000107", region: "Dakar", commune: "Guédiawaye" },
  { name: "Ousmane Diallo", phone: "+221770000108", region: "Ziguinchor", commune: "Bignona" },
];

const HOSPITAL_STOCK: Partial<Record<BloodType, number>> = {
  "A+": 14,
  "A-": 3,
  "B+": 9,
  "B-": 1,
  "AB+": 4,
  "AB-": 0,
  "O+": 6,
  "O-": 2,
};

/** A 1×1 PNG, used when a banner photo can't be downloaded. */
const PLACEHOLDER_PNG = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8sP/ffwAIqQOyjS3RqQAAAABJRU5ErkJggg==",
  ),
  (c) => c.charCodeAt(0),
);

const PLACEHOLDER_RECEIPT = "%PDF-1.4\n% SUNUSOCIAL — récépissé de démonstration\n";

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

function assertNotProduction() {
  if (loadConfig(process.env).appEnv === "production") {
    throw new Error("seed:run is disabled in production");
  }
}

/** Splits `total` into `parts` positive integers that add up to `total`. */
function split(total: number, parts: number): number[] {
  const base = Math.floor(total / parts);
  const amounts = Array.from({ length: parts }, () => base);
  amounts[parts - 1] += total - base * parts;
  return amounts;
}

async function downloadBanner(photo: string): Promise<Blob | null> {
  try {
    const response = await fetch(
      `https://images.unsplash.com/${photo}?w=1200&q=70&auto=format&fit=crop`,
      { signal: AbortSignal.timeout(8_000) },
    );
    if (!response.ok) return null;
    return await response.blob();
  } catch {
    return null;
  }
}

type SeedResult =
  | { skipped: true }
  | { skipped: false; structures: number; donors: number; causes: number; donations: number };

export const isSeeded = internalQuery({
  args: {},
  handler: async (ctx): Promise<boolean> => (await ctx.db.query("structures").first()) !== null,
});

export const run = internalAction({
  args: {
    /** Download the prototype's banner photos (default true). Tests pass false. */
    fetchImages: v.optional(v.boolean()),
  },
  handler: async (ctx, { fetchImages = true }): Promise<SeedResult> => {
    assertNotProduction();
    if (await ctx.runQuery(internal.seed.isSeeded, {})) {
      return { skipped: true };
    }

    const placeholder = new Blob([PLACEHOLDER_PNG], { type: "image/png" });
    const bannerIds: Id<"_storage">[] = [];
    for (const cause of CAUSES) {
      const photo = fetchImages ? await downloadBanner(cause.photo) : null;
      bannerIds.push(await ctx.storage.store(photo ?? placeholder));
    }
    const receiptId = await ctx.storage.store(
      new Blob([PLACEHOLDER_RECEIPT], { type: "application/pdf" }),
    );

    const result = await ctx.runMutation(internal.seed.insert, { bannerIds, receiptId });
    if (result.skipped) {
      // Seeded concurrently: drop the files stored above.
      for (const id of [...bannerIds, receiptId]) await ctx.storage.delete(id);
    }
    return result;
  },
});

export const insert = internalMutation({
  args: {
    bannerIds: v.array(v.id("_storage")),
    receiptId: v.id("_storage"),
  },
  handler: async (ctx, { bannerIds, receiptId }): Promise<SeedResult> => {
    assertNotProduction();
    if ((await ctx.db.query("structures").first()) !== null) {
      return { skipped: true };
    }
    if (bannerIds.length !== CAUSES.length) {
      throw new Error(`expected ${CAUSES.length} banners, got ${bannerIds.length}`);
    }

    const now = Date.now();
    const platformFeeRate = loadConfig(process.env).platformFeeRate;

    // Structures and their accounts.
    const structureIds = new Map<string, Id<"structures">>();
    const hospitalUsers = new Map<string, Id<"users">>();
    for (const s of STRUCTURES) {
      if (!isValidCommune(s.region, s.commune)) {
        throw new Error(`invalid region/commune for ${s.name}`);
      }
      const approved = s.status === "approved";
      const structureId = await ctx.db.insert("structures", {
        name: s.name,
        type: s.type,
        region: s.region,
        commune: s.commune,
        contactName: s.contactName,
        phone: s.phone,
        email: s.email,
        receiptNo: s.receiptNo,
        receiptFileId: receiptId,
        payout: s.payoutMethod && {
          method: s.payoutMethod,
          accountNumber: s.phone,
          holderName: s.contactName,
          phoneVerifiedAt: now - 30 * DAY_MS,
          ...(approved ? { verifiedAt: now - 29 * DAY_MS } : {}),
        },
        status: s.status,
        onboardingPhase: 1,
        createdAt: now - 30 * DAY_MS,
      });
      structureIds.set(s.key, structureId);
      const userId = await ctx.db.insert("users", {
        name: s.contactName,
        email: s.email,
        phone: s.phone,
        role: s.type === HOSPITAL_TYPE ? "hospital" : "structure",
        structureId,
        disabled: false,
        createdAt: now - 30 * DAY_MS,
      });
      if (s.type === HOSPITAL_TYPE) hospitalUsers.set(s.key, userId);
    }

    // Donors.
    const donorIds: Id<"users">[] = [];
    for (const d of DONORS) {
      const userId = await ctx.db.insert("users", {
        name: d.name,
        phone: d.phone,
        role: "donor",
        phoneVerifiedAt: now - 20 * DAY_MS,
        disabled: false,
        createdAt: now - 20 * DAY_MS,
      });
      await ctx.db.insert("donorProfiles", {
        userId,
        bloodOptIn: d.bloodType !== undefined,
        bloodType: d.bloodType,
        region: d.region,
        commune: d.commune,
        smsOptIn: d.bloodType !== undefined,
        updatedAt: now - 20 * DAY_MS,
      });
      donorIds.push(userId);
    }

    // Causes and their held donations.
    let donationCount = 0;
    for (const [index, c] of CAUSES.entries()) {
      const structureId = structureIds.get(c.structure);
      if (!structureId) throw new Error(`unknown structure ${c.structure}`);
      const donorCount = Math.min(c.donors, donorIds.length);
      const causeId = await ctx.db.insert("causes", {
        structureId,
        title: c.title,
        description: c.description,
        category: c.category,
        bannerFileId: bannerIds[index],
        endType: c.endType,
        goalAmount: c.goalAmount,
        deadline: now + c.deadlineInDays * DAY_MS,
        extensionCount: 0,
        urgency: c.urgent ? "urgent" : "normal",
        raised: c.raised,
        donorCount,
        status: "active",
        ...(c.featured ? { featuredAt: now } : {}),
        submittedAt: now - 2 * DAY_MS,
        approvedAt: now - DAY_MS,
      });
      for (const [i, amount] of split(c.raised, donorCount).entries()) {
        const method: Method = i % 2 === 0 ? "wave" : "orange_money";
        const { fee, platformFee, net } = computeFee(amount, "mock", platformFeeRate);
        await ctx.db.insert("donations", {
          causeId,
          donorId: donorIds[i],
          amount,
          fee,
          platformFee,
          net,
          method,
          provider: "mock",
          providerTxnId: `seed-${index + 1}-${i + 1}`,
          paidMethod: method,
          status: "held",
          // Spread over the day since approval.
          createdAt: now - Math.round((DAY_MS * (i + 1)) / (donorCount + 1)),
        });
        donationCount += 1;
      }
    }

    // Blood module: stock and one open alert for the approved hospital.
    const hospitalId = structureIds.get("hopitalPrincipal");
    const hospitalUser = hospitalUsers.get("hopitalPrincipal");
    if (!hospitalId || !hospitalUser) throw new Error("missing seeded hospital");
    for (const [bloodType, units] of Object.entries(HOSPITAL_STOCK)) {
      await ctx.db.insert("bloodStock", {
        hospitalId,
        bloodType: bloodType as BloodType,
        units,
        updatedAt: now,
      });
    }
    const alertTypes: BloodType[] = ["O+", "O-"];
    const targetCommunes = ["Dakar-Plateau", "Médina"];
    await ctx.db.insert("bloodAlerts", {
      hospitalId,
      bloodTypes: alertTypes,
      level: "vitale",
      unitsNeeded: 20,
      unitsCollected: 7,
      targetCommunes,
      estimatedRecipients: DONORS.filter(
        (d) =>
          d.bloodType !== undefined &&
          alertTypes.includes(d.bloodType) &&
          targetCommunes.includes(d.commune),
      ).length,
      channels: { inApp: true, sms: true },
      closed: false,
      createdBy: hospitalUser,
      createdAt: now - DAY_MS / 4,
    });

    await ctx.db.insert("auditLog", {
      action: "seed.run",
      targetTable: "seed",
      targetId: "dev",
      details: { structures: STRUCTURES.length, causes: CAUSES.length, donations: donationCount },
      createdAt: now,
    });

    return {
      skipped: false,
      structures: STRUCTURES.length,
      donors: DONORS.length,
      causes: CAUSES.length,
      donations: donationCount,
    };
  },
});
