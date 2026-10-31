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
    main: "Navigation principale",
    causes: "Causes",
    profile: "Mon profil",
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
      responsiblePhoneHint:
        "Il sera confirmé par un code SMS, puis recevra un code à chaque connexion.",
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
      sentToBoth: (contact: string, payout: string) =>
        `Deux codes à 6 chiffres ont été envoyés par SMS\u00a0: au ${contact} (téléphone du responsable) et au ${payout} (compte de réception des fonds).`,
      contactCode: "Code reçu sur le téléphone du responsable",
      payoutCode: "Code reçu sur le numéro du compte",
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
    featuredLink: "Choisir le Coup de cœur de la semaine →",
  },

  /** 03 Accueil donateur. */
  feed: {
    hello: (firstName: string) => `Bonjour ${firstName} 👋`,
    intro: "Voici les besoins vérifiés qui attendent votre soutien aujourd'hui.",
    all: "Tous",
    categoriesLabel: "Catégories",
    refine: "Affiner\u00a0:",
    searchLabel: "Rechercher une cause",
    searchPlaceholder: "Rechercher une cause (ex.\u00a0: lait, fauteuils)",
    editorial: "Sélection éditoriale SUNUSOCIAL",
    seeCause: "Voir la cause →",
    loadMore: "Afficher plus de causes",
    empty: "Aucune cause ne correspond à ces filtres.",
    resetFilters: "Effacer les filtres",
    noCauses: "Aucune cause n'est ouverte pour le moment. Revenez bientôt\u00a0!",
    urgentTag: "URGENT",
    raisedOf: (raised: string, goal: string) => `${raised} collectés sur ${goal}`,
  },

  /** 04 Détail de la cause. */
  causeDetail: {
    back: "← Toutes les causes",
    category: (category: string) => `Catégorie\u00a0: ${category}`,
    urgency: (urgency: string) => `Urgence\u00a0: ${urgency}`,
    raised: "Collectés",
    goalOf: "sur un objectif de",
    reached: (percent: number) => `${percent}\u00a0% atteint`,
    donors: (count: number) => (count > 1 ? `${count} donateurs` : `${count} donateur`),
    endDate: (date: string) => `Se termine le ${date}`,
    endDateSub: (goal: string) =>
      `Objectif de ${goal} · les dons restent ouverts jusqu'à cette date.`,
    endGoal: (goal: string) => `Se termine à ${goal}`,
    endGoalSub: (date: string) => `ou le ${date} au plus tard, au premier des deux.`,
    daysLeft: (days: number) =>
      days <= 0 ? "Dernier jour" : days === 1 ? "Plus qu'un jour" : `Plus que ${days} jours`,
    closed: "Cette cause est clôturée. Merci à tous les donateurs\u00a0!",
    estimatedNet: (net: string) =>
      `Si l'objectif est atteint, la structure recevra environ ${net} après les frais de paiement.`,
    fundsRule: "RÈGLE VALIDÉE",
    fundsNote:
      "Les dons sont conservés par NabooPay puis versés à la structure à la fin de la cause\u00a0: à l'objectif ou à la date limite, au premier des deux.",
    paymentFailed:
      "Le paiement n'a pas abouti\u00a0: votre don n'a pas été compté. Vous pouvez réessayer.",
    similar: "Causes similaires",
    notFound: "Cette cause n'existe plus.",
    notFoundBack: "Voir les causes ouvertes",
  },

  /** 05 Modal de don (PARCOURS S18). */
  donation: {
    dialogLabel: (title: string) => `Faire un don pour «\u00a0${title}\u00a0»`,
    support: (organization: string) => `Soutenir · ${organization}`,
    close: "Fermer",
    amountLabel: "Montant de votre don",
    other: "Autre",
    otherLabel: "Montant libre en FCFA",
    otherPlaceholder: "Saisissez un montant",
    minimum: (min: string) => `Don minimum\u00a0: ${min}.`,
    methodLabel: "Moyen de paiement",
    yourGift: "Votre don",
    fee: (rate: string) => `Frais NabooPay (${rate})`,
    structureReceives: "La structure recevra",
    holdNote: (rate: string, net: string) =>
      `NabooPay prélève ${rate} → la structure recevra ${net} · conservé jusqu'à la fin de la cause.`,
    confirm: (amount: string) => `Confirmer le don · ${amount}`,
    redirecting: "Redirection vers le paiement…",
    secure: "Paiement sécurisé par NabooPay",
  },

  /** 05b Retour de paiement (success_url de NabooPay). */
  donationResult: {
    title: "Votre don",
    pendingTitle: "Confirmation du paiement…",
    pendingBody:
      "Nous attendons la confirmation de NabooPay. Cette page se met à jour toute seule, vous pouvez aussi revenir plus tard\u00a0: votre don apparaîtra dans votre profil.",
    heldTitle: "Merci\u00a0! Votre don est confirmé.",
    heldBody: (amount: string, method: string, title: string) =>
      `${amount} via ${method} pour «\u00a0${title}\u00a0». Les fonds restent bloqués jusqu'à la fin de la cause, puis sont versés à la structure. Vous serez prévenu dès qu'elle publiera sa preuve de réception.`,
    newProgress: "Nouvelle progression",
    progressOf: (raised: string, goal: string) => `${raised} / ${goal}`,
    lateTitle: "Cette cause était déjà clôturée",
    lateBody: (net: string) =>
      `Votre paiement est arrivé après la clôture de la cause\u00a0: il ne lui est pas compté. ${net} vous seront remboursés automatiquement sur votre numéro (votre don moins les frais NabooPay).`,
    failedTitle: "Le paiement n'a pas abouti",
    failedBody: "Rien n'a été compté. Vous pouvez réessayer depuis la page de la cause.",
    notFound: "Ce don est introuvable.",
    again: "Faire un autre don",
    browse: "Parcourir d'autres causes",
    history: "Voir mes dons",
    backToCause: "Retour à la cause",
  },

  /** Simulateur de paiement (PAYMENT_PROVIDER=mock, développement et préproduction). */
  simulator: {
    badge: "Simulateur · aucun argent réel",
    title: "Paiement simulé",
    intro:
      "Cette page remplace la page de paiement NabooPay en développement. «\u00a0Payer\u00a0» confirme le paiement comme le ferait NabooPay\u00a0; «\u00a0Annuler\u00a0» simule un abandon.",
    summary: (amount: string, method: string) => `${amount} via ${method}`,
    pay: "Payer",
    cancel: "Annuler",
    notPending: "Ce don n'attend plus de paiement.",
    seeDonation: "Voir le don",
  },

  /** 06 Profil donateur (PARCOURS S19). */
  profile: {
    title: "Mon profil",
    total: "Total donné",
    causes: "Causes soutenues",
    impact: (count: number, total: string) =>
      `Vous avez contribué à ${count} cause${count > 1 ? "s" : ""} pour un total de ${total}.`,
    history: "Mes donations",
    empty: "Vous n'avez pas encore fait de don.",
    emptyCta: "Découvrir les causes",
    loadMore: "Afficher plus",
    dateMethod: (date: string, method: string) => `${date} · ${method}`,
    proofValidated: (count: number) => `Preuve de réception validée · ${count} éléments`,
    proofPending: "En attente de preuve",
    lateRefund: (net: string) =>
      `Cause déjà clôturée à l'arrivée du paiement\u00a0: ${net} vous seront remboursés automatiquement.`,
  },

  notifications: {
    donationConfirmedTitle: "Don confirmé",
    donationConfirmedBody: (amount: string, title: string) =>
      `Votre don de ${amount} pour «\u00a0${title}\u00a0» est confirmé. Les fonds restent bloqués jusqu'à la fin de la cause.`,
    lateRefundTitle: "Cause déjà clôturée\u00a0: don remboursé",
    lateRefundBody: (amount: string, net: string, title: string) =>
      `La cause «\u00a0${title}\u00a0» était déjà clôturée quand votre paiement de ${amount} est arrivé. Il ne lui est pas compté\u00a0: ${net} (votre don moins les frais NabooPay) vous seront remboursés automatiquement sur votre numéro. Découvrez des causes similaires sur SUNUSOCIAL.`,
  },

  whatsapp: {
    contact: "Nous contacter sur WhatsApp",
    message: "Bonjour SUNUSOCIAL",
    aboutCause: (title: string) =>
      `Bonjour SUNUSOCIAL, je vous contacte au sujet de la cause «\u00a0${title}\u00a0».`,
    footer: "Un don en nature, une question\u00a0? Écrivez-nous sur WhatsApp.",
  },

  /** Moderation: S15 Choisir le Coup de cœur de la semaine (DB-6). */
  featuredPicker: {
    title: "Coup de cœur de la semaine",
    intro:
      "Choisissez une cause active à mettre en avant en tête du fil des donateurs. Une seule cause à la fois\u00a0: votre choix remplace le précédent.",
    current: "Coup de cœur actuel",
    none: "Aucun Coup de cœur pour le moment\u00a0: l'encadré est masqué dans le fil.",
    choose: "Choisir comme Coup de cœur",
    remove: "Retirer",
    isFeatured: "Coup de cœur",
    candidates: "Causes actives",
    noCandidates: "Aucune cause active pour le moment.",
    progress: (percent: number) => `${percent}\u00a0% atteint`,
    setDone: (title: string) => `«\u00a0${title}\u00a0» est le Coup de cœur de la semaine.`,
    clearDone: "Le Coup de cœur a été retiré.",
    backToQueues: "← Files de modération",
  },

  dates: {
    months: [
      "janvier",
      "février",
      "mars",
      "avril",
      "mai",
      "juin",
      "juillet",
      "août",
      "septembre",
      "octobre",
      "novembre",
      "décembre",
    ],
  },

  spaces: {
    donorTitle: "Fil des causes",
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
    accountExists:
      "SUNUSOCIAL\u00a0: un compte donateur existe déjà avec ce numéro. Connectez-vous, ou utilisez «\u00a0Mot de passe oublié\u00a0».",
    lateRefund: (title: string, net: string) =>
      `SUNUSOCIAL\u00a0: la cause «\u00a0${title}\u00a0» était déjà clôturée quand votre paiement est arrivé. ${net} vous seront remboursés sur ce numéro. Découvrez d'autres causes sur SUNUSOCIAL.`,
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
    smsUnavailable: "L'envoi de SMS est momentanément indisponible. Réessayez plus tard.",
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
    causeNotOpen: "Cette cause n'accepte plus de dons.",
    causeNotFound: "Cette cause n'existe plus.",
    donationNotFound: "Ce don est introuvable.",
    paymentUnavailable:
      "Le paiement est momentanément indisponible. Réessayez dans quelques minutes.",
    simulatorOff: "Le simulateur de paiement n'est pas disponible ici.",
    causeNotEligible:
      "Cette cause ne peut pas être choisie\u00a0: elle doit être active et publiée par une structure vérifiée.",
  },
} as const;

export type Strings = typeof fr;
