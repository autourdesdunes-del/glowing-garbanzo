# Brief de reconstruction — CRM Autour des Dunes

Ce document résume tout ce qui a été validé pas à pas dans une longue session de travail. Objectif : que Claude Code reparte de ces règles directement, sans redécouvrir par erreur ce qui a déjà été corrigé.

**Fichier joint** : `travel_crm.jsx` — la version actuelle (artifact Claude, mémoire non partagée réellement en dehors de Claude.ai). Sert de référence pour la logique métier et l'UX déjà validées, pas forcément à copier ligne à ligne.

---

## 1. Contexte business

Agence : **Autour des Dunes**, Hurghada, agence francophone fondée par Hossam et Mélanie. Site : autourdesduneshurghada.com. WhatsApp officiel : +20 155 622 1115 (un numéro temporaire est utilisé actuellement le temps de migrer le vrai numéro, encore sur l'app WhatsApp classique).

Process actuel (avant ce projet) : acquisition via Instagram/WhatsApp/TikTok/Email → qualification manuelle par une employée → proposition et négociation → collecte d'infos → création de fiche dans Notion → billets d'avion gérés par Hossam → disponibilités fournisseurs par contact direct → communication avec l'équipe Égypte par WhatsApp (bloc copier-coller) → paiement (acompte + solde) → confirmation → organisation opérationnelle → pick-up → suivi incidents → fin de séjour (message à J+1, avis à J+7).

Objectif du logiciel : que même une employée peu expérimentée puisse opérer sans tout mémoriser. **Bascule complète prévue depuis Notion vers ce CRM.**

Charte graphique : palette terracotta/rust (#5C2A1D, #8B4531) + sable (#F2E6D2) + bleu sarcelle (#0F5C56, mer Rouge) + or (#C9973E). Typo : Fraunces (titres), Work Sans (texte), Space Mono (dates/montants).

---

## 2. Règles métier à ne PAS reproduire de travers (erreurs déjà corrigées)

Ce sont les points où une première version était fausse — à implémenter correctement dès le départ :

- **Un seul acompte + un seul solde par client, jamais un paiement par activité.** Le solde couvre tout le séjour et n'est rattaché qu'à un seul endroit : soit la première activité où il est encaissé, soit un rendez-vous dédié à l'hôtel (avec heure, lieu, personne assignée). Ne jamais permettre de créer plusieurs "soldes" liés à des activités différentes pour un même client.
- **Le total du séjour se calcule automatiquement** en additionnant le prix de chaque activité (PU adulte × nb adultes + PU enfant × nb enfants + options + transfert). Ce n'est jamais un champ saisi à la main.
- **"Horaire approximatif" est un champ interne, jamais montré au client.** Le client ne voit que le "pick-up réel", confirmé la veille par l'équipe. Les deux champs doivent exister séparément.
- **PAX (participants) n'est pas toujours "adultes + enfants".** Prévoir un champ texte libre optionnel (ex. "2 participants, 1 accompagnateur") qui remplace l'affichage calculé quand il est rempli — c'est le vrai vocabulaire utilisé en interne.
- **Dans la fiche client**, une activité "Confirmée" doit s'afficher en carte minimale (nom, date, total) — mais avec les **options et infos importantes toujours visibles sans avoir à cliquer** (petits badges), pas juste une ligne plate. Une activité "Brouillon" affiche le détail complet avec avertissements.
- **Dans la vue globale "Réservations"** (toutes les activités de tous les clients, par date), l'affichage reste toujours complet — la version minimale "confirmée" ne s'applique qu'à l'intérieur de la fiche d'un client, pas dans cette vue globale. Les deux vues ont des règles d'affichage différentes, volontairement.
- **Le catalogue d'activités** doit pouvoir être "validé" une fois rempli — vue minimale ensuite (nom / disponibilités / PU adulte / PU enfant / PU bébé), détail complet accessible en cliquant.
- **Le bloc copier-coller pour l'équipe Égypte** (format : `Name : X` / `{n} adults` / `Hotel : X` / `Room Number : X` / `What's app : X`) vit dans la partie "Séjour", pas dans "Paiements" — la date et le nom de l'activité restent tapés à la main par l'employée, seule la partie client est automatisée.

---

## 3. Modèle de données stabilisé

### Client
```
nom, canal (Contact via : Instagram/WhatsApp/TikTok/Email/Autre), pseudoContact (si Instagram/TikTok), canalAutre,
relationGraceA (Bouche à oreille/Instagram/TikTok/Influenceurs/Google/Site internet/Le Petit Futé/
  Élodie Gossuin/VIP Mélanie/Agence de voyage/TripAdvisor/ChatGPT/GetYourGuide/Autre), relationAutre,
statut (Prospect/En négociation/Client confirmé/Perdu),
telephone, email, hotel, chambre, dateDebut, dateFin,
adultes, enfants, agesEnfants, participantNoms,
lienPasseport (lien Drive — jamais de vrai fichier uploadé),
infosManquantes[] (multi-select : Complet/Room number/Date de RDV/Numéro WhatsApp/Billets d'avion/
  Passeport/Acompte PayPal/Localisation/Ticket de train/Autre), infoManquanteAutre,
commentaires,
paiements[] (ACOMPTES uniquement : {montant, mode, date}),
solde: {montant, mode, date, paye, activiteId (ou vide = RDV dédié), rdvHeure, rdvLieu, assigneA},
reservations[], remboursements[], verifications[],
auRevoirEnvoye, avisEnvoye,
billetAvion: {requis, acomptePaye, billetEnvoye, lienBillet, statut, notes, date, activiteId}
```

### Réservation (activité d'un client)
```
nomActivite, dateDebut, dateFin (plage possible pour activités multi-jours),
moment (Matin/Après-midi/Journée/Plusieurs jours),
puAdulte, puEnfant, participantsMode (tous/custom), participantsAdultes, participantsEnfants, participantsNoms,
paxOverride (texte libre optionnel),
options[] ({nom, prix} — préréglages : Guide francophone/Privatif/Autre),
transfertInclus (bool), transfertMontant,
horaireApprox (INTERNE), pickupReel (visible client, rempli la veille),
pointRdv, inclus, nonInclus, aPrevoir,
infoImportante (encadré rouge, interne),
coutReel (pour calcul de marge), photoUrl (image pour le portail client),
statutResa (Brouillon/Confirmée)
```

### Catalogue (activité type, réutilisable)
```
nom, disponibilites, puAdulte, puEnfant, puBebe, margePct,
horaireApprox, inclus, nonInclus, aPrevoir, pointRdv, valide (bool)
```

### Remboursement
```
montant, raison (Annulation/Problème activité/Dédommagement/Autre) + raisonAutre,
activiteId (liée ou non), dateProbleme, mode, par, dateRemboursement, statut (En attente/Effectué)
```

### Vérification de dossier
```
nom (qui a vérifié), date
```

---

## 4. Structure de l'outil (vues/onglets)

- **Vue équipe** : liste de clients (recherche), fiche client en **assistant par étapes** cliquables et navigables librement, rien n'est perdu en changeant d'étape :
  1. Contact
  2. Séjour (+ bloc copier-coller Égypte à la fin)
  3. Billet d'avion
  4. Activités
  5. Paiements (acomptes + solde unique)
  6. Suivi (remboursements, vérification, commentaires)
- **Catalogue** : gestion des activités types, avec validation/vue minimale
- **Suivis** : sous-onglets — RDV paiements (tous clients), Au revoir (J+1 après retour), Avis clients (J+7), Remboursements, Billets d'avion (pour Hossam) — chaque ligne cliquable pour ouvrir le détail et/ou sauter à la fiche client
- **Réservations** : toutes les activités de tous les clients, en cartes, groupées par date, filtres rapides Hier/Aujourd'hui/Demain/Prochainement/Ce mois-ci/Tout
- **Aperçu client** : simulation de ce que verrait le client — reprend fidèlement le prototype `portail_client_v2.html` (voir section 5)
- **Direction** : protégé par un code simple (pas une vraie sécurité), CA total/marge, CA par mois/année, marge de référence éditable par activité du catalogue, activités les plus vendues/rentables, plus gros clients

### Design des cartes (règle générale)
- **Brouillon/non validé** → carte détaillée avec avertissements visibles (⚠️ montant à régler, infos importantes, options)
- **Confirmé/validé** → carte minimale (nom, date, total, badges options/infos toujours visibles sans clic) — cliquer réouvre le détail complet, avec bouton pour repasser en brouillon

---

## 5. Portail client ("Aperçu client") — fidèle au prototype validé

Doit reprendre, en dynamique (à partir des vraies données) :
- Bandeau façon billet d'avion : salutation, dates, hôtel, voyageurs, décompte (J-X avant départ / En Égypte, retour dans X j / Dernier jour / Séjour terminé)
- Tracker de progression en 6 étapes : Réservation confirmée → Acompte reçu → Préparation → Départ → En Égypte → Retour
- Accordéon : Mon séjour / Mes paiements / Mes activités (avec **photo** par activité, inclus/non inclus, à prévoir, pick-up réel — jamais l'horaire approximatif) / Guide Égypte (FAQ, contenu de départ à enrichir)
- Section "Envie de plus ?" — suggestions tirées du catalogue validé, hors activités déjà réservées, bouton "Je suis intéressé(e)"
- "Besoin d'aide ?" — recherche qui filtre le Guide Égypte en direct, lien de secours WhatsApp
- "Un souci ?" — raccourcis annulation / transfert introuvable
- Bandeau final "Une autre question ? — Écrire sur WhatsApp"

---

## 6. Ce qui n'existe pas encore (chantiers ouverts, pas urgents)

- Vraie authentification par utilisateur (aujourd'hui : accès partagé, code simple pour Direction — pas une vraie sécurité)
- Catalogue vide — aucune des ~70 activités réelles du site n'est encore rentrée
- Aucun pont entre ce CRM, respond.io (automatisations WhatsApp/Instagram déjà construites côté respond.io) et Notion (encore utilisé en parallèle)
- Pas de suivi des disponibilités fournisseurs
- Pas de génération de documents (confirmation, facture)
- Pas d'historique des modifications / annulation
- KPIs jamais implémentés (taux de conversion par canal, temps de réponse, etc.)

---

## 7. Ce qu'on attend de Claude Code, concrètement

1. Mettre en place un vrai backend partagé (Supabase recommandé — compte à créer par l'utilisatrice, pas par Claude)
2. Reconstruire l'outil en app web réelle, déployée (Vercel ou Netlify), avec authentification simple (email/mot de passe suffit pour démarrer, un seul espace de travail partagé par l'équipe)
3. Reprendre fidèlement les règles des sections 2 à 5 ci-dessus — ce sont des règles métier réelles, validées avec l'utilisatrice après plusieurs allers-retours, pas des détails à réinterpréter
4. Garder `travel_crm.jsx` comme référence de l'UX déjà éprouvée (couleurs, typographie, structure des cartes, wording), sans obligation de garder le code tel quel
