// All user-facing French copy, in one place so marketing can review it.
// Copy is ported from prototype/*.dc.html. Label maps are typed `Record<Enum, string>`, so a new
// enum value without its French label fails to compile.

import type {
  BloodAlertLevel,
  BloodType,
  Category,
  CauseStatus,
  DonationStatus,
  Method,
  StructureStatus,
  Urgency,
} from "./types";

export const fr = {
  app: {
    name: "SUNUSOCIAL",
    tagline: "Plateforme digitale de solidarité — Sénégal",
    title: "SUNUSOCIAL — Donnez avec confiance",
    description:
      "SUNUSOCIAL relie les donateurs aux orphelinats, pouponnières, foyers et centres vérifiés du Sénégal. Chaque don est suivi, et chaque structure publie une preuve de réception.",
  },

  landing: {
    headline: "Donnez avec confiance. Aidez avec impact.",
    intro:
      "SUNUSOCIAL relie les donateurs aux orphelinats, pouponnières, foyers et centres vérifiés du Sénégal. Chaque don est suivi, et chaque structure publie une preuve de réception.",
    ctaDonor: "Je suis Donateur",
    ctaStructure: "Je suis une Structure",
    trust: {
      verified: "Structures vérifiées",
      methods: "Orange Money · Wave",
      proof: "Preuve publiée pour chaque cause",
    },
    howItWorks: "Comment ça marche",
    proofs: "Preuves de réception",
  },

  /** Temporary Sprint 1 page: checks fonts, colours and the region → commune lists. */
  foundations: {
    badge: "Version de développement",
    locationTitle: "Où se trouve votre structure\u00a0?",
    locationHint: "Choisissez la région, puis la commune.",
    region: "Région",
    commune: "Commune",
    selected: (commune: string, region: string) => `Commune choisie\u00a0: ${commune}, ${region}`,
  },

  nav: {
    login: "Se connecter",
    signup: "Créer un compte",
    logout: "Se déconnecter",
    forgotPassword: "Mot de passe oublié\u00a0?",
  },

  common: {
    loading: "Chargement…",
    seeMore: "Voir plus",
    donate: "Faire un don",
    verified: "Vérifié",
    verifiedStructure: "Structure vérifiée",
    urgent: "Urgent",
    almostThere: "Presque atteint",
    recent: "Récent",
    featured: "Coup de cœur de la semaine",
    cancel: "Annuler",
    confirm: "Confirmer",
    back: "Retour",
  },

  categories: {
    Santé: "Santé",
    Alimentation: "Alimentation",
    Matériel: "Matériel",
  } satisfies Record<Category, string>,

  urgency: {
    normal: "Normale",
    urgent: "Urgent",
  } satisfies Record<Urgency, string>,

  methods: {
    orange_money: "Orange Money",
    wave: "Wave",
  } satisfies Record<Method, string>,

  /** Cause status as the structure sees it (timeline: Soumise → En modération → Approuvée → Active → Clôturée). */
  causeStatus: {
    pending_review: "En modération",
    active: "Active",
    refused: "Refusée",
    withdrawn: "Retirée",
    closed: "Clôturée",
    deleted: "Supprimée",
  } satisfies Record<CauseStatus, string>,

  causeTimeline: ["Soumise", "En modération", "Approuvée", "Active", "Clôturée"],

  donationStatus: {
    pending: "Paiement en cours",
    held: "Bloqué jusqu'à la fin de la cause",
    released: "Versé à la structure",
    refunded: "Remboursé",
    failed: "Paiement échoué",
  } satisfies Record<DonationStatus, string>,

  structureStatus: {
    pending: "En attente de validation",
    approved: "Validée",
    refused: "Refusée",
  } satisfies Record<StructureStatus, string>,

  bloodTypes: {
    "A+": "A+",
    "A-": "A−",
    "B+": "B+",
    "B-": "B−",
    "AB+": "AB+",
    "AB-": "AB−",
    "O+": "O+",
    "O-": "O−",
    unknown: "Je ne sais pas",
  } satisfies Record<BloodType, string>,

  bloodAlertLevels: {
    vitale: "Urgence vitale",
    urgente: "Urgente",
    normale: "Normale",
  } satisfies Record<BloodAlertLevel, string>,

  errors: {
    generic: "Une erreur est survenue. Veuillez réessayer.",
    network: "Connexion impossible. Vérifiez votre réseau et réessayez.",
    required: "Ce champ est obligatoire.",
    invalidPhone: "Numéro de téléphone invalide.",
    invalidRegion: "Choisissez une région de la liste.",
    invalidCommune: "Choisissez une commune de la région.",
    amountTooLow: (min: string) => `Le don minimum est de ${min}.`,
    amountNotInteger: "Le montant doit être un nombre entier de FCFA.",
  },
} as const;

export type Strings = typeof fr;
