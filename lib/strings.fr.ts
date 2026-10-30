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

  auth: {
    back: "← Retour à l'accueil",
    joinTitle: "Rejoignez la chaîne de solidarité.",
    joinIntro:
      "Donateurs\u00a0: un numéro de téléphone suffit. Structures et hôpitaux\u00a0: un e-mail professionnel et votre récépissé ou agrément.",
    tabDonor: "Donateur",
    tabOrganization: "Structure ou hôpital",
    login: {
      donorTitle: "Bon retour parmi nous",
      donorIntro: "Connectez-vous avec votre numéro et votre mot de passe.",
      orgTitle: "Connexion structure ou hôpital",
      orgIntro:
        "Connectez-vous avec votre e-mail professionnel et votre mot de passe. Un code de vérification sera envoyé au téléphone du responsable.",
      submit: "Se connecter",
      noAccount: "Pas encore de compte\u00a0?",
      createAccount: "Créer un compte",
      privacy: "Vos données sont chiffrées et ne sont jamais revendues.",
    },
    signup: {
      donorTitle: "Créer un compte donateur",
      donorIntro: "Trente secondes, sans carte bancaire. Votre numéro sera confirmé par SMS.",
      orgTitle: "Inscrire ma structure",
      orgIntro: "Votre dossier sera vérifié par notre équipe avant la publication de vos causes.",
      hasAccount: "Déjà inscrit\u00a0?",
      terms: "En continuant, vous acceptez les conditions d’utilisation de SUNUSOCIAL.",
      sendCode: "Recevoir le code par SMS",
      submitOrg: "Envoyer mon dossier",
      orgPasswordHint: "12 caractères minimum · double authentification par SMS à chaque connexion",
      donorPasswordHint: "8 caractères minimum",
      hospitalNote:
        "Les hôpitaux ne créent pas de cagnotte\u00a0: ils publient des alertes quand un groupe sanguin manque, envoyées aux donneurs compatibles autour d'eux.",
      sent: {
        title: "Dossier envoyé",
        body: "Vérification par notre équipe en cours. Vous recevrez un SMS dès que votre structure sera validée.",
        login: "Aller à la connexion",
      },
    },
    fields: {
      fullName: "Prénom et nom",
      phone: "Numéro de téléphone",
      phonePlaceholder: "77 123 45 67",
      password: "Mot de passe",
      newPassword: "Nouveau mot de passe",
      email: "E-mail professionnel",
      organizationName: "Nom de la structure",
      structureType: "Type de structure",
      responsiblePhone: "Téléphone du responsable",
      receipt: "Récépissé ministériel ou agrément (PDF ou image)",
      receiptHint: "PDF, JPG ou PNG · 5 Mo max.",
      payoutTitle: "Compte de réception des fonds",
      payoutNumber: "Numéro du compte",
      holderName: "Nom du responsable",
      payoutHint:
        "Les fonds de vos causes seront versés sur ce numéro. Il sera confirmé par un code SMS, puis vérifié par notre équipe.",
      code: "Code reçu par SMS",
    },
    blood: {
      title: "Profil don de sang (facultatif)",
      optIn: "Je veux recevoir les alertes de don de sang",
      hint: "Pour recevoir les alertes des hôpitaux proches quand votre groupe sanguin est recherché.",
      bloodType: "Groupe sanguin",
      sms: "Recevoir aussi les alertes par SMS",
    },
    otp: {
      sentTo: (to: string) => `Un code à 6 chiffres a été envoyé par SMS au ${to}.`,
      verify: "Vérifier le code et continuer",
      validate: "Valider",
      resend: "Renvoyer le code",
      resendIn: (seconds: number) => `Renvoyer le code dans ${seconds}\u00a0s`,
      mfaTitle: "Vérification en deux étapes",
      mfaIntro: "Pour protéger votre espace, saisissez le code reçu sur le téléphone du compte.",
    },
    reset: {
      title: "Mot de passe oublié",
      donorIntro: "Saisissez votre numéro\u00a0: nous vous envoyons un code par SMS.",
      orgIntro: "Saisissez votre e-mail\u00a0: nous vous envoyons un lien valable 30 minutes.",
      submitDonor: "Changer mon mot de passe",
      sendLink: "Recevoir le lien",
      linkSent:
        "Si un compte correspond à cette adresse, un lien vient d'être envoyé. Il est valable 30 minutes et utilisable une seule fois.",
      newTitle: "Choisir un nouveau mot de passe",
      done: "Mot de passe changé. Toutes vos sessions ont été fermées.",
      doneOrg: "Mot de passe changé. Le code SMS vous sera demandé à la prochaine connexion.",
    },
    logout: "Déconnexion",
  },

  moderation: {
    title: "SUNUSOCIAL — Modération",
    badge: "PLATEFORME DE MODÉRATION",
    loginTitle: "Connexion",
    loginIntro: "Accès réservé à l'équipe SUNUSOCIAL.",
    email: "Adresse e-mail",
    footer: "Connexion journalisée · double authentification activée",
    queuesTitle: "Files de modération",
    queuesSoon: "Les files (inscriptions, causes, preuves…) arrivent au sprint 5.",
  },

  spaces: {
    donorTitle: "Fil des causes",
    donorSoon: "Le fil des causes arrive au sprint 3.",
    structureTitle: "Espace structure",
    hospitalTitle: "Espace hôpital",
    pending:
      "Votre dossier est en cours de vérification par notre équipe. Vous ne pouvez pas encore publier.",
    refused: (reason: string) => `Votre dossier a été refusé\u00a0: ${reason}`,
    approved: "Structure vérifiée.",
    hello: (name: string) => `Bonjour ${name}`,
  },

  sms: {
    code: (code: string) =>
      `SUNUSOCIAL\u00a0: votre code est ${code}. Il expire dans 10 minutes. Ne le communiquez à personne.`,
  },

  email: {
    resetSubject: "SUNUSOCIAL — Réinitialisation de votre mot de passe",
    resetBody: (link: string) =>
      `Bonjour,\n\nPour choisir un nouveau mot de passe, ouvrez ce lien (valable 30 minutes, utilisable une seule fois)\u00a0:\n${link}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message.\n\nL'équipe SUNUSOCIAL`,
    welcomeModeratorSubject: "SUNUSOCIAL — Votre accès modérateur",
    welcomeModeratorBody: (link: string) =>
      `Bonjour,\n\nUn accès modérateur SUNUSOCIAL a été créé pour vous. Choisissez votre mot de passe avec ce lien (valable 30 minutes)\u00a0:\n${link}\n\nL'équipe SUNUSOCIAL`,
  },

  errors: {
    generic: "Une erreur est survenue. Veuillez réessayer.",
    network: "Connexion impossible. Vérifiez votre réseau et réessayez.",
    required: "Ce champ est obligatoire.",
    invalidPhone: "Numéro de téléphone invalide.",
    invalidRegion: "Choisissez une région de la liste.",
    invalidCommune: "Choisissez une commune de la région.",
    amountTooLow: (min: string) => `Le don minimum est de ${min}.`,
    amountNotInteger: "Le montant doit être un nombre entier de FCFA.",
    invalidEmail: "Adresse e-mail invalide.",
    invalidName: "Saisissez un nom de 2 à 120 caractères.",
    passwordTooShort: (min: number) => `Le mot de passe doit comporter au moins ${min} caractères.`,
    phoneTaken: "Ce numéro est déjà utilisé.",
    emailTaken: "Cette adresse e-mail est déjà utilisée.",
    otpInvalid: "Code incorrect ou expiré.",
    otpLocked: "Trop d'essais. Demandez un nouveau code.",
    otpRateLimited: "Trop de codes demandés. Réessayez dans quelques minutes.",
    otpCooldown: (seconds: number) => `Patientez ${seconds}\u00a0s avant de redemander un code.`,
    invalidCredentials: "Identifiant ou mot de passe incorrect.",
    tooManyAttempts: "Trop de tentatives. Réessayez dans quelques minutes.",
    notAuthenticated: "Connectez-vous pour continuer.",
    forbidden: "Vous n'avez pas accès à cette page.",
    mfaRequired: "Saisissez le code reçu par SMS pour continuer.",
    accountDisabled: "Ce compte est bloqué. Contactez SUNUSOCIAL sur WhatsApp.",
    receiptRequired: "Ajoutez votre récépissé ou agrément.",
    receiptInvalid: "Le document doit être un PDF, JPG ou PNG de 5 Mo maximum.",
    payoutRequired: "Indiquez le compte de réception des fonds.",
    resetLinkInvalid: "Ce lien est invalide ou a expiré. Demandez-en un nouveau.",
    rateLimited: "Trop de demandes. Réessayez dans quelques minutes.",
  },
} as const;

export type Strings = typeof fr;
