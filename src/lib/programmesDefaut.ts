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
};

// nomActivite doit être le nom EXACT du catalogue (CatalogueItem.nom) —
// pas de normalisation ici, un nom qui ne matche pas ne pré-remplit
// simplement rien (l'employée garde "+ Ajouter un programme" comme avant).
export function programmeDefautPourActivite(nomActivite: string, siteCaire: string): string {
  const template = PROGRAMMES_DEFAUT[nomActivite];
  if (!template) return "";
  if (!template.includes("{{site_caire}}")) return template;
  if (!siteCaire) return "";
  const label = SITE_CAIRE_LABEL_PROGRAMME[siteCaire] || siteCaire;
  return template.replaceAll("{{site_caire}}", label);
}
