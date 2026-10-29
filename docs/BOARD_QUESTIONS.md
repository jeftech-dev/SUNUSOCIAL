# SUNUSOCIAL — Questions à trancher par le bureau

| | |
|---|---|
| **De** | JËFTECH (équipe technique) |
| **Pour** | Ngoné Gueye et le bureau de SUNUSOCIAL |
| **Date** | 29 octobre 2026 |

Merci pour les décisions déjà prises : **NabooPay** comme prestataire, **blocage des fonds** jusqu'à la fin de la cause, **vérification des structures sur documents** par le modérateur, **versement en une seule fois**, **date limite obligatoire pour toute cause**, et **« Coup de cœur » choisi par le modérateur**.

Il reste les questions ci-dessous. Pour chacune, nous indiquons **ce qu'elle bloque** et **ce que nous ferons en attendant**. Le développement peut donc avancer, mais certaines fonctions ne pourront pas être mises en ligne sans votre réponse.

---

## A. Questions prioritaires (bloquent le lancement)

### Q1 — Les SMS
Les SMS servent à quatre choses dans la plateforme :
1. la double authentification des structures, hôpitaux et modérateurs ;
2. les alertes de don de sang ;
3. les notifications importantes (preuve publiée, remboursement) ;
4. la récupération du mot de passe des donateurs.

**À décider :**
- **a.** Validez-vous l'envoi de SMS ?
- **b.** Quel fournisseur ? Nous pouvons vous proposer 2 ou 3 devis (Orange, opérateurs agrégateurs…).
- **c.** Quel budget mensuel maximum ?
- **d.** Quel nom ou numéro d'expéditeur dédié (par ex. « SUNUSOCIAL ») ?

**En attendant :**
- les codes de connexion partent **par e-mail** ;
- les alertes de sang restent **dans l'application** ;
- un donateur qui a oublié son mot de passe passe **par le WhatsApp de SUNUSOCIAL**, et un modérateur l'aide à le réinitialiser.

---

### Q2 — Qui envoie les alertes de don de sang ?
Quand un hôpital manque d'un groupe sanguin (par exemple O−), une alerte est envoyée aux donneurs compatibles des communes voisines. La question est : **qui appuie sur le bouton « Envoyer l'alerte » ?**

| Option | Fonctionnement | Avantage | Risque |
|---|---|---|---|
| **A. L'hôpital lui-même** | L'hôpital vérifié crée et envoie l'alerte depuis son espace | Rapide, sans intermédiaire, adapté aux urgences | Un hôpital pourrait envoyer trop d'alertes (coût SMS, lassitude des donneurs) |
| **B. Un modérateur SUNUSOCIAL** | L'hôpital contacte SUNUSOCIAL, et un modérateur crée l'alerte | SUNUSOCIAL contrôle chaque envoi | Plus lent : dépend de la disponibilité d'un modérateur, y compris la nuit et le week-end |
| **C. Mixte** | L'hôpital rédige l'alerte, et un modérateur la valide avant l'envoi | Contrôle + autonomie | Le délai de validation reste un frein en urgence |

**En attendant :** seul le modérateur peut envoyer une alerte (comme dans le prototype). L'écran côté hôpital est quand même développé : passer à l'option A ne demandera qu'un réglage.

---

### Q3 — Le modèle de revenus
SUNUSOCIAL ne cherche pas le profit, mais doit couvrir ses frais de fonctionnement (environ 45 000 FCFA/mois d'hébergement, plus les SMS).

**À décider :**

- **Option 1 : un pourcentage sur chaque don.**
  - Combien ? Il s'ajoute aux 3 % de NabooPay. Par exemple, avec 2 % : sur un don de 5 000 FCFA, 150 FCFA vont à NabooPay, 100 FCFA à SUNUSOCIAL et 4 750 FCFA à la structure.
  - Le pourcentage est-il prélevé sur le don, ou proposé au donateur en supplément (« ajouter 100 FCFA pour soutenir SUNUSOCIAL ») ?
- **Option 2 : un abonnement payé par les structures.**
  - Quel montant, et à quelle fréquence ?
  - Que faire d'une structure qui ne peut pas payer ?
- **Option 3 : aucun prélèvement au lancement.** Les frais sont couverts par un financement externe, et la question est revue plus tard.

**En attendant :** aucun prélèvement SUNUSOCIAL. La ligne est déjà prévue dans le calcul des frais : l'activer ne demandera qu'un réglage.

---

### Q4 — La liste officielle des régions et communes
Le prototype couvre 8 régions. La version finale doit couvrir **les 14 régions et toutes leurs communes**. Cette liste sert à l'inscription des donneurs et des structures, et au ciblage des alertes de sang.

**À décider :** nous fournissez-vous la liste, ou nous autorisez-vous à utiliser la liste officielle de l'ANSD ?

**En attendant :** les 8 régions du prototype.

---

## B. Règles de fonctionnement à préciser

### Q5 — Durée maximale d'une cause
Vous avez décidé que toute cause a une date limite. **Quelle est la durée maximale autorisée** entre la publication et la date limite (30, 60, 90 jours ?), et **une structure peut-elle prolonger** sa cause ?

**En attendant :** 90 jours maximum, sans prolongation.

### Q6 — Preuve obligatoire pour toutes les causes financées ?
Aujourd'hui, le délai de 7 jours pour publier une preuve, avec suspension automatique en cas de retard, ne s'applique qu'aux **causes supprimées** dont les fonds ont été versés.

**À décider :** cette règle s'applique-t-elle à **toutes** les causes financées (7 jours après le versement) ? Le délai de 7 jours est-il réaliste quand il faut acheter puis livrer du matériel ?

**En attendant :** le délai est affiché et suivi, mais la suspension automatique n'est appliquée qu'aux causes supprimées.

### Q7 — Qui paie les frais lors d'un remboursement ?
NabooPay prélève 3 % sur chaque don. Si un don est remboursé (demande du donateur, ou cause supprimée), ces frais ne sont généralement pas rendus par le prestataire.

**À décider :** le donateur récupère-t-il **le montant net** (don moins 3 %), ou **la totalité** du don, la différence étant alors prise en charge par SUNUSOCIAL ?

**En attendant :** remboursement du montant net, affiché clairement au donateur.

### Q8 — Montant minimum d'un don
**À décider :** confirmez-vous un minimum de **500 FCFA** (le plus petit montant proposé) ?

### Q9 — À quel nom le compte de réception des fonds doit-il être ?
Chaque structure indique un compte Orange Money ou Wave pour recevoir les fonds.

**À décider :** ce compte doit-il être **au nom de la structure**, ou le compte personnel **du responsable** est-il accepté ? Un compte au nom de la structure limite le risque de détournement, mais beaucoup de petites structures n'en ont pas.

**En attendant :** le compte du responsable est accepté. Il est vérifié par le modérateur, et tout changement de compte bloque les versements jusqu'à une nouvelle validation.

---

## C. Questions juridiques

### Q10 — Données personnelles et données de santé
Le groupe sanguin est une **donnée de santé** au sens de la loi n° 2008-12 sur les données personnelles. Par ailleurs, la plateforme est hébergée **hors du Sénégal** (Vercel et Convex, aux États-Unis ou en Europe).

**À décider :** SUNUSOCIAL se charge-t-elle de la **déclaration ou demande d'autorisation auprès de la CDP** (Commission de Protection des Données Personnelles), y compris pour le transfert des données hors du Sénégal ? Cette démarche est à faire **avant l'ouverture du module de don de sang**.

### Q11 — Statut juridique et collecte de dons
**À décider :** quel est le statut juridique de SUNUSOCIAL (association, ONG, autre) ? Une autorisation est-elle nécessaire pour collecter des dons auprès du public ? NabooPay demandera ces documents pour ouvrir le compte marchand.

### Q12 — Documents légaux
La plateforme a besoin, en français, de **conditions générales d'utilisation**, d'une **politique de confidentialité** et d'une **politique de remboursement**.

**À décider :** qui les rédige (juriste de SUNUSOCIAL, ou modèle proposé par JËFTECH puis relu par un juriste) ?

---

## D. Informations pratiques à nous transmettre

### Q13 — Comptes et identifiants
- **Nom de domaine** souhaité (par ex. `sunusocial.sn`), et qui l'achète.
- **Numéro WhatsApp** officiel de SUNUSOCIAL.
- **Adresse e-mail** d'envoi (par ex. `ne-pas-repondre@…`).
- **Comptes Vercel, Convex et NabooPay :** nous recommandons qu'ils soient **au nom de SUNUSOCIAL** (qui paie l'hébergement), JËFTECH y étant invitée comme administrateur.
- **Premier modérateur :** nom et e-mail de la personne qui modérera la plateforme au lancement.

---

### Récapitulatif

| # | Question | Bloque | Priorité |
|---|---|---|---|
| Q1 | SMS : validation, fournisseur, budget, expéditeur | Alertes sang, double authentification par SMS | 🔴 Haute |
| Q2 | Qui envoie les alertes de sang | Module don de sang | 🔴 Haute |
| Q3 | Modèle de revenus | Calcul des frais affiché aux donateurs | 🔴 Haute |
| Q4 | Liste des 14 régions et communes | Inscriptions et ciblage des alertes | 🔴 Haute |
| Q5 | Durée maximale d'une cause | Formulaire de création de cause | 🟠 Moyenne |
| Q6 | Preuve obligatoire pour toutes les causes | Suspension automatique | 🟠 Moyenne |
| Q7 | Frais lors d'un remboursement | Remboursements | 🟠 Moyenne |
| Q8 | Don minimum | Fenêtre de don | 🟢 Basse |
| Q9 | Nom du compte de réception | Validation des structures | 🟠 Moyenne |
| Q10 | Déclaration CDP | Ouverture du module sang | 🔴 Haute |
| Q11 | Statut juridique | Ouverture du compte NabooPay | 🔴 Haute |
| Q12 | CGU et politiques | Mise en ligne | 🟠 Moyenne |
| Q13 | Domaine, WhatsApp, comptes | Mise en ligne | 🟠 Moyenne |
