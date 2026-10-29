// Programmes pré-remplis par défaut pour certaines activités "déjà sur
// place" / sur mesure (Caire, Louxor) — demande de Mélanie, 2026-10-29.
//
// Volontairement séparé du Catalogue (CatalogueItem.programme, qui nourrit
// le flyer client et la fiche catalogue en lecture) : ceci ne pré-remplit
// que le champ "programme_personnalise" propre à CHAQUE réservation client,
// dans AddActivityWizard — rien à voir avec le catalogue ni le flyer.
//
// {{site_caire}} est remplacé par le choix réellement fait sur la
// réservation (champ r.site_caire) — jamais par la liste complète des
// options possibles (vécu : "Afternoon : Old museum, GEM, Citadelle and
// Souk, Saqarrah" ne doit afficher QUE le site choisi, ex. "Afternoon :
// GEM").
export const SITE_CAIRE_LABEL_PROGRAMME: Record<string, string> = {
  "Musée du Caire (ancien musée)": "Old museum",
  Saqqarah: "Saqqarah",
  "Citadelle Mohamed Ali": "Citadelle",
  "Grand Egyptian Museum (nouveau musée)": "GEM",
  Souk: "Souk",
};

export const PROGRAMMES_DEFAUT: Record<string, string> = {
  "Le Caire 1 jour (déjà sur place)": `Program already in Cairo :

* Pyramids
* Sphinx
* Afternoon : {{site_caire}}`,

  "Le Caire 2 jours (déjà sur place)": `Program day 1 : (already in Cairo)

* Pyramids + Sphinx
* Saqarrah

Program day 2 : (already in Cairo)

* Citadelle + Mosque Mohamed Ali
* {{site_caire}}
* Souk Khan El Khalili`,

  "Louxor 1 jour (déjà sur place)": `Program : (already in Louxor, stay in Louxor)

* Karnak
* Valley of kings
* Hatchepsut
* boat on the Nile`,

  "Louxor 2 jours (déjà sur place)": `Program day 1 : already in Louxor, stay in Louxor

* Karnak Temple
* Louxor Temple

Program day 2 : already in Louxor, stay in Louxor

* Valley of kings
* Colosses of Memnon
* Hatchepsut
* Boat on the Nile`,

  "Le Caire en voiture privée": `Program go and back from hurghada :

* Pyramids
* Sphinx
* Afternoon : {{site_caire}}`,

  "Louxor en voiture privée": `Program go and back from hurghada :

* Karnak Temple
* Valley of Kings
* Colosses of Memnon
* Hatchepsut
* Boat on the nile`,

  "Le Caire en avion": `Program :
Go and back from Hurghada (by plane)

* Pyramids + Sphinx
* Afternoon : {{site_caire}}`,

  "Louxor 2 jours Montgolfière (aller-retour Hurghada)": `Program day 1 :

* Departure from Hurghada to Louxor
* Karnak Temple
* Louxor Temple

Program day 2 :

* Balloon
* Valley of kings
* Colosses of Memnon
* Hatchepsut
* Boat on the Nile
* Transfer back from Louxor to Hurghada`,

  // Sens "Louxor" du choix proposé sur cette activité (voir
  // transfertSensOptions dans resa.ts) — client déjà sur place à Louxor,
  // transfert retour vers Hurghada en fin de séjour.
  "Louxor 2 jours Montgolfière (depuis Louxor et transfert vers Hurghada)": `Program day 1 :

* Departure from Louxor : clients already in Louxor
* Karnak Temple
* Louxor Temple

Program day 2 :

* Balloon
* Valley of kings
* Colosses of Memnon
* Hatchepsut
* Boat on the Nile
* Transfer back from Louxor to Hurghada`,

  // Sens "Hurghada" du même choix — client part de Hurghada, reste à
  // Louxor ensuite (pas de retour vers Hurghada inclus ici).
  "Louxor 2 jours Montgolfière (depuis Hurghada — reste à Louxor)": `Program day 1 :

* Departure from Hurghada to Louxor
* Karnak Temple
* Louxor Temple

Program day 2 :

* Balloon
* Valley of kings
* Colosses of Memnon
* Hatchepsut
* Boat on the Nile
* Stay in Louxor`,
};

// nomActivite doit être le nom RÉSOLU de la réservation (r.nom_activite),
// pas forcément le nom du catalogue — certaines activités (ex. "Louxor 2
// jours Montgolfière (depuis Louxor et transfert vers Hurghada)") ont un
// choix de sens (voir transfertSensOptions, resa.ts) qui change le titre
// dès la création, avant même d'atteindre l'étape "Options" ; s'appuyer sur
// le nom catalogue générique aurait raté cette distinction. Un nom qui ne
// matche aucune entrée ne pré-remplit simplement rien (l'employée garde
// "+ Ajouter un programme" comme avant).
export function programmeDefautPourActivite(nomActivite: string, siteCaire: string): string {
  const template = PROGRAMMES_DEFAUT[nomActivite];
  if (!template) return "";
  if (!template.includes("{{site_caire}}")) return template;
  if (!siteCaire) return "";
  const label = SITE_CAIRE_LABEL_PROGRAMME[siteCaire] || siteCaire;
  return template.replaceAll("{{site_caire}}", label);
}
