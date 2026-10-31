# Single source for the SUNUSOCIAL flow chart (French).
# Step forms:
#   M(frm, to, text, btn=None)   arrow from one lane to another (frm == to: action inside a lane)
#   ALT(by, [(label, [steps]), ...])   decision with branches
#   GAP(id)                       undecided point (details in GAPS)
#   NOTE(text)                    rule reminder spanning the scenario

LANES = [
    ("D", "Donateur"),
    ("S", "Structure"),
    ("Y", "Système"),      # plateforme + NabooPay + SMS + tâches automatiques
    ("M", "Modérateur"),
    ("H", "Hôpital"),
]

def M(frm, to, text, btn=None):
    return {"k": "msg", "frm": frm, "to": to, "t": text, "btn": btn}

def ALT(by, branches):
    return {"k": "alt", "by": by, "br": [{"label": l, "steps": s} for l, s in branches]}

def GAP(gid):
    return {"k": "gap", "id": gid}

def NOTE(text):
    return {"k": "note", "t": text}

def SC(sid, group, title, steps, pre=None):
    return {"id": sid, "group": group, "title": title, "pre": pre, "steps": steps}

SCENARIOS = [
    # ------------------------------------------------------------------ A. Comptes
    SC("S01", "Comptes", "Visiteur non connecté", [
        M("D", "Y", "Ouvre l'accueil public : comment ça marche + fil public des preuves validées (sans compte)"),
        M("D", "Y", "Ouvre le lien d'une cause sans être connecté"),
        M("Y", "D", "Redirige vers la connexion : il faut un compte pour voir les causes et donner"),
        M("D", "Y", "Choisit un parcours", "Créer mon compte / Inscrire ma structure"),
    ]),
    SC("S02", "Comptes", "Inscription d'un donateur (numéro vérifié par SMS)", [
        M("D", "D", "Saisit prénom et nom, téléphone, mot de passe, et en option son profil don de sang (groupe ou « Je ne sais pas », région, commune)"),
        M("D", "Y", "Demande le code", "Recevoir le code par SMS"),
        M("Y", "D", "Envoie un code à 6 chiffres par SMS, valable 10 min"),
        ALT("D", [
            ("Code correct", [
                M("D", "Y", "Valide le code", "Vérifier le code et continuer"),
                M("Y", "Y", "Crée le compte (numéro vérifié) et enregistre l'inscription dans l'historique d'activité"),
                M("Y", "D", "Session ouverte pour 7 jours, arrive sur le fil des causes"),
            ]),
            ("Code faux ou expiré", [
                M("Y", "D", "« Code incorrect ou expiré » (5 essais au maximum)"),
                M("D", "Y", "Redemande un code après 60 s (3 fois max. en 10 min, 10 par jour)", "Renvoyer le code"),
            ]),
            ("Numéro déjà inscrit", [
                M("Y", "D", "Pas de code : un SMS « Un compte existe déjà avec ce numéro » invite à se connecter ou à utiliser « Mot de passe oublié » (l'écran ne révèle pas si le numéro est inscrit)"),
            ]),
        ]),
    ]),
    SC("S03", "Comptes", "Connexion d'un donateur, session et déconnexion", [
        M("D", "Y", "Téléphone + mot de passe, sans code SMS", "Se connecter"),
        ALT("Y", [
            ("Identifiants corrects", [
                M("Y", "D", "Session ouverte 7 jours, connexion enregistrée dans l'historique"),
            ]),
            ("Identifiants faux", [
                M("Y", "D", "« Numéro ou mot de passe incorrect » (5 essais par 10 min, puis attente)"),
            ]),
        ]),
        M("Y", "D", "Au bout de 7 jours, la session expire : retour à la connexion"),
        M("D", "Y", "Ferme sa session", "Déconnexion"),
    ]),
    SC("S04", "Comptes", "Mot de passe oublié", [
        M("D", "Y", "Saisit son numéro", "Mot de passe oublié ?"),
        M("Y", "D", "Envoie un code SMS au numéro vérifié (même message que le compte existe ou non)"),
        M("D", "Y", "Saisit le code + un nouveau mot de passe", "Changer mon mot de passe"),
        M("Y", "D", "Mot de passe changé, toutes ses sessions fermées, action enregistrée"),
        M("S", "Y", "Structure, hôpital ou modérateur : saisit son e-mail", "Mot de passe oublié ?"),
        M("Y", "S", "Envoie un lien par e-mail, valable 30 min et utilisable une seule fois"),
        M("S", "Y", "Choisit un nouveau mot de passe (12 caractères min.) ; le code SMS sera demandé à la prochaine connexion"),
    ]),
    SC("S05", "Comptes", "Connexion d'une structure, d'un hôpital ou d'un modérateur (double authentification)", [
        M("S", "Y", "E-mail + mot de passe (les modérateurs se connectent sur l'adresse de modération)", "Se connecter"),
        M("Y", "S", "Envoie un code SMS au téléphone du compte"),
        ALT("S", [
            ("Code correct", [
                M("S", "Y", "Valide le code", "Valider"),
                M("Y", "S", "Accès à son espace pour 7 jours au maximum"),
            ]),
            ("Code faux", [
                M("Y", "S", "« Code incorrect ou expiré » (5 essais), possibilité de renvoyer le code"),
            ]),
        ]),
        NOTE("Même parcours pour l'hôpital et pour le modérateur."),
    ]),
    SC("S06", "Comptes", "Notifications dans l'application", [
        M("Y", "D", "Chaque événement important arrive dans la cloche (et par SMS pour les plus importants)"),
        M("D", "Y", "Ouvre une notification et va directement à l'écran concerné", "Voir"),
        M("D", "Y", "Marque tout comme lu", "Tout marquer comme lu"),
    ]),
    SC("S07", "Comptes", "Supprimer son compte donateur", [
        M("D", "Y", "Demande la suppression de son compte", "Supprimer mon compte"),
        GAP("G11"),
    ]),
    SC("S08", "Comptes", "Bloquer un compte pour fraude", [
        M("M", "Y", "Bloque un compte suspect", "Bloquer le compte"),
        GAP("G12"),
    ]),

    # ------------------------------------------------------------------ B. Structures & hôpitaux
    SC("S09", "Structures et hôpitaux", "Inscription d'une structure (phase 1) et validation", [
        M("S", "S", "Saisit nom, type, région et commune, e-mail, téléphone du responsable, mot de passe, récépissé (PDF/JPG/PNG, 5 Mo)"),
        M("S", "S", "Compte de réception : choisit Orange Money ou Wave, numéro et nom du responsable"),
        M("S", "Y", "Demande les codes de vérification", "Recevoir le code par SMS"),
        M("Y", "S", "Envoie un code au téléphone du responsable (il recevra le code de chaque connexion) et, si c'est un autre numéro, un code au numéro de versement"),
        M("S", "Y", "Saisit le ou les deux codes : les numéros sont prouvés, le récépissé est envoyé", "Envoyer mon dossier"),
        M("Y", "S", "« Dossier envoyé, vérification en cours » : ne peut pas encore publier"),
        M("Y", "M", "Nouvelle ligne dans « Inscriptions à valider » (récépissé affiché + infos + compte de versement)"),
        ALT("M", [
            ("Valider", [
                M("M", "Y", "Valide les documents et le compte de versement", "Valider"),
                M("Y", "S", "« Structure vérifiée » par SMS : peut créer des causes, badge Vérifié"),
            ]),
            ("Refuser (raison obligatoire)", [
                M("M", "Y", "Saisit la raison du refus", "Refuser"),
                M("Y", "S", "Voit le refus et la raison"),
                GAP("G5"),
            ]),
        ]),
        NOTE("La phase 2 (informations complètes de la structure) est en attente de décision du bureau (Q5)."),
    ]),
    SC("S10", "Structures et hôpitaux", "Inscription d'un hôpital et validation", [
        M("H", "H", "Saisit nom, type « Hôpital », région et commune, e-mail, téléphone, mot de passe, agrément du ministère de la Santé (pas de compte de versement)"),
        M("H", "Y", "Demande le code de vérification du téléphone du responsable", "Recevoir le code par SMS"),
        M("Y", "H", "Envoie un code SMS à ce numéro (il recevra le code de chaque connexion)"),
        M("H", "Y", "Saisit le code et envoie son dossier", "Envoyer mon dossier"),
        M("Y", "M", "Nouvelle ligne dans « Inscriptions à valider », étiquette DON DE SANG"),
        ALT("M", [
            ("Valider", [
                M("M", "Y", "Valide l'agrément", "Valider"),
                M("Y", "H", "« Hôpital vérifié » : peut publier des alertes"),
            ]),
            ("Refuser (raison obligatoire)", [
                M("M", "Y", "Saisit la raison", "Refuser"),
                M("Y", "H", "Voit le refus et la raison"),
                GAP("G5"),
            ]),
        ]),
    ]),
    SC("S11", "Structures et hôpitaux", "Changer de compte de réception des fonds", [
        M("S", "S", "Saisit le nouveau moyen (Orange Money ou Wave), numéro et nom", "Modifier le compte de versement"),
        M("Y", "S", "Envoie un code SMS au nouveau numéro"),
        M("S", "Y", "Valide le code", "Vérifier le code"),
        M("Y", "Y", "Bloque tous les versements de la structure en attendant la décision, et l'enregistre dans l'historique"),
        M("Y", "M", "Demande de changement à vérifier"),
        ALT("M", [
            ("Approuver", [
                M("M", "Y", "Approuve le nouveau compte", "Approuver"),
                M("Y", "S", "Nouveau compte actif, versements débloqués"),
            ]),
            ("Refuser (raison obligatoire)", [
                M("M", "Y", "Saisit la raison", "Refuser"),
                M("Y", "S", "Refus + raison, l'ancien compte reste actif et les versements reprennent"),
            ]),
        ]),
    ]),

    # ------------------------------------------------------------------ C. Causes
    SC("S12", "Causes", "Créer une cause et la faire modérer", [
        M("S", "S", "Bannière, titre, description, catégorie (Santé, Alimentation, Matériel), fin à une date ou à un objectif, date limite (30 jours max.), montant, urgence, avec le net estimé affiché", "Créer une cause"),
        M("S", "Y", "Soumet la cause", "Soumettre"),
        M("Y", "S", "Statut « En modération »"),
        M("Y", "M", "Nouvelle ligne dans « Causes à modérer », affichée comme les donateurs la verront"),
        ALT("M", [
            ("Approuver", [
                M("M", "Y", "Approuve", "Approuver"),
                M("Y", "S", "Statut « Active » + notification"),
                M("Y", "D", "La cause apparaît dans le fil des causes"),
            ]),
            ("Refuser (raison obligatoire)", [
                M("M", "Y", "Saisit la raison", "Refuser"),
                M("Y", "S", "Statut « Refusée » + raison affichée"),
                GAP("G6"),
            ]),
        ]),
        NOTE("Une structure suspendue ne peut pas créer de cause (voir S28)."),
    ]),
    SC("S13", "Causes", "Retirer une cause encore en modération", [
        M("S", "Y", "Retire la cause (aucun don n'est encore possible)", "Supprimer"),
        M("Y", "S", "« Cause retirée de la modération », sans passer par le modérateur"),
        M("Y", "M", "La cause disparaît de la file « Causes à modérer »"),
    ]),
    SC("S14", "Causes", "Modifier une cause", [
        ALT("S", [
            ("Cause en modération", [
                M("S", "Y", "Modifie librement", "Modifier"),
                M("Y", "M", "Le modérateur voit la version à jour"),
            ]),
            ("Cause active", [
                M("S", "Y", "Ouvre la modification", "Modifier"),
                GAP("G7"),
            ]),
        ]),
    ]),
    SC("S15", "Causes", "Choisir le Coup de cœur de la semaine", [
        M("M", "Y", "Choisit une cause active", "Choisir comme Coup de cœur"),
        M("Y", "Y", "Remplace le Coup de cœur précédent (une seule cause à la fois)"),
        M("Y", "D", "La cause apparaît en tête du fil, dans l'encadré Coup de cœur"),
        M("M", "Y", "Retire le Coup de cœur", "Retirer"),
        M("Y", "D", "L'encadré disparaît du fil"),
    ]),
    SC("S16", "Causes", "Prolonger une cause", [
        M("S", "S", "Choisit une nouvelle date (30 jours de plus au maximum) et explique pourquoi", "Prolonger"),
        M("S", "Y", "Envoie la demande", "Envoyer la demande au modérateur"),
        M("Y", "S", "« Demande de prolongation envoyée, en attente »"),
        M("Y", "M", "Nouvelle ligne dans « Demandes de prolongation »"),
        ALT("M", [
            ("Accorder", [
                M("M", "Y", "Accorde", "Accorder"),
                M("Y", "S", "Nouvelle date limite appliquée"),
                M("Y", "D", "Les donateurs de la cause sont informés de la nouvelle date (les fonds restent bloqués plus longtemps)"),
            ]),
            ("Refuser (raison obligatoire)", [
                M("M", "Y", "Saisit la raison", "Refuser"),
                M("Y", "S", "Refus + raison, la date limite ne change pas"),
            ]),
        ]),
        GAP("G3"),
    ]),
    SC("S17", "Causes", "Demander la suppression d'une cause publiée", [
        M("S", "S", "Explique pourquoi (5 caractères min.)", "Supprimer"),
        M("S", "Y", "Envoie la demande", "Envoyer la demande au modérateur"),
        M("Y", "S", "« Demande de suppression envoyée, en attente »"),
        GAP("G2"),
        M("Y", "M", "Nouvelle ligne dans « Demandes de suppression », avec le montant collecté et le nombre de donateurs"),
        ALT("M", [
            ("Maintenir la cause (raison obligatoire)", [
                M("M", "Y", "Refuse la suppression et explique (10 caractères min.)", "Maintenir la cause"),
                M("Y", "S", "La cause continue, avec la raison du modérateur"),
            ]),
            ("Supprimer et rembourser les donateurs", [
                M("M", "Y", "Approuve la suppression, choisit de rembourser et explique", "Supprimer · Rembourser les donateurs"),
                M("Y", "Y", "Cause supprimée, chaque don est remboursé au montant net par un versement NabooPay vers le numéro du donateur"),
                M("Y", "D", "Chaque donateur voit : cause supprimée, motif, X FCFA remboursés (notification + SMS)"),
                M("Y", "S", "Cause supprimée, motif affiché"),
            ]),
            ("Supprimer et verser à la structure", [
                M("M", "Y", "Approuve la suppression, choisit de verser les fonds et explique", "Supprimer · Verser à la structure"),
                M("Y", "Y", "Versement unique du montant net sur le compte de la structure (voir S22)"),
                M("Y", "D", "Chaque donateur voit : cause supprimée, motif, fonds versés à la structure"),
                M("Y", "S", "Fonds versés, preuve obligatoire sous 7 jours (voir S25)"),
            ]),
        ]),
        NOTE("Si rien n'a été collecté, le modérateur choisit seulement Supprimer ou Maintenir."),
    ]),

    # ------------------------------------------------------------------ D. Dons
    SC("S18", "Dons", "Faire un don", [
        M("D", "Y", "Parcourt le fil : catégories, filtres Urgent, Presque atteint, Récent", "Voir plus"),
        M("Y", "D", "Fiche de la cause : bannière, structure vérifiée, progression, nombre de donateurs, date limite, causes similaires"),
        M("D", "D", "Ouvre la fenêtre de don, choisit 500, 1 000 ou 5 000 FCFA ou un montant libre (500 min.), et Orange Money ou Wave", "Faire un don"),
        M("Y", "D", "Affiche en direct les frais NabooPay (3 %) et le net que recevra la structure"),
        M("D", "Y", "Confirme", "Confirmer le don"),
        M("Y", "D", "Enregistre le don « en attente » puis ouvre la page de paiement NabooPay"),
        ALT("D", [
            ("Paiement réussi", [
                M("Y", "Y", "NabooPay confirme (notification signée, ou vérification au retour ou toutes les 10 min) : don « bloqué » avec les frais réels"),
                M("Y", "D", "Écran de remerciement, don ajouté à l'historique, notification « Don confirmé »"),
                M("Y", "S", "Le don apparaît dans le tableau de bord de la structure"),
                M("Y", "D", "La barre de progression avance en direct pour tous ceux qui regardent la cause"),
                NOTE("Si ce don atteint l'objectif : voir S21."),
            ]),
            ("Paiement abandonné ou échoué", [
                M("Y", "D", "Retour sur la cause, rien n'est compté"),
                M("Y", "Y", "Le paiement en attente est annulé automatiquement au bout de 2 h"),
            ]),
            ("Paiement confirmé après la clôture de la cause", [
                M("Y", "Y", "Le don n'est pas compté pour la cause : il est remboursé automatiquement au montant net sur le numéro du donateur"),
                M("Y", "D", "Message clair (notification + SMS) : la cause était déjà clôturée, montant remboursé, causes similaires"),
            ]),
        ]),
        M("D", "Y", "Pour un don en nature ou une question", "Nous contacter sur WhatsApp"),
        M("Y", "D", "Ouvre WhatsApp avec le numéro de SUNUSOCIAL"),
    ], pre="Donateur connecté, cause active"),
    SC("S19", "Dons", "Historique, impact et preuves (donateur)", [
        M("D", "Y", "Ouvre son profil", "Mon profil"),
        M("Y", "D", "Historique des dons, total donné, « Vous avez contribué à 3 causes pour 12 500 FCFA », statut de chaque don"),
        M("D", "Y", "Ouvre le dossier d'une cause financée, quand il est validé", "Voir la preuve"),
        M("Y", "D", "Galerie (photos, vidéo, facture, bon de livraison), compte rendu et utilisation des fonds"),
    ]),
    SC("S20", "Dons", "Demander un remboursement", [
        M("D", "D", "Sur un don dont les fonds ne sont pas encore versés : explique (5 caractères min.) et confirme le numéro qui recevra le remboursement", "Demander un remboursement"),
        M("D", "Y", "Envoie la demande", "Envoyer la demande"),
        M("Y", "D", "« Demande envoyée, un modérateur décidera »"),
        M("Y", "M", "Nouvelle ligne dans « Demandes de remboursement », avec le montant net qui serait rendu"),
        GAP("G1"),
        ALT("M", [
            ("Rembourser", [
                M("M", "Y", "Accepte (décision définitive)", "Rembourser"),
                M("Y", "Y", "Versement du montant net (don moins frais NabooPay) vers le numéro du donateur"),
                M("Y", "D", "« X FCFA remboursés » par notification + SMS"),
                M("Y", "S", "Le montant collecté de la cause diminue d'autant"),
            ]),
            ("Refuser", [
                M("M", "Y", "Refuse (décision définitive)", "Refuser"),
                M("Y", "D", "« Demande refusée, le don reste affecté à la cause »"),
            ]),
        ]),
        NOTE("Une fois les fonds versés à la structure, le bouton disparaît."),
    ], pre="Don bloqué (fonds pas encore versés)"),

    # ------------------------------------------------------------------ E. Fin de cause et versements
    SC("S21", "Fin de cause et versements", "Objectif atteint", [
        M("Y", "Y", "Le don qui atteint l'objectif est accepté en entier, même s'il le dépasse"),
        M("Y", "Y", "La cause passe à « Clôturée » : plus aucun don possible"),
        M("Y", "D", "La fiche affiche « Objectif atteint »"),
        M("Y", "Y", "Lance le versement de la cause (voir S22)"),
    ]),
    SC("S22", "Fin de cause et versements", "Versement à la structure", [
        M("Y", "Y", "Ajoute un versement unique du montant net à la file (un seul versement à la fois chez NabooPay), après avoir vérifié le solde du compte NabooPay"),
        ALT("Y", [
            ("Versement réussi", [
                M("Y", "S", "« Fonds versés : X FCFA sur votre compte Orange Money ou Wave » (SMS) + preuve due sous 7 jours"),
                M("Y", "D", "Les donateurs voient « Fonds versés à la structure »"),
            ]),
            ("Plus de 2 000 000 FCFA", [
                M("Y", "S", "« Versement en vérification chez NabooPay », le délai peut être de quelques jours"),
                M("Y", "M", "Le versement apparaît « En vérification » dans le suivi des versements"),
            ]),
            ("Échec ou réponse inconnue", [
                M("Y", "Y", "Ne renvoie jamais automatiquement, vérifie d'abord chez NabooPay si l'argent est parti"),
                M("Y", "M", "Alerte dans le suivi des versements"),
                GAP("G10"),
            ]),
        ]),
        NOTE("Si un changement de compte de versement est en attente, le versement attend (voir S11)."),
    ]),
    SC("S23", "Fin de cause et versements", "Date limite atteinte", [
        M("Y", "Y", "Vérification toutes les heures des causes dont la date limite est passée"),
        ALT("Y", [
            ("Des dons ont été collectés", [
                M("Y", "Y", "Cause clôturée et tout le montant collecté versé, même à 1 % de l'objectif (voir S22)"),
                M("Y", "D", "La fiche affiche « Terminée »"),
            ]),
            ("Aucun don", [
                GAP("G9"),
            ]),
        ]),
        GAP("G3"),
    ]),

    # ------------------------------------------------------------------ F. Preuves et suspensions
    SC("S24", "Preuves", "Publier la preuve", [
        M("S", "S", "Ajoute au moins 5 fichiers (photos, vidéo jusqu'à 50 Mo et 90 s, facture, bon de livraison), un compte rendu et le détail des dépenses", "Publier la preuve"),
        M("S", "Y", "Envoie le dossier", "Envoyer la preuve"),
        M("Y", "Y", "Contrôles automatiques : photo déjà publiée ailleurs, date de la photo, facture réutilisée, total différent du montant reçu"),
        M("Y", "S", "« Preuve envoyée, en attente de validation »"),
        M("Y", "M", "Nouvelle ligne dans « Preuves à valider », avec les éléments signalés en rouge, affichée comme les donateurs la verront"),
        ALT("M", [
            ("Valider", [
                M("M", "Y", "Valide", "Valider la preuve"),
                M("Y", "D", "Chaque donateur de la cause peut ouvrir le dossier (notification + SMS)"),
                M("Y", "D", "Le dossier apparaît dans le fil public de l'accueil"),
                M("Y", "S", "« Preuve validée », échéance respectée"),
            ]),
            ("Dossier insuffisant", [
                M("M", "Y", "Demande des compléments", "Demander des compléments"),
                GAP("G8"),
            ]),
        ]),
    ], pre="Fonds versés à la structure"),
    SC("S25", "Preuves", "Demander un délai pour la preuve (sursis)", [
        M("S", "S", "Choisit une nouvelle date et explique pourquoi", "Demander un délai"),
        M("S", "Y", "Envoie la demande", "Envoyer la demande au modérateur"),
        M("Y", "M", "Nouvelle ligne dans « Demandes de prolongation », étiquette DÉLAI DE PREUVE"),
        ALT("M", [
            ("Accorder", [
                M("M", "Y", "Accorde", "Accorder"),
                M("Y", "S", "Nouvelle échéance pour la preuve"),
            ]),
            ("Refuser (raison obligatoire)", [
                M("M", "Y", "Saisit la raison", "Refuser"),
                M("Y", "S", "Refus + raison, l'échéance ne change pas"),
            ]),
        ]),
    ]),
    SC("S26", "Preuves", "Preuve en retard : suspension automatique", [
        M("Y", "Y", "Chaque jour : une échéance de preuve est dépassée sans preuve validée"),
        M("Y", "S", "« Compte suspendu » (notification + e-mail) : plus de nouvelle cause"),
        M("Y", "D", "Les causes de la structure sont masquées (plus de nouveaux dons) jusqu'à la levée de la suspension"),
        M("Y", "M", "La structure apparaît « Compte suspendu » dans le suivi des preuves"),
        ALT("M", [
            ("Relancer", [
                M("M", "Y", "Envoie un rappel", "Relancer la structure"),
                M("Y", "S", "Rappel par SMS avec l'échéance"),
            ]),
            ("Lever la suspension", [
                M("M", "Y", "Lève la suspension, par exemple après validation de la preuve en retard", "Lever la suspension"),
                M("Y", "S", "Compte rétabli"),
            ]),
        ]),
    ]),

    # ------------------------------------------------------------------ G. Don de sang
    SC("S27", "Don de sang", "Profil don de sang du donateur", [
        M("D", "D", "Active « Je souhaite être alerté pour les dons de sang » (désactivé par défaut), choisit son groupe ou « Je ne sais pas », sa région puis sa commune, et les SMS", "Enregistrer"),
        M("Y", "Y", "Profil enregistré (donnée de santé, visible par lui seul), action dans l'historique"),
        M("D", "Y", "Peut tout désactiver à tout moment : il ne reçoit plus d'alerte", "Désactiver"),
        GAP("G16"),
    ]),
    SC("S28", "Don de sang", "L'hôpital émet une alerte", [
        M("H", "H", "Choisit les groupes recherchés, le nombre de poches, l'urgence et les communes de sa région", "Émettre une alerte"),
        M("Y", "H", "Aperçu : « X donneurs compatibles seront notifiés »"),
        M("H", "Y", "Envoie", "Envoyer l'alerte"),
        M("Y", "D", "Seuls les donneurs volontaires, compatibles et habitant ces communes reçoivent l'alerte (application + SMS), sans action obligatoire"),
        M("Y", "M", "L'alerte est visible dans la modération"),
        NOTE("20 alertes par heure au maximum par hôpital."),
    ]),
    SC("S29", "Don de sang", "Le donneur répond à une alerte", [
        M("D", "Y", "Choisit un créneau de passage", "Je peux donner"),
        M("D", "Y", "Confirme", "Confirmer ma venue"),
        M("Y", "H", "Nouveau donneur attendu : prénom et groupe seulement, jamais l'adresse"),
        M("Y", "D", "Rappel par SMS environ 2 h avant le créneau"),
        M("D", "Y", "Ne peut plus venir", "Annuler ma venue"),
        GAP("G14"),
        NOTE("L'aptitude au don est vérifiée sur place par le médecin. Un don récent n'empêche pas de recevoir des alertes."),
    ]),
    SC("S30", "Don de sang", "L'hôpital confirme les dons et gère son stock", [
        M("H", "Y", "Le donneur est venu et a donné", "Confirmer le don"),
        M("Y", "H", "Stock du groupe +1 poche, alerte : poches collectées +1"),
        M("H", "Y", "Corrige ses réserves à la main", "Modifier le stock"),
        NOTE("Un donneur qui ne vient pas n'est simplement pas confirmé."),
    ]),
    SC("S31", "Don de sang", "Clôturer une alerte et remercier", [
        M("H", "Y", "Objectif atteint ou besoin couvert", "Clôturer l'alerte"),
        M("Y", "D", "L'alerte disparaît pour les donneurs"),
        M("H", "Y", "Rédige son message de remerciement", "Envoyer le remerciement"),
        M("Y", "D", "Seuls les donneurs dont le don a été confirmé le reçoivent (application + SMS)"),
        M("M", "Y", "Ferme une alerte abusive ou erronée", "Clôturer l'alerte"),
        GAP("G13"),
    ]),
]

GAPS = {
    "G1": ("Demande de remboursement en attente au moment où la cause se termine",
           "La cause atteint son objectif ou sa date limite pendant qu'une demande de remboursement attend : les fonds partent et le remboursement devient impossible.",
           "Le versement de la cause attend que les demandes de remboursement en cours soient décidées (le modérateur a 48 h), puis part automatiquement."),
    "G2": ("Dons pendant une demande de suppression",
           "Faut-il continuer à accepter des dons sur une cause dont la structure demande la suppression ?",
           "La cause est mise en pause (plus de nouveaux dons, bandeau « En cours d'examen ») jusqu'à la décision du modérateur."),
    "G3": ("Demande de prolongation en attente à la date limite",
           "La date limite arrive avant que le modérateur ait décidé.",
           "Une demande envoyée avant la date limite la gèle jusqu'à la décision. Les demandes ne sont plus acceptées dans les 24 h qui précèdent la date limite."),
    "G5": ("Structure ou hôpital refusé : nouvelle tentative ?",
           "Après un refus, que peut faire la structure ?",
           "Elle corrige son dossier (documents, informations) et le renvoie. Il revient dans « Inscriptions à valider » avec l'historique des refus."),
    "G6": ("Cause refusée : correction et nouvel envoi ?",
           "Après un refus, la structure doit-elle tout recréer ?",
           "Un bouton « Modifier et renvoyer » remet la même cause en modération, avec la raison du refus précédent visible par le modérateur."),
    "G7": ("Modifier une cause déjà active",
           "Quels champs une structure peut-elle changer une fois la cause publiée, sachant que des donateurs ont donné sur cette base ?",
           "Seuls la description et la bannière sont modifiables, et la modification repasse en modération (l'ancienne version reste affichée en attendant). Montant, catégorie et date limite sont verrouillés (la date ne change que par une prolongation)."),
    "G8": ("Preuve jugée insuffisante",
           "Le statut « à revoir » existe, mais rien ne dit ce que la structure doit faire, ni dans quel délai.",
           "Le modérateur demande des compléments avec une raison. La structure complète et renvoie son dossier dans les 3 jours. Sinon, la suspension s'applique."),
    "G9": ("Cause sans aucun don à sa date limite",
           "Que devient une cause qui n'a rien collecté ?",
           "Elle est clôturée sans versement ni preuve à fournir. La structure est prévenue et peut la recréer."),
    "G10": ("Versement échoué",
            "Numéro de versement invalide, NabooPay indisponible ou solde insuffisant.",
            "Le versement passe « Échoué », le modérateur est alerté et la structure est invitée à vérifier son compte (changement de compte si besoin). Le modérateur relance le versement manuellement depuis le suivi."),
    "G11": ("Suppression du compte donateur",
            "La loi sur les données personnelles donne au donateur le droit d'effacer ses données. Rien n'est prévu.",
            "Le compte est fermé et anonymisé (nom, téléphone et profil sang effacés). Les dons restent dans la comptabilité sans identité. Impossible tant qu'une demande de remboursement est en cours."),
    "G12": ("Blocage d'un compte pour fraude",
            "Un champ « compte bloqué » existe, mais aucun parcours n'est défini.",
            "Le modérateur bloque le compte avec une raison : connexion impossible, causes en pause, versements gelés. Le sort des fonds est décidé comme une suppression (rembourser ou verser). Décision à valider par le bureau."),
    "G13": ("Alerte fermée par un modérateur",
            "L'hôpital est-il prévenu, et avec quelle explication ?",
            "Oui : l'hôpital reçoit la raison. Après 3 alertes fermées, son droit d'envoyer des alertes est revu par le modérateur."),
    "G14": ("Annuler sa venue pour un don de sang",
            "Un donneur qui a confirmé un créneau peut-il se désister ?",
            "Oui : « Annuler ma venue » retire son nom de la liste de l'hôpital, qui est prévenu."),
    "G16": ("Donneurs qui ne connaissent pas leur groupe sanguin",
            "Ils ne correspondent à aucune alerte ciblée par groupe.",
            "Ils ne reçoivent que les alertes marquées « Tous groupes » par l'hôpital, et voient un message les invitant à connaître leur groupe lors de leur premier don."),
}
