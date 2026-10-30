# SUNUSOCIAL — Parcours des utilisateurs

| | |
|---|---|
| **Date** | 29 octobre 2026 |
| **Pour** | JËFTECH et le bureau de SUNUSOCIAL |
| **Version interactive** | page partagée par JËFTECH (même contenu, avec recherche et filtre par rôle) |

Ce document décrit **tout ce qui va être développé**, sous la forme d'un seul schéma. Chaque colonne est un type d'utilisateur. Chaque flèche est une action ou une conséquence : on voit qui clique sur quoi, et ce que voient ensuite les autres utilisateurs. Les décisions du modérateur ouvrent des branches (« alt / else ») qui montrent chaque résultat possible.

**Les colonnes :** Donateur · Structure · **Système** (la plateforme, NabooPay, les SMS et les tâches automatiques comme les dates limites) · Modérateur · Hôpital.

**Les repères :** `▶ Bouton` indique le bouton cliqué. ⚠ **Gn** signale un point **non décidé** : la proposition de JËFTECH figure dans le tableau sous le schéma.

Le schéma couvre 31 scénarios, 76 boutons et 16 points à trancher.

## Le schéma complet

```mermaid
sequenceDiagram
  autonumber
  participant D as Donateur
  participant S as Structure
  participant Y as Système
  participant M as Modérateur
  participant H as Hôpital
  rect rgba(128, 128, 128, 0.08)
  Note over D,H: S01 · Visiteur non connecté
  D->>Y: Ouvre l'accueil public : comment ça marche +<br/>fil public des preuves validées (sans compte)
  D->>Y: Ouvre le lien d'une cause sans être connecté
  Y->>D: Redirige vers la connexion : il faut un compte<br/>pour voir les causes et donner
  D->>Y: ▶ Créer mon compte / Inscrire ma structure ·<br/>Choisit un parcours
  end
  rect rgba(128, 128, 128, 0.08)
  Note over D,H: S02 · Inscription d'un donateur (numéro vérifié par SMS)
  D->>D: Saisit prénom et nom, téléphone, mot de passe,<br/>et en option son profil don de sang (groupe ou<br/>« Je ne sais pas », région, commune)
  D->>Y: ▶ Recevoir le code par SMS · Demande le code
  Y->>D: Envoie un code à 6 chiffres par SMS, valable<br/>10 min
  alt Donateur · Code correct
    D->>Y: ▶ Vérifier le code et continuer · Valide le<br/>code
    Y->>Y: Crée le compte (numéro vérifié) et enregistre<br/>l'inscription dans l'historique d'activité
    Y->>D: Session ouverte pour 7 jours, arrive sur le<br/>fil des causes
  else Donateur · Code faux ou expiré
    Y->>D: « Code incorrect ou expiré » (5 essais au<br/>maximum)
    D->>Y: ▶ Renvoyer le code · Redemande un code après<br/>60 s (3 fois max. en 10 min, 10 par jour)
  else Donateur · Numéro déjà inscrit
    Y->>D: Pas de code : un SMS « Un compte existe déjà<br/>avec ce numéro » invite à se connecter ou à<br/>utiliser « Mot de passe oublié » (l'écran ne<br/>révèle pas si le numéro est inscrit)
  end
  end
  rect rgba(128, 128, 128, 0.08)
  Note over D,H: S03 · Connexion d'un donateur, session et déconnexion
  D->>Y: ▶ Se connecter · Téléphone + mot de passe,<br/>sans code SMS
  alt Système · Identifiants corrects
    Y->>D: Session ouverte 7 jours, connexion enregistrée<br/>dans l'historique
  else Système · Identifiants faux
    Y->>D: « Numéro ou mot de passe incorrect » (5 essais<br/>par 10 min, puis attente)
  end
  Y->>D: Au bout de 7 jours, la session expire : retour<br/>à la connexion
  D->>Y: ▶ Déconnexion · Ferme sa session
  end
  rect rgba(128, 128, 128, 0.08)
  Note over D,H: S04 · Mot de passe oublié
  D->>Y: ▶ Mot de passe oublié ? · Saisit son numéro
  Y->>D: Envoie un code SMS au numéro vérifié (même<br/>message que le compte existe ou non)
  D->>Y: ▶ Changer mon mot de passe · Saisit le code +<br/>un nouveau mot de passe
  Y->>D: Mot de passe changé, toutes ses sessions<br/>fermées, action enregistrée
  S->>Y: ▶ Mot de passe oublié ? · Structure, hôpital<br/>ou modérateur : saisit son e-mail
  Y->>S: Envoie un lien par e-mail, valable 30 min et<br/>utilisable une seule fois
  S->>Y: Choisit un nouveau mot de passe (12 caractères<br/>min.) , le code SMS sera demandé à la<br/>prochaine connexion
  end
  rect rgba(128, 128, 128, 0.08)
  Note over D,H: S05 · Connexion d'une structure, d'un hôpital ou d'un modérateur (double authentification)
  S->>Y: ▶ Se connecter · E-mail + mot de passe (les<br/>modérateurs se connectent sur l'adresse de<br/>modération)
  Y->>S: Envoie un code SMS au téléphone du compte
  alt Structure · Code correct
    S->>Y: ▶ Valider · Valide le code
    Y->>S: Accès à son espace pour 7 jours au maximum
  else Structure · Code faux
    Y->>S: « Code incorrect ou expiré » (5 essais),<br/>possibilité de renvoyer le code
  end
  Note over S,Y: Même parcours pour l'hôpital et pour le modérateur.
  end
  rect rgba(128, 128, 128, 0.08)
  Note over D,H: S06 · Notifications dans l'application
  Y->>D: Chaque événement important arrive dans la<br/>cloche (et par SMS pour les plus importants)
  D->>Y: ▶ Voir · Ouvre une notification et va<br/>directement à l'écran concerné
  D->>Y: ▶ Tout marquer comme lu · Marque tout comme lu
  end
  rect rgba(128, 128, 128, 0.08)
  Note over D,H: S07 · Supprimer son compte donateur
  D->>Y: ▶ Supprimer mon compte · Demande la<br/>suppression de son compte
  Note over D,Y: ⚠ G11 non décidé · Suppression du compte donateur
  end
  rect rgba(128, 128, 128, 0.08)
  Note over D,H: S08 · Bloquer un compte pour fraude
  M->>Y: ▶ Bloquer le compte · Bloque un compte suspect
  Note over Y,M: ⚠ G12 non décidé · Blocage d'un compte pour fraude
  end
  rect rgba(128, 128, 128, 0.08)
  Note over D,H: S09 · Inscription d'une structure (phase 1) et validation
  S->>S: Saisit nom, type, région et commune, e-mail,<br/>téléphone du responsable, mot de passe,<br/>récépissé (PDF/JPG/PNG, 5 Mo)
  S->>S: Compte de réception : choisit Orange Money ou<br/>Wave, numéro et nom du responsable
  S->>Y: ▶ Recevoir le code par SMS · Demande les<br/>codes de vérification
  Y->>S: Envoie un code au téléphone du responsable<br/>(il recevra le code de chaque connexion) et, si<br/>c'est un autre numéro, un code au numéro de<br/>versement
  S->>Y: ▶ Envoyer mon dossier · Saisit le ou les deux<br/>codes : les numéros sont prouvés, le récépissé<br/>est envoyé
  Y->>S: « Dossier envoyé, vérification en cours » : ne<br/>peut pas encore publier
  Y->>M: Nouvelle ligne dans « Inscriptions à valider »<br/>(récépissé affiché + infos + compte de<br/>versement)
  alt Modérateur · Valider
    M->>Y: ▶ Valider · Valide les documents et le compte<br/>de versement
    Y->>S: « Structure vérifiée » par SMS : peut créer<br/>des causes, badge Vérifié
  else Modérateur · Refuser (raison obligatoire)
    M->>Y: ▶ Refuser · Saisit la raison du refus
    Y->>S: Voit le refus et la raison
    Note over S,M: ⚠ G5 non décidé · Structure ou hôpital refusé : nouvelle tentative ?
  end
  Note over S,M: La phase 2 (informations complètes de la structure) est en attente de<br/>décision du bureau (Q5).
  end
  rect rgba(128, 128, 128, 0.08)
  Note over D,H: S10 · Inscription d'un hôpital et validation
  H->>H: Saisit nom, type « Hôpital », région et<br/>commune, e-mail, téléphone, mot de passe,<br/>agrément du ministère de la Santé (pas de<br/>compte de versement)
  H->>Y: ▶ Recevoir le code par SMS · Demande le code<br/>de vérification du téléphone du responsable
  Y->>H: Envoie un code SMS à ce numéro (il recevra<br/>le code de chaque connexion)
  H->>Y: ▶ Envoyer mon dossier · Saisit le code et<br/>envoie son dossier
  Y->>M: Nouvelle ligne dans « Inscriptions à valider<br/>», étiquette DON DE SANG
  alt Modérateur · Valider
    M->>Y: ▶ Valider · Valide l'agrément
    Y->>H: « Hôpital vérifié » : peut publier des alertes
  else Modérateur · Refuser (raison obligatoire)
    M->>Y: ▶ Refuser · Saisit la raison
    Y->>H: Voit le refus et la raison
    Note over Y,H: ⚠ G5 non décidé · Structure ou hôpital refusé : nouvelle tentative ?
  end
  end
  rect rgba(128, 128, 128, 0.08)
  Note over D,H: S11 · Changer de compte de réception des fonds
  S->>S: ▶ Modifier le compte de versement · Saisit le<br/>nouveau moyen (Orange Money ou Wave), numéro<br/>et nom
  Y->>S: Envoie un code SMS au nouveau numéro
  S->>Y: ▶ Vérifier le code · Valide le code
  Y->>Y: Bloque tous les versements de la structure en<br/>attendant la décision, et l'enregistre dans<br/>l'historique
  Y->>M: Demande de changement à vérifier
  alt Modérateur · Approuver
    M->>Y: ▶ Approuver · Approuve le nouveau compte
    Y->>S: Nouveau compte actif, versements débloqués
  else Modérateur · Refuser (raison obligatoire)
    M->>Y: ▶ Refuser · Saisit la raison
    Y->>S: Refus + raison, l'ancien compte reste actif et<br/>les versements reprennent
  end
  end
  rect rgba(128, 128, 128, 0.08)
  Note over D,H: S12 · Créer une cause et la faire modérer
  S->>S: ▶ Créer une cause · Bannière, titre,<br/>description, catégorie (Santé, Alimentation,<br/>Matériel), fin à une date ou à un objectif,<br/>date limite (30 jours max.), montant, urgence,<br/>avec le net estimé affiché
  S->>Y: ▶ Soumettre · Soumet la cause
  Y->>S: Statut « En modération »
  Y->>M: Nouvelle ligne dans « Causes à modérer »,<br/>affichée comme les donateurs la verront
  alt Modérateur · Approuver
    M->>Y: ▶ Approuver · Approuve
    Y->>S: Statut « Active » + notification
    Y->>D: La cause apparaît dans le fil des causes
  else Modérateur · Refuser (raison obligatoire)
    M->>Y: ▶ Refuser · Saisit la raison
    Y->>S: Statut « Refusée » + raison affichée
    Note over D,M: ⚠ G6 non décidé · Cause refusée : correction et nouvel envoi ?
  end
  Note over D,M: Une structure suspendue ne peut pas créer de cause (voir S28).
  end
  rect rgba(128, 128, 128, 0.08)
  Note over D,H: S13 · Retirer une cause encore en modération
  S->>Y: ▶ Supprimer · Retire la cause (aucun don n'est<br/>encore possible)
  Y->>S: « Cause retirée de la modération », sans<br/>passer par le modérateur
  Y->>M: La cause disparaît de la file « Causes à<br/>modérer »
  end
  rect rgba(128, 128, 128, 0.08)
  Note over D,H: S14 · Modifier une cause
  alt Structure · Cause en modération
    S->>Y: ▶ Modifier · Modifie librement
    Y->>M: Le modérateur voit la version à jour
  else Structure · Cause active
    S->>Y: ▶ Modifier · Ouvre la modification
    Note over S,M: ⚠ G7 non décidé · Modifier une cause déjà active
  end
  end
  rect rgba(128, 128, 128, 0.08)
  Note over D,H: S15 · Choisir le Coup de cœur de la semaine
  M->>Y: ▶ Choisir comme Coup de cœur · Choisit une<br/>cause active
  Y->>Y: Remplace le Coup de cœur précédent (une seule<br/>cause à la fois)
  Y->>D: La cause apparaît en tête du fil, dans<br/>l'encadré Coup de cœur
  M->>Y: ▶ Retirer · Retire le Coup de cœur
  Y->>D: L'encadré disparaît du fil
  end
  rect rgba(128, 128, 128, 0.08)
  Note over D,H: S16 · Prolonger une cause
  S->>S: ▶ Prolonger · Choisit une nouvelle date (30<br/>jours de plus au maximum) et explique pourquoi
  S->>Y: ▶ Envoyer la demande au modérateur · Envoie la<br/>demande
  Y->>S: « Demande de prolongation envoyée, en attente<br/>»
  Y->>M: Nouvelle ligne dans « Demandes de prolongation<br/>»
  alt Modérateur · Accorder
    M->>Y: ▶ Accorder · Accorde
    Y->>S: Nouvelle date limite appliquée
    Y->>D: Les donateurs de la cause sont informés de la<br/>nouvelle date (les fonds restent bloqués plus<br/>longtemps)
  else Modérateur · Refuser (raison obligatoire)
    M->>Y: ▶ Refuser · Saisit la raison
    Y->>S: Refus + raison, la date limite ne change pas
  end
  Note over D,M: ⚠ G3 non décidé · Demande de prolongation en attente à la date limite
  end
  rect rgba(128, 128, 128, 0.08)
  Note over D,H: S17 · Demander la suppression d'une cause publiée
  S->>S: ▶ Supprimer · Explique pourquoi (5 caractères<br/>min.)
  S->>Y: ▶ Envoyer la demande au modérateur · Envoie la<br/>demande
  Y->>S: « Demande de suppression envoyée, en attente »
  Note over D,M: ⚠ G2 non décidé · Dons pendant une demande de suppression
  Y->>M: Nouvelle ligne dans « Demandes de suppression<br/>», avec le montant collecté et le nombre de<br/>donateurs
  alt Modérateur · Maintenir la cause (raison obligatoire)
    M->>Y: ▶ Maintenir la cause · Refuse la suppression<br/>et explique (10 caractères min.)
    Y->>S: La cause continue, avec la raison du<br/>modérateur
  else Modérateur · Supprimer et rembourser les donateurs
    M->>Y: ▶ Supprimer · Rembourser les donateurs ·<br/>Approuve la suppression, choisit de rembourser<br/>et explique
    Y->>Y: Cause supprimée, chaque don est remboursé au<br/>montant net par un versement NabooPay vers le<br/>numéro du donateur
    Y->>D: Chaque donateur voit : cause supprimée, motif,<br/>X FCFA remboursés (notification + SMS)
    Y->>S: Cause supprimée, motif affiché
  else Modérateur · Supprimer et verser à la structure
    M->>Y: ▶ Supprimer · Verser à la structure · Approuve<br/>la suppression, choisit de verser les fonds et<br/>explique
    Y->>Y: Versement unique du montant net sur le compte<br/>de la structure (voir S22)
    Y->>D: Chaque donateur voit : cause supprimée, motif,<br/>fonds versés à la structure
    Y->>S: Fonds versés, preuve obligatoire sous 7 jours<br/>(voir S25)
  end
  Note over D,M: Si rien n'a été collecté, le modérateur choisit seulement Supprimer ou<br/>Maintenir.
  end
  rect rgba(128, 128, 128, 0.08)
  Note over D,H: S18 · Faire un don<br/>Point de départ : Donateur connecté, cause active
  D->>Y: ▶ Voir plus · Parcourt le fil : catégories,<br/>filtres Urgent, Presque atteint, Récent
  Y->>D: Fiche de la cause : bannière, structure<br/>vérifiée, progression, nombre de donateurs,<br/>date limite, causes similaires
  D->>D: ▶ Faire un don · Ouvre la fenêtre de don,<br/>choisit 500, 1 000 ou 5 000 FCFA ou un montant<br/>libre (500 min.), et Orange Money ou Wave
  Y->>D: Affiche en direct les frais NabooPay (3 %) et<br/>le net que recevra la structure
  D->>Y: ▶ Confirmer le don · Confirme
  Y->>D: Enregistre le don « en attente » puis ouvre la<br/>page de paiement NabooPay
  alt Donateur · Paiement réussi
    Y->>Y: NabooPay confirme (notification signée, ou<br/>vérification au retour ou toutes les 10 min) :<br/>don « bloqué » avec les frais réels
    Y->>D: Écran de remerciement, don ajouté à<br/>l'historique, notification « Don confirmé »
    Y->>S: Le don apparaît dans le tableau de bord de la<br/>structure
    Y->>D: La barre de progression avance en direct pour<br/>tous ceux qui regardent la cause
    Note over D,Y: Si ce don atteint l'objectif : voir S21.
  else Donateur · Paiement abandonné ou échoué
    Y->>D: Retour sur la cause, rien n'est compté
    Y->>Y: Le paiement en attente est annulé<br/>automatiquement au bout de 2 h
  else Donateur · Paiement confirmé après la clôture de la cause
    Note over D,Y: ⚠ G15 non décidé · Paiement confirmé après la clôture de la cause
  end
  D->>Y: ▶ Nous contacter sur WhatsApp · Pour un don en<br/>nature ou une question
  Y->>D: Ouvre WhatsApp avec le numéro de SUNUSOCIAL
  end
  rect rgba(128, 128, 128, 0.08)
  Note over D,H: S19 · Historique, impact et preuves (donateur)
  D->>Y: ▶ Mon profil · Ouvre son profil
  Y->>D: Historique des dons, total donné, « Vous avez<br/>contribué à 3 causes pour 12 500 FCFA »,<br/>statut de chaque don
  D->>Y: ▶ Voir la preuve · Ouvre le dossier d'une<br/>cause financée, quand il est validé
  Y->>D: Galerie (photos, vidéo, facture, bon de<br/>livraison), compte rendu et utilisation des<br/>fonds
  end
  rect rgba(128, 128, 128, 0.08)
  Note over D,H: S20 · Demander un remboursement<br/>Point de départ : Don bloqué (fonds pas encore versés)
  D->>D: ▶ Demander un remboursement · Sur un don dont<br/>les fonds ne sont pas encore versés : explique<br/>(5 caractères min.) et confirme le numéro qui<br/>recevra le remboursement
  D->>Y: ▶ Envoyer la demande · Envoie la demande
  Y->>D: « Demande envoyée, un modérateur décidera »
  Y->>M: Nouvelle ligne dans « Demandes de<br/>remboursement », avec le montant net qui<br/>serait rendu
  Note over D,M: ⚠ G1 non décidé · Demande de remboursement en attente au moment où la cause se<br/>termine
  alt Modérateur · Rembourser
    M->>Y: ▶ Rembourser · Accepte (décision définitive)
    Y->>Y: Versement du montant net (don moins frais<br/>NabooPay) vers le numéro du donateur
    Y->>D: « X FCFA remboursés » par notification + SMS
    Y->>S: Le montant collecté de la cause diminue<br/>d'autant
  else Modérateur · Refuser
    M->>Y: ▶ Refuser · Refuse (décision définitive)
    Y->>D: « Demande refusée, le don reste affecté à la<br/>cause »
  end
  Note over D,M: Une fois les fonds versés à la structure, le bouton disparaît.
  end
  rect rgba(128, 128, 128, 0.08)
  Note over D,H: S21 · Objectif atteint
  Y->>Y: Le don qui atteint l'objectif est accepté en<br/>entier, même s'il le dépasse
  Y->>Y: La cause passe à « Clôturée » : plus aucun don<br/>possible
  Y->>D: La fiche affiche « Objectif atteint »
  Y->>Y: Lance le versement de la cause (voir S22)
  end
  rect rgba(128, 128, 128, 0.08)
  Note over D,H: S22 · Versement à la structure
  Y->>Y: Ajoute un versement unique du montant net à la<br/>file (un seul versement à la fois chez<br/>NabooPay), après avoir vérifié le solde du<br/>compte NabooPay
  alt Système · Versement réussi
    Y->>S: « Fonds versés : X FCFA sur votre compte<br/>Orange Money ou Wave » (SMS) + preuve due sous<br/>7 jours
    Y->>D: Les donateurs voient « Fonds versés à la<br/>structure »
  else Système · Plus de 2 000 000 FCFA
    Y->>S: « Versement en vérification chez NabooPay »,<br/>le délai peut être de quelques jours
    Y->>M: Le versement apparaît « En vérification » dans<br/>le suivi des versements
  else Système · Échec ou réponse inconnue
    Y->>Y: Ne renvoie jamais automatiquement, vérifie<br/>d'abord chez NabooPay si l'argent est parti
    Y->>M: Alerte dans le suivi des versements
    Note over D,M: ⚠ G10 non décidé · Versement échoué
  end
  Note over D,M: Si un changement de compte de versement est en attente, le versement<br/>attend (voir S11).
  end
  rect rgba(128, 128, 128, 0.08)
  Note over D,H: S23 · Date limite atteinte
  Y->>Y: Vérification toutes les heures des causes dont<br/>la date limite est passée
  alt Système · Des dons ont été collectés
    Y->>Y: Cause clôturée et tout le montant collecté<br/>versé, même à 1 % de l'objectif (voir S22)
    Y->>D: La fiche affiche « Terminée »
  else Système · Aucun don
    Note over D,Y: ⚠ G9 non décidé · Cause sans aucun don à sa date limite
  end
  Note over D,Y: ⚠ G3 non décidé · Demande de prolongation en attente à la date limite
  end
  rect rgba(128, 128, 128, 0.08)
  Note over D,H: S24 · Publier la preuve<br/>Point de départ : Fonds versés à la structure
  S->>S: ▶ Publier la preuve · Ajoute au moins 5<br/>fichiers (photos, vidéo jusqu'à 50 Mo et 90 s,<br/>facture, bon de livraison), un compte rendu et<br/>le détail des dépenses
  S->>Y: ▶ Envoyer la preuve · Envoie le dossier
  Y->>Y: Contrôles automatiques : photo déjà publiée<br/>ailleurs, date de la photo, facture<br/>réutilisée, total différent du montant reçu
  Y->>S: « Preuve envoyée, en attente de validation »
  Y->>M: Nouvelle ligne dans « Preuves à valider »,<br/>avec les éléments signalés en rouge, affichée<br/>comme les donateurs la verront
  alt Modérateur · Valider
    M->>Y: ▶ Valider la preuve · Valide
    Y->>D: Chaque donateur de la cause peut ouvrir le<br/>dossier (notification + SMS)
    Y->>D: Le dossier apparaît dans le fil public de<br/>l'accueil
    Y->>S: « Preuve validée », échéance respectée
  else Modérateur · Dossier insuffisant
    M->>Y: ▶ Demander des compléments · Demande des<br/>compléments
    Note over D,M: ⚠ G8 non décidé · Preuve jugée insuffisante
  end
  end
  rect rgba(128, 128, 128, 0.08)
  Note over D,H: S25 · Demander un délai pour la preuve (sursis)
  S->>S: ▶ Demander un délai · Choisit une nouvelle<br/>date et explique pourquoi
  S->>Y: ▶ Envoyer la demande au modérateur · Envoie la<br/>demande
  Y->>M: Nouvelle ligne dans « Demandes de prolongation<br/>», étiquette DÉLAI DE PREUVE
  alt Modérateur · Accorder
    M->>Y: ▶ Accorder · Accorde
    Y->>S: Nouvelle échéance pour la preuve
  else Modérateur · Refuser (raison obligatoire)
    M->>Y: ▶ Refuser · Saisit la raison
    Y->>S: Refus + raison, l'échéance ne change pas
  end
  end
  rect rgba(128, 128, 128, 0.08)
  Note over D,H: S26 · Preuve en retard : suspension automatique
  Y->>Y: Chaque jour : une échéance de preuve est<br/>dépassée sans preuve validée
  Y->>S: « Compte suspendu » (notification + e-mail) :<br/>plus de nouvelle cause
  Note over S,M: ⚠ G4 non décidé · Structure suspendue qui a des causes actives
  Y->>M: La structure apparaît « Compte suspendu » dans<br/>le suivi des preuves
  alt Modérateur · Relancer
    M->>Y: ▶ Relancer la structure · Envoie un rappel
    Y->>S: Rappel par SMS avec l'échéance
  else Modérateur · Lever la suspension
    M->>Y: ▶ Lever la suspension · Lève la suspension,<br/>par exemple après validation de la preuve en<br/>retard
    Y->>S: Compte rétabli
  end
  end
  rect rgba(128, 128, 128, 0.08)
  Note over D,H: S27 · Profil don de sang du donateur
  D->>D: ▶ Enregistrer · Active « Je souhaite être<br/>alerté pour les dons de sang » (désactivé par<br/>défaut), choisit son groupe ou « Je ne sais<br/>pas », sa région puis sa commune, et les SMS
  Y->>Y: Profil enregistré (donnée de santé, visible<br/>par lui seul), action dans l'historique
  D->>Y: ▶ Désactiver · Peut tout désactiver à tout<br/>moment : il ne reçoit plus d'alerte
  Note over D,Y: ⚠ G16 non décidé · Donneurs qui ne connaissent pas leur groupe sanguin
  end
  rect rgba(128, 128, 128, 0.08)
  Note over D,H: S28 · L'hôpital émet une alerte
  H->>H: ▶ Émettre une alerte · Choisit les groupes<br/>recherchés, le nombre de poches, l'urgence et<br/>les communes de sa région
  Y->>H: Aperçu : « X donneurs compatibles seront<br/>notifiés »
  H->>Y: ▶ Envoyer l'alerte · Envoie
  Y->>D: Seuls les donneurs volontaires, compatibles et<br/>habitant ces communes reçoivent l'alerte<br/>(application + SMS), sans action obligatoire
  Y->>M: L'alerte est visible dans la modération
  Note over D,H: 20 alertes par heure au maximum par hôpital.
  end
  rect rgba(128, 128, 128, 0.08)
  Note over D,H: S29 · Le donneur répond à une alerte
  D->>Y: ▶ Je peux donner · Choisit un créneau de<br/>passage
  D->>Y: ▶ Confirmer ma venue · Confirme
  Y->>H: Nouveau donneur attendu : prénom et groupe<br/>seulement, jamais l'adresse
  Y->>D: Rappel par SMS environ 2 h avant le créneau
  D->>Y: ▶ Annuler ma venue · Ne peut plus venir
  Note over D,H: ⚠ G14 non décidé · Annuler sa venue pour un don de sang
  Note over D,H: L'aptitude au don est vérifiée sur place par le médecin. Un don récent<br/>n'empêche pas de recevoir des alertes.
  end
  rect rgba(128, 128, 128, 0.08)
  Note over D,H: S30 · L'hôpital confirme les dons et gère son stock
  H->>Y: ▶ Confirmer le don · Le donneur est venu et a<br/>donné
  Y->>H: Stock du groupe +1 poche, alerte : poches<br/>collectées +1
  H->>Y: ▶ Modifier le stock · Corrige ses réserves à<br/>la main
  Note over Y,H: Un donneur qui ne vient pas n'est simplement pas confirmé.
  end
  rect rgba(128, 128, 128, 0.08)
  Note over D,H: S31 · Clôturer une alerte et remercier
  H->>Y: ▶ Clôturer l'alerte · Objectif atteint ou<br/>besoin couvert
  Y->>D: L'alerte disparaît pour les donneurs
  H->>Y: ▶ Envoyer le remerciement · Rédige son message<br/>de remerciement
  Y->>D: Seuls les donneurs dont le don a été confirmé<br/>le reçoivent (application + SMS)
  M->>Y: ▶ Clôturer l'alerte · Ferme une alerte abusive<br/>ou erronée
  Note over D,H: ⚠ G13 non décidé · Alerte fermée par un modérateur
  end
```

## Points non décidés — propositions à valider

Pour chaque point, JËFTECH propose une règle. Cochez « OK » ou indiquez votre décision.

| Point | Scénarios | Question | Proposition | Décision |
|---|---|---|---|---|
| **G1** · Demande de remboursement en attente au moment où la cause se termine | S20 | La cause atteint son objectif ou sa date limite pendant qu'une demande de remboursement attend : les fonds partent et le remboursement devient impossible. | Le versement de la cause attend que les demandes de remboursement en cours soient décidées (le modérateur a 48 h), puis part automatiquement. | ☐ OK · ☐ Autre : |
| **G2** · Dons pendant une demande de suppression | S17 | Faut-il continuer à accepter des dons sur une cause dont la structure demande la suppression ? | La cause est mise en pause (plus de nouveaux dons, bandeau « En cours d'examen ») jusqu'à la décision du modérateur. | ☐ OK · ☐ Autre : |
| **G3** · Demande de prolongation en attente à la date limite | S16, S23 | La date limite arrive avant que le modérateur ait décidé. | Une demande envoyée avant la date limite la gèle jusqu'à la décision. Les demandes ne sont plus acceptées dans les 24 h qui précèdent la date limite. | ☐ OK · ☐ Autre : |
| **G4** · Structure suspendue qui a des causes actives | S26 | La suspension empêche de créer des causes, mais les causes déjà actives ? | Les causes actives sont mises en pause (plus de nouveaux dons) et leurs versements bloqués jusqu'à la levée de la suspension. Les donateurs voient un bandeau. | ☐ OK · ☐ Autre : |
| **G5** · Structure ou hôpital refusé : nouvelle tentative ? | S09, S10 | Après un refus, que peut faire la structure ? | Elle corrige son dossier (documents, informations) et le renvoie. Il revient dans « Inscriptions à valider » avec l'historique des refus. | ☐ OK · ☐ Autre : |
| **G6** · Cause refusée : correction et nouvel envoi ? | S12 | Après un refus, la structure doit-elle tout recréer ? | Un bouton « Modifier et renvoyer » remet la même cause en modération, avec la raison du refus précédent visible par le modérateur. | ☐ OK · ☐ Autre : |
| **G7** · Modifier une cause déjà active | S14 | Quels champs une structure peut-elle changer une fois la cause publiée, sachant que des donateurs ont donné sur cette base ? | Seuls la description et la bannière sont modifiables, et la modification repasse en modération (l'ancienne version reste affichée en attendant). Montant, catégorie et date limite sont verrouillés (la date ne change que par une prolongation). | ☐ OK · ☐ Autre : |
| **G8** · Preuve jugée insuffisante | S24 | Le statut « à revoir » existe, mais rien ne dit ce que la structure doit faire, ni dans quel délai. | Le modérateur demande des compléments avec une raison. La structure complète et renvoie son dossier dans les 3 jours. Sinon, la suspension s'applique. | ☐ OK · ☐ Autre : |
| **G9** · Cause sans aucun don à sa date limite | S23 | Que devient une cause qui n'a rien collecté ? | Elle est clôturée sans versement ni preuve à fournir. La structure est prévenue et peut la recréer. | ☐ OK · ☐ Autre : |
| **G10** · Versement échoué | S22 | Numéro de versement invalide, NabooPay indisponible ou solde insuffisant. | Le versement passe « Échoué », le modérateur est alerté et la structure est invitée à vérifier son compte (changement de compte si besoin). Le modérateur relance le versement manuellement depuis le suivi. | ☐ OK · ☐ Autre : |
| **G11** · Suppression du compte donateur | S07 | La loi sur les données personnelles donne au donateur le droit d'effacer ses données. Rien n'est prévu. | Le compte est fermé et anonymisé (nom, téléphone et profil sang effacés). Les dons restent dans la comptabilité sans identité. Impossible tant qu'une demande de remboursement est en cours. | ☐ OK · ☐ Autre : |
| **G12** · Blocage d'un compte pour fraude | S08 | Un champ « compte bloqué » existe, mais aucun parcours n'est défini. | Le modérateur bloque le compte avec une raison : connexion impossible, causes en pause, versements gelés. Le sort des fonds est décidé comme une suppression (rembourser ou verser). Décision à valider par le bureau. | ☐ OK · ☐ Autre : |
| **G13** · Alerte fermée par un modérateur | S31 | L'hôpital est-il prévenu, et avec quelle explication ? | Oui : l'hôpital reçoit la raison. Après 3 alertes fermées, son droit d'envoyer des alertes est revu par le modérateur. | ☐ OK · ☐ Autre : |
| **G14** · Annuler sa venue pour un don de sang | S29 | Un donneur qui a confirmé un créneau peut-il se désister ? | Oui : « Annuler ma venue » retire son nom de la liste de l'hôpital, qui est prévenu. | ☐ OK · ☐ Autre : |
| **G15** · Paiement confirmé après la clôture de la cause | S18 | Un donateur a commencé à payer avant la clôture, mais NabooPay confirme après, quand le versement est déjà parti. | Le don est remboursé automatiquement au montant net et le donateur est prévenu, avec une suggestion de causes similaires. | ☐ OK · ☐ Autre : |
| **G16** · Donneurs qui ne connaissent pas leur groupe sanguin | S27 | Ils ne correspondent à aucune alerte ciblée par groupe. | Ils ne reçoivent que les alertes marquées « Tous groupes » par l'hôpital, et voient un message les invitant à connaître leur groupe lors de leur premier don. | ☐ OK · ☐ Autre : |

## Index des scénarios

| N° | Scénario | Thème |
|---|---|---|
| S01 | Visiteur non connecté | Comptes |
| S02 | Inscription d'un donateur (numéro vérifié par SMS) | Comptes |
| S03 | Connexion d'un donateur, session et déconnexion | Comptes |
| S04 | Mot de passe oublié | Comptes |
| S05 | Connexion d'une structure, d'un hôpital ou d'un modérateur (double authentification) | Comptes |
| S06 | Notifications dans l'application | Comptes |
| S07 | Supprimer son compte donateur | Comptes |
| S08 | Bloquer un compte pour fraude | Comptes |
| S09 | Inscription d'une structure (phase 1) et validation | Structures et hôpitaux |
| S10 | Inscription d'un hôpital et validation | Structures et hôpitaux |
| S11 | Changer de compte de réception des fonds | Structures et hôpitaux |
| S12 | Créer une cause et la faire modérer | Causes |
| S13 | Retirer une cause encore en modération | Causes |
| S14 | Modifier une cause | Causes |
| S15 | Choisir le Coup de cœur de la semaine | Causes |
| S16 | Prolonger une cause | Causes |
| S17 | Demander la suppression d'une cause publiée | Causes |
| S18 | Faire un don | Dons |
| S19 | Historique, impact et preuves (donateur) | Dons |
| S20 | Demander un remboursement | Dons |
| S21 | Objectif atteint | Fin de cause et versements |
| S22 | Versement à la structure | Fin de cause et versements |
| S23 | Date limite atteinte | Fin de cause et versements |
| S24 | Publier la preuve | Preuves |
| S25 | Demander un délai pour la preuve (sursis) | Preuves |
| S26 | Preuve en retard : suspension automatique | Preuves |
| S27 | Profil don de sang du donateur | Don de sang |
| S28 | L'hôpital émet une alerte | Don de sang |
| S29 | Le donneur répond à une alerte | Don de sang |
| S30 | L'hôpital confirme les dons et gère son stock | Don de sang |
| S31 | Clôturer une alerte et remercier | Don de sang |

## Index des boutons

Chaque bouton du produit, qui le voit, et le scénario du schéma où ses conséquences sont décrites.

| Bouton | Qui | Effet | Scénario |
|---|---|---|---|
| Annuler ma venue | Donateur | Ne peut plus venir | S29 |
| Changer mon mot de passe | Donateur | Saisit le code + un nouveau mot de passe | S04 |
| Confirmer le don | Donateur | Confirme | S18 |
| Confirmer ma venue | Donateur | Confirme | S29 |
| Créer mon compte / Inscrire ma structure | Donateur | Choisit un parcours | S01 |
| Demander un remboursement | Donateur | Sur un don dont les fonds ne sont pas encore versés : explique (5 caractères min.) et confirme le numéro qui recevra le remboursement | S20 |
| Déconnexion | Donateur | Ferme sa session | S03 |
| Désactiver | Donateur | Peut tout désactiver à tout moment : il ne reçoit plus d'alerte | S27 |
| Enregistrer | Donateur | Active « Je souhaite être alerté pour les dons de sang » (désactivé par défaut), choisit son groupe ou « Je ne sais pas », sa région puis sa commune, et les SMS | S27 |
| Envoyer la demande | Donateur | Envoie la demande | S20 |
| Faire un don | Donateur | Ouvre la fenêtre de don, choisit 500, 1 000 ou 5 000 FCFA ou un montant libre (500 min.), et Orange Money ou Wave | S18 |
| Je peux donner | Donateur | Choisit un créneau de passage | S29 |
| Mon profil | Donateur | Ouvre son profil | S19 |
| Mot de passe oublié ? | Donateur | Saisit son numéro | S04 |
| Nous contacter sur WhatsApp | Donateur | Pour un don en nature ou une question | S18 |
| Recevoir le code par SMS | Donateur | Demande le code | S02 |
| Renvoyer le code | Donateur | Redemande un code après 60 s (3 fois max. en 10 min) | S02 |
| Se connecter | Donateur | Téléphone + mot de passe, sans code SMS | S03 |
| Supprimer mon compte | Donateur | Demande la suppression de son compte | S07 |
| Tout marquer comme lu | Donateur | Marque tout comme lu | S06 |
| Voir | Donateur | Ouvre une notification et va directement à l'écran concerné | S06 |
| Voir la preuve | Donateur | Ouvre le dossier d'une cause financée, quand il est validé | S19 |
| Voir plus | Donateur | Parcourt le fil : catégories, filtres Urgent, Presque atteint, Récent | S18 |
| Vérifier le code et continuer | Donateur | Valide le code | S02 |
| Clôturer l'alerte | Hôpital | Objectif atteint ou besoin couvert | S31 |
| Confirmer le don | Hôpital | Le donneur est venu et a donné | S30 |
| Envoyer l'alerte | Hôpital | Envoie | S28 |
| Envoyer le remerciement | Hôpital | Rédige son message de remerciement | S31 |
| Envoyer mon dossier | Hôpital | Envoie son dossier | S10 |
| Modifier le stock | Hôpital | Corrige ses réserves à la main | S30 |
| Émettre une alerte | Hôpital | Choisit les groupes recherchés, le nombre de poches, l'urgence et les communes de sa région | S28 |
| Accorder | Modérateur | Accorde | S16 |
| Accorder | Modérateur | Accorde | S25 |
| Approuver | Modérateur | Approuve le nouveau compte | S11 |
| Approuver | Modérateur | Approuve | S12 |
| Bloquer le compte | Modérateur | Bloque un compte suspect | S08 |
| Choisir comme Coup de cœur | Modérateur | Choisit une cause active | S15 |
| Clôturer l'alerte | Modérateur | Ferme une alerte abusive ou erronée | S31 |
| Demander des compléments | Modérateur | Demande des compléments | S24 |
| Lever la suspension | Modérateur | Lève la suspension, par exemple après validation de la preuve en retard | S26 |
| Maintenir la cause | Modérateur | Refuse la suppression et explique (10 caractères min.) | S17 |
| Refuser | Modérateur | Saisit la raison du refus | S09 |
| Refuser | Modérateur | Saisit la raison | S10 |
| Refuser | Modérateur | Saisit la raison | S11 |
| Refuser | Modérateur | Saisit la raison | S12 |
| Refuser | Modérateur | Saisit la raison | S16 |
| Refuser | Modérateur | Refuse (décision définitive) | S20 |
| Refuser | Modérateur | Saisit la raison | S25 |
| Relancer la structure | Modérateur | Envoie un rappel | S26 |
| Rembourser | Modérateur | Accepte (décision définitive) | S20 |
| Retirer | Modérateur | Retire le Coup de cœur | S15 |
| Supprimer · Rembourser les donateurs | Modérateur | Approuve la suppression, choisit de rembourser et explique | S17 |
| Supprimer · Verser à la structure | Modérateur | Approuve la suppression, choisit de verser les fonds et explique | S17 |
| Valider | Modérateur | Valide les documents et le compte de versement | S09 |
| Valider | Modérateur | Valide l'agrément | S10 |
| Valider la preuve | Modérateur | Valide | S24 |
| Créer une cause | Structure | Bannière, titre, description, catégorie (Santé, Alimentation, Matériel), fin à une date ou à un objectif, date limite (30 jours max.), montant, urgence, avec le net estimé affiché | S12 |
| Demander un délai | Structure | Choisit une nouvelle date et explique pourquoi | S25 |
| Envoyer la demande au modérateur | Structure | Envoie la demande | S16 |
| Envoyer la demande au modérateur | Structure | Envoie la demande | S17 |
| Envoyer la demande au modérateur | Structure | Envoie la demande | S25 |
| Envoyer la preuve | Structure | Envoie le dossier | S24 |
| Modifier | Structure | Modifie librement | S14 |
| Modifier | Structure | Ouvre la modification | S14 |
| Modifier le compte de versement | Structure | Saisit le nouveau moyen (Orange Money ou Wave), numéro et nom | S11 |
| Mot de passe oublié ? | Structure | Structure, hôpital ou modérateur : saisit son e-mail | S04 |
| Prolonger | Structure | Choisit une nouvelle date (30 jours de plus au maximum) et explique pourquoi | S16 |
| Publier la preuve | Structure | Ajoute au moins 5 fichiers (photos, vidéo jusqu'à 50 Mo et 90 s, facture, bon de livraison), un compte rendu et le détail des dépenses | S24 |
| Recevoir le code par SMS | Structure | Demande le code de vérification du numéro de versement | S09 |
| Se connecter | Structure | E-mail + mot de passe (les modérateurs se connectent sur l'adresse de modération) | S05 |
| Soumettre | Structure | Soumet la cause | S12 |
| Supprimer | Structure | Retire la cause (aucun don n'est encore possible) | S13 |
| Supprimer | Structure | Explique pourquoi (5 caractères min.) | S17 |
| Valider | Structure | Valide le code | S05 |
| Vérifier le code | Structure | Valide le code | S11 |
| Vérifier le code et continuer | Structure | Valide le code : le numéro est prouvé | S09 |
