// Phrases de "Luis", le coéquipier CRM qui rappelle de faire les 3
// vérifications de dossier quotidiennes (popup LuisAssistant.tsx) — demande
// de Mélanie, 2026-10-29. Plusieurs variantes par partie du message,
// tirées au hasard à chaque affichage, pour éviter l'effet "même phrase
// copiée-collée" vue tous les jours.

function pick<T>(options: T[]): T {
  return options[Math.floor(Math.random() * options.length)];
}

// Réservations rentrées la veille (ou le dernier jour travaillé si la
// personne était off la veille) — affiché seulement au 1er rappel du jour.
// avecSalutation=false quand le message de présentation vient déjà de dire
// bonjour juste au-dessus (évite "Salut Sylvie !" puis "Coucou Sylvie !"
// dans la même bulle, remonté par Mélanie, 2026-10-29).
export function ligneBravoDernierJour(
  prenom: string,
  count: number,
  label: string,
  avecSalutation = true
): string | null {
  if (count <= 0) return null;
  const labelMaj = label.charAt(0).toUpperCase() + label.slice(1);
  if (!avecSalutation) {
    return pick([
      `Bravo, ${label} t'as cartonné avec ${count} réservation${count > 1 ? "s" : ""} rentrée${count > 1 ? "s" : ""} 🎉`,
      `${labelMaj} tu as rentré ${count} réservation${count > 1 ? "s" : ""} — beau travail 👏`,
      `Petit coup de chapeau : ${count} réservation${count > 1 ? "s" : ""} rentrée${count > 1 ? "s" : ""} ${label} 🙌`,
    ]);
  }
  return pick([
    `Coucou ${prenom} ! Bravo, ${label} t'as cartonné avec ${count} réservation${count > 1 ? "s" : ""} rentrée${count > 1 ? "s" : ""} 🎉`,
    `Salut ${prenom} ! ${labelMaj} tu as rentré ${count} réservation${count > 1 ? "s" : ""} — beau travail 👏`,
    `Hello ${prenom} ! Petit coup de chapeau : ${count} réservation${count > 1 ? "s" : ""} rentrée${count > 1 ? "s" : ""} ${label} 🙌`,
  ]);
}

// Reprises plus tard dans la journée (2e/3e rappel) — réservations déjà
// rentrées AUJOURD'HUI, pas la veille (demande de Mélanie, 2026-10-29).
export function ligneProgressionAujourdhui(prenom: string, count: number): string {
  if (count <= 0) {
    return pick([
      `Coucou ${prenom} !`,
      `Rebonjour ${prenom} !`,
      `Petit passage, ${prenom} !`,
    ]);
  }
  return pick([
    `Coucou ${prenom} ! Tu as déjà rentré ${count} réservation${count > 1 ? "s" : ""} aujourd'hui, continue comme ça 💪`,
    `Rebonjour ${prenom} ! ${count} réservation${count > 1 ? "s" : ""} rentrée${count > 1 ? "s" : ""} aujourd'hui — nickel.`,
    `Hello ${prenom} ! Déjà ${count} réservation${count > 1 ? "s" : ""} au compteur aujourd'hui 🙌`,
  ]);
}

export function ligneDossierIncomplet(nomClient: string, detail: string): string {
  return pick([
    `Un petit coup d'œil sur le dossier d'${nomClient} ? ${detail}`,
    `Pense à regarder le dossier d'${nomClient} — ${detail}`,
    `Et si tu complétais le dossier d'${nomClient} ? ${detail}`,
  ]);
}

export function ligneQuotaExplication(): string {
  return pick([
    "Et comme chaque jour, 3 petites vérifs de dossier à faire — tu gères, j'y crois 💪",
    "Pour rappel : grâce à l'outil de vérification de dossier, il t'en faut 3 par jour.",
    "Petit rappel du jour : 3 vérifications de dossier à faire, comme d'habitude.",
  ]);
}

export function ligneEncouragementProche(resteAFaire: number): string {
  if (resteAFaire === 1) {
    return pick([
      "Plus qu'un dossier et tu as fini ta journée vérif 💪",
      "Il t'en reste 1 — tu gères 🙌",
      "Dernière ligne droite, encore un et c'est bouclé !",
    ]);
  }
  return pick([
    `Encore ${resteAFaire} et c'est fini pour aujourd'hui.`,
    `Il t'en reste ${resteAFaire} — tu y es presque.`,
  ]);
}

export function ligneAvertissement2eRappel(): string {
  return pick([
    "Si tu n'as pas le temps d'ici le prochain rappel, je t'emmènerai directement sur la page de vérif tant que tes 3 ne sont pas faites.",
    "Pense à t'y mettre avant mon prochain passage, sinon je t'amène directement sur la page de vérif jusqu'à ce que ce soit fait.",
  ]);
}

export function journeeTermineeMessage(): string {
  return pick(["Journée nickel, tout est à jour ✅ À demain !", "3/3 aujourd'hui, bravo ✅ À demain !"]);
}
