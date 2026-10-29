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
| Compte de réception | Le **responsable** choisit Orange Money ou Wave et indique **son numéro et son nom** |
| Coup de cœur de la semaine | Choisi par le **modérateur** |
| Alertes de don de sang | **Les hôpitaux les envoient eux-mêmes** |
| Preuve d'utilisation | **Obligatoire pour toute cause financée**, dans les 7 jours suivant le versement. La structure peut demander un **sursis** au modérateur. Sans preuve, le compte est suspendu automatiquement |
| Remboursement d'un don | Le donateur récupère le **montant net**, c'est-à-dire le don moins les frais NabooPay |
| Don minimum | **500 FCFA** à titre provisoire (voir Q4) |
| Utilisation des SMS | Double authentification des structures, hôpitaux et modérateurs · **vérification du numéro des donateurs à l'inscription** · récupération du mot de passe des donateurs · alertes de sang · notifications importantes |
| Durée des sessions | **1 semaine au maximum**, puis il faut se reconnecter |
| Historique d'activité | Les actions des donateurs sont enregistrées : inscription, connexions, dons, modifications du profil |

Il reste les questions ci-dessous. Le développement peut avancer sans attendre, mais **le lancement en dépend**.

---

## A. Questions prioritaires (bloquent le lancement)

### Q1 — Fournisseur SMS, budget et expéditeur
Les SMS sont désormais **indispensables** : un donateur ne pourra pas s'inscrire sans recevoir son code de vérification.

**À décider :**
- **a.** Quel fournisseur ? Nous pouvons vous présenter 2 ou 3 devis (Orange, agrégateurs…).
- **b.** Quel budget mensuel maximum ? À titre d'ordre de grandeur, chaque inscription, chaque connexion d'une structure et chaque alerte de sang envoyée à un donneur coûte un SMS.
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

### Q4 — Circuit de l'argent avec NabooPay (information importante)
En étudiant l'API de NabooPay, nous avons constaté un point qui change la description du circuit des fonds :

1. Tous les dons arrivent d'abord sur **le compte marchand NabooPay de SUNUSOCIAL**.
2. C'est depuis ce compte que la plateforme verse ensuite l'argent aux structures, ou rembourse les donateurs.

C'est ce qui permet de **bloquer les fonds** comme vous l'avez décidé. Mais cela signifie que **SUNUSOCIAL détient temporairement l'argent des donateurs**, contrairement à l'idée de départ (« aucun compte central SUNUSOCIAL »).

**Conséquences à valider :**
- **Comptabilité :** le solde du compte NabooPay doit toujours correspondre aux dons en attente. La plateforme le vérifie automatiquement.
- **Vérification NabooPay (KYB) :** tant que SUNUSOCIAL n'a pas fait vérifier son entreprise auprès de NabooPay, le compte est **limité à 200 000 FCFA par mois**. Il faut lancer cette vérification **dès maintenant** (voir Q7).
- **Gros versements :** un versement de plus de 2 000 000 FCFA est vérifié manuellement par NabooPay, ce qui peut retarder le paiement de la structure.

**À décider :** le bureau valide-t-il ce fonctionnement, et lance-t-il la vérification KYB auprès de NabooPay ?

---

## B. Règles à préciser

### Q5 — La 2e phase d'inscription des structures
À l'inscription (phase 1), la structure donne : son nom, son type, sa localisation, son responsable, son récépissé ou agrément, et son compte de réception.

**À décider :**
- Quelles informations demander en **phase 2** ? Par exemple : NINEA, statuts, adresse précise, photos des locaux, composition du bureau, compte au nom de la structure…
- La phase 2 est-elle **obligatoire avant le premier versement**, ou peut-elle être complétée plus tard, et dans quel délai ?

**En attendant :** la phase 2 est prévue dans le système mais n'est pas obligatoire.

### Q6 — Don minimum
Nous partons sur **500 FCFA**, comme convenu. Le bureau souhaite-t-il revoir ce montant ? Par exemple 200 FCFA pour plus d'accessibilité, ou 1 000 FCFA pour limiter la part des frais.

---

## C. Questions juridiques

### Q7 — Statut juridique de SUNUSOCIAL
Quel est le statut juridique de SUNUSOCIAL (association, ONG, autre) ? Une autorisation est-elle nécessaire pour collecter des dons auprès du public ? NabooPay demandera ces documents pour la vérification KYB (Q4).

### Q8 — Données personnelles et données de santé
Le groupe sanguin est une **donnée de santé** (loi n° 2008-12). La plateforme enregistre aussi un **historique d'activité** des donateurs, et elle est hébergée **hors du Sénégal**.

**À décider :** SUNUSOCIAL se charge-t-elle de la déclaration ou demande d'autorisation auprès de la **CDP**, avant l'ouverture du module de don de sang ?

### Q9 — Documents légaux
Il faut, en français : des **conditions générales d'utilisation**, une **politique de confidentialité** (y compris la durée de conservation de l'historique d'activité, que nous proposons de fixer à 12 mois) et une **politique de remboursement**.

**À décider :** qui les rédige ?

---

## D. Informations pratiques

### Q10 — À nous transmettre
- **Nom de domaine** souhaité (par ex. `sunusocial.sn`), et qui l'achète.
- **Numéro WhatsApp** officiel.
- **Adresse e-mail** d'envoi.
- **Comptes Vercel, Convex et NabooPay** au nom de SUNUSOCIAL, avec JËFTECH invitée comme administrateur.
- **Premier modérateur :** nom, e-mail et téléphone.

---

### Récapitulatif

| # | Question | Bloque | Priorité |
|---|---|---|---|
| Q1 | Fournisseur SMS, budget, expéditeur | Inscription des donateurs, connexions, alertes | 🔴 Haute |
| Q2 | Modèle de revenus | Calcul des frais affiché | 🔴 Haute |
| Q3 | Liste des 14 régions et communes | Inscriptions, alertes | 🔴 Haute |
| Q4 | Circuit de l'argent et vérification KYB NabooPay | Encaissement au-delà de 200 000 FCFA/mois | 🔴 Haute |
| Q5 | Phase 2 d'inscription des structures | Versements, si la phase 2 est rendue obligatoire | 🟠 Moyenne |
| Q6 | Don minimum | — (500 FCFA en attendant) | 🟢 Basse |
| Q7 | Statut juridique | Vérification NabooPay | 🔴 Haute |
| Q8 | Déclaration CDP | Module don de sang | 🔴 Haute |
| Q9 | CGU et politiques | Mise en ligne | 🟠 Moyenne |
| Q10 | Domaine, WhatsApp, comptes, modérateur | Mise en ligne | 🟠 Moyenne |
