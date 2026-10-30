# SUNUSOCIAL — Questions à trancher par le bureau

| | |
|---|---|
| **De** | JËFTECH (équipe technique) |
| **Pour** | Ngoné Gueye et le bureau de SUNUSOCIAL |
| **Date** | 29 octobre 2026 |

## Ce qui est déjà décidé

Merci pour vos réponses. Voici ce que nous avons retenu, pour validation finale :

| Sujet | Décision |
|---|---|
| Prestataire de paiement | **NabooPay** (Orange Money et Wave) |
| Gestion des fonds | Les fonds sont **bloqués** jusqu'à la fin de la cause, puis versés **en une seule fois** |
| Durée des causes | **Toute cause a une date limite**, de **30 jours au maximum**. Les fonds sont versés à l'objectif atteint ou à la date limite, au premier des deux. Une structure peut demander une **prolongation**, que le modérateur accepte ou refuse |
| Vérification des structures | **Sur documents uniquement**, validée ou refusée par le modérateur |
| Compte de réception (structures) | Le **responsable** choisit Orange Money ou Wave et indique **son numéro et son nom**. Le numéro est **vérifié par un code SMS** à l'inscription, pour éviter toute erreur : un versement envoyé au mauvais numéro ne peut pas être récupéré |
| Coup de cœur de la semaine | Choisi par le **modérateur** |
| Alertes de don de sang | **Les hôpitaux les envoient eux-mêmes** |
| Preuve d'utilisation | **Obligatoire pour toute cause financée**, dans les 7 jours suivant le versement. La structure peut demander un **sursis** au modérateur. Sans preuve, le compte est suspendu automatiquement |
| Remboursement d'un don | Le donateur récupère le **montant net**, c'est-à-dire le don moins les frais NabooPay |
| Don minimum | **500 FCFA** à titre provisoire (voir Q6) |
| Utilisation des SMS | Double authentification des structures, hôpitaux et modérateurs · **vérification du numéro des donateurs à l'inscription** · récupération du mot de passe des donateurs · alertes de sang · notifications importantes |
| Durée des sessions | **1 semaine au maximum**, puis il faut se reconnecter |
| Historique d'activité | Les actions des donateurs sont enregistrées : inscription, connexions, dons, modifications du profil |

Il reste les questions ci-dessous (parties A à C), la liste de ce que SUNUSOCIAL doit créer et nous transmettre (partie E), et l'organisation du lancement (partie F). Le développement peut avancer sans attendre, mais **le lancement en dépend**.

---

## A. Questions prioritaires (bloquent le lancement)

### Q1 — Fournisseur SMS, budget et expéditeur
Les SMS sont désormais **indispensables** : un donateur ne pourra pas s'inscrire sans recevoir son code de vérification.

**À décider :**
- **a.** Quel fournisseur ? Nous pouvons vous présenter 2 ou 3 devis (Orange, agrégateurs…).
- **b.** Quel budget mensuel maximum ? Pour vous aider, voici une **estimation du volume** pour un mois type au lancement. Les hypothèses sont à ajuster : 500 nouveaux donateurs, 25 structures et 5 hôpitaux actifs, 4 alertes de sang.

  | Usage | Calcul | SMS / mois |
  |---|---|---|
  | Vérification du numéro à l'inscription des donateurs | 500 inscriptions + 10 % de renvois | ≈ 550 |
  | Code de connexion des structures, hôpitaux et modérateurs | 30 comptes × ~20 connexions | ≈ 600 |
  | Récupération de mot de passe des donateurs | | ≈ 50 |
  | Vérification des numéros de versement | nouvelles structures et changements | ≈ 10 |
  | Alertes de don de sang | 4 alertes × ~300 donneurs compatibles | ≈ 1 200 |
  | Notifications importantes (preuve publiée, remboursement, versement…) | | ≈ 1 000 |
  | **Total** | | **≈ 3 400 SMS / mois** |

  Le budget est ce total multiplié par le **prix unitaire** indiqué dans le devis du fournisseur. Les alertes de sang sont le poste le plus variable : il dépend du nombre de donneurs inscrits.
- **c.** Quel nom ou numéro d'expéditeur dédié (par ex. « SUNUSOCIAL ») ?

**En attendant :** l'équipe de développement utilise un simulateur, qui n'envoie aucun vrai SMS.

---

### Q2 — Le modèle de revenus
SUNUSOCIAL ne cherche pas le profit, mais doit couvrir ses frais (environ 45 000 FCFA/mois d'hébergement, plus les SMS).

**À décider :**

- **Option 1 : un pourcentage sur chaque don.**
  - Combien ? Il s'ajoute aux 3 % de NabooPay. Par exemple, avec 2 % : sur un don de 5 000 FCFA, 150 FCFA vont à NabooPay, 100 FCFA à SUNUSOCIAL et 4 750 FCFA à la structure.
  - Le pourcentage est-il prélevé sur le don, ou proposé au donateur en supplément ?
- **Option 2 : un abonnement payé par les structures.**
  - Quel montant, et à quelle fréquence ?
  - Que faire d'une structure qui ne peut pas payer ?
- **Option 3 : aucun prélèvement au lancement.** La question est revue plus tard.

**En attendant :** aucun prélèvement. La ligne est prévue dans le calcul : l'activer ne demandera qu'un réglage.

---

### Q3 — La liste officielle des régions et communes
Le prototype couvre 8 régions. La version finale doit couvrir **les 14 régions et toutes leurs communes**. Cette liste sert aux inscriptions et au ciblage des alertes de sang.

**À décider :** nous fournissez-vous la liste, ou nous autorisez-vous à utiliser la liste officielle de l'ANSD ?

---

### Q4 — Circuit de l'argent : le compte NabooPay de SUNUSOCIAL
**Note :** l'idée de départ était qu'il n'y ait « aucun compte central SUNUSOCIAL ». En pratique, NabooPay fonctionne avec **un compte marchand au nom de SUNUSOCIAL** :
1. les dons y arrivent et y restent bloqués jusqu'à la fin de la cause ;
2. la plateforme les verse ensuite **automatiquement** à la structure.

Une fois ce compte configuré (voir la partie E), **aucune manipulation manuelle n'est nécessaire** : ni pour les versements aux structures, ni pour les remboursements. La plateforme vérifie aussi chaque jour que le solde du compte correspond aux dons en attente.

**À valider :** le bureau confirme-t-il ce fonctionnement ?

## B. Règles à préciser

### Q5 — La 2e phase d'inscription des structures
À l'inscription (phase 1), la structure donne : son nom, son type, sa localisation, son responsable, son récépissé ou agrément, et son compte de réception.

**À décider :**
- Quelles informations demander en **phase 2** ? Par exemple : NINEA, statuts, adresse précise, photos des locaux, composition du bureau, compte au nom de la structure…
- La phase 2 est-elle **obligatoire avant le premier versement**, ou peut-elle être complétée plus tard, et dans quel délai ?

**Bon à savoir :** pour envoyer l'argent, NabooPay n'a besoin que du **moyen de paiement (Orange Money ou Wave) et du numéro**. Le nom n'est pas contrôlé par NabooPay. La phase 1 suffit donc pour payer une structure. La phase 2 sert à mieux connaître la structure, pas à la payer.

**En attendant :** la phase 2 est prévue dans le système mais n'est pas obligatoire.

### Q6 — Don minimum
Nous partons sur **500 FCFA**, comme convenu. Le bureau souhaite-t-il revoir ce montant ? Par exemple 200 FCFA pour plus d'accessibilité, ou 1 000 FCFA pour limiter la part des frais.

---

## C. Questions juridiques

### Q7 — Statut juridique de SUNUSOCIAL
Quel est le statut juridique de SUNUSOCIAL (association, ONG, autre) ? Une autorisation est-elle nécessaire pour collecter des dons auprès du public ? NabooPay demandera ces documents pour la vérification de l'entreprise (partie E).

### Q8 — Données personnelles et données de santé
Le groupe sanguin est une **donnée de santé** (loi n° 2008-12). La plateforme enregistre aussi un **historique d'activité** des donateurs, et elle est hébergée **hors du Sénégal**.

**À décider :** SUNUSOCIAL se charge-t-elle de la déclaration ou demande d'autorisation auprès de la **CDP**, avant l'ouverture du module de don de sang ?

### Q9 — Documents légaux
Il faut, en français : des **conditions générales d'utilisation**, une **politique de confidentialité** (y compris la durée de conservation de l'historique d'activité, que nous proposons de fixer à 12 mois) et une **politique de remboursement**.

**À décider :** qui les rédige ?

---

## F. Organisation du lancement

Ces points ne bloquent pas le développement, mais il faut les décider avant l'ouverture au public.

### F1 — Date de lancement et structures pilotes
- Quelle **date de lancement** visez-vous ?
- Quelles **premières structures et hôpitaux** seront accompagnés pour s'inscrire avant l'ouverture, afin que les donateurs trouvent des causes dès le premier jour ?
- Qui s'occupe de les recruter ? Nous suggérons Ndeye Mareme, responsable marketing.

### F2 — La modération au quotidien
- **Qui modère** la plateforme au lancement, et qui le remplace en cas d'absence ?
- **En combien de temps** une demande doit-elle être traitée (inscription d'une structure, cause, preuve, prolongation, remboursement) ? Nous proposons **48 heures au maximum**.
- Faut-il qu'un modérateur puisse **ajouter d'autres modérateurs** lui-même ? Aujourd'hui, c'est JËFTECH qui crée ces comptes.

### F3 — Objectifs de réussite
Nous avons proposé ces objectifs pour les 3 premiers mois. Merci de les confirmer ou de les ajuster :

| Objectif | Proposition |
|---|---|
| Structures vérifiées | 25 |
| Causes financées (objectif ou date limite atteint) | 60 % des causes publiées |
| Preuves publiées dans les 7 jours | 100 % des causes financées |
| Donateurs qui donnent plus d'une fois | 30 % |
| Dons commencés puis confirmés | 85 % |
| Alertes de sang qui atteignent leur objectif | 70 % |

---

## D. Ce que JËFTECH prend en charge

**Vercel, Convex et Resend** (hébergement, base de données, e-mails) sont créés et administrés par JËFTECH. SUNUSOCIAL n'a rien à configurer. Comme prévu au contrat, les frais d'hébergement (environ 45 000 FCFA/mois) sont payés par SUNUSOCIAL : il suffit d'enregistrer **la carte de paiement de SUNUSOCIAL** sur ces comptes (voir E5).

---

## E. Ce que SUNUSOCIAL doit créer et nous transmettre

Ces éléments sont nécessaires au développement et à la mise en ligne, en plus des réponses aux questions ci-dessus.

### E1 — Compte NabooPay (indispensable)
Le compte doit être **au nom de SUNUSOCIAL** : JËFTECH ne peut pas le créer à sa place.

1. **Créer le compte** de SUNUSOCIAL sur `platform.naboopay.com`, et **remplir le profil de l'entreprise** (secteur d'activité). Sans ce profil, NabooPay refuse toute opération.
2. **Faire vérifier l'entreprise (KYB)** avec les documents juridiques de SUNUSOCIAL (voir Q7). **Tant que ce n'est pas fait, le compte est limité à 200 000 FCFA de dons par mois**, ce qui est insuffisant dès les premières causes.
3. **Activer** sur le compte : **Wave**, **Orange Money** et les **versements (payouts)**.
4. **Demander à NabooPay s'il existe un mode test** (sandbox). Sinon, nous ferons les essais avec de petits montants réels (quelques centaines de FCFA), remboursés ensuite.
5. **Créer deux clés d'API** (en test si NabooPay le propose, puis en production) et nous les transmettre **de façon sécurisée** (jamais par WhatsApp ni par e-mail en clair ; nous proposerons un outil de partage) :
   - une clé avec la permission **« checkout »**, pour encaisser les dons ;
   - une clé avec la permission **« payout »**, pour verser l'argent aux structures et rembourser les donateurs.
6. **Enregistrer l'adresse de notification (webhook)** que nous vous fournirons, et nous transmettre la **clé secrète** associée.
7. **Cagnottes de plus de 2 000 000 FCFA :** chez NabooPay, tout versement au-delà de ce montant est **vérifié manuellement** avant d'être envoyé, ce qui peut retarder le paiement de la structure de quelques jours. Lors de la vérification KYB, **demandez à NabooPay** si ce plafond peut être relevé pour un compte vérifié, et quel est leur délai de vérification. De notre côté, la plateforme préviendra la structure quand un versement est en cours de vérification.

### E2 — SMS
Une fois le fournisseur choisi (Q1) : ouvrir le compte au nom de SUNUSOCIAL, **faire enregistrer le nom d'expéditeur** (par ex. « SUNUSOCIAL »), et nous transmettre la clé d'API de façon sécurisée.

### E3 — Nom de domaine
Le **nom de domaine** (par ex. `sunusocial.sn`), acheté au nom de SUNUSOCIAL, avec un **accès à la configuration DNS** pour JËFTECH. Il sert au site (`sunusocial.sn`), à l'espace de modération (`moderation.sunusocial.sn`) et à l'envoi des e-mails.

### E4 — Contacts
- Le **numéro WhatsApp** officiel de SUNUSOCIAL.
- **Le premier modérateur :** nom, e-mail et téléphone. JËFTECH crée son compte, et il recevra ses codes de connexion par SMS.

### E5 — Facturation de l'hébergement
Une **carte de paiement au nom de SUNUSOCIAL**, à enregistrer sur Vercel et Convex (environ 45 000 FCFA/mois), ainsi que sur le fournisseur SMS.

### E6 — Contenus
- La **liste officielle des régions et communes** (Q3), si SUNUSOCIAL la fournit.
- Les **textes légaux** (Q9), s'ils sont rédigés par le juriste de SUNUSOCIAL.

### Récapitulatif

| # | Question | Bloque | Priorité |
|---|---|---|---|
| Q1 | Fournisseur SMS, budget, expéditeur | Inscription des donateurs, connexions, alertes | 🔴 Haute |
| Q2 | Modèle de revenus | Calcul des frais affiché | 🔴 Haute |
| Q3 | Liste des 14 régions et communes | Inscriptions, alertes | 🔴 Haute |
| Q4 | Validation du circuit de l'argent (compte NabooPay de SUNUSOCIAL) | Versements | 🔴 Haute |
| Q5 | Phase 2 d'inscription des structures | Versements, si la phase 2 est rendue obligatoire | 🟠 Moyenne |
| Q6 | Don minimum | — (500 FCFA en attendant) | 🟢 Basse |
| Q7 | Statut juridique | Vérification NabooPay (E1) | 🔴 Haute |
| Q8 | Déclaration CDP | Module don de sang | 🔴 Haute |
| Q9 | CGU et politiques | Mise en ligne | 🟠 Moyenne |
| E1 | Compte NabooPay, vérification KYB, clés d'API, webhook | Encaissement des dons | 🔴 Haute |
| E2–E6 | SMS, domaine, contacts, carte de paiement, contenus | Mise en ligne | 🟠 Moyenne |
| F1–F3 | Date de lancement, structures pilotes, modération, objectifs | Ouverture au public | 🟠 Moyenne |
