import { ClientHotel, HotelReference, TransfertTaxe } from "@/lib/types";

export function matchHotel(hotelName: string, hotels: HotelReference[]): HotelReference | null {
  const clean = hotelName.trim().toLowerCase();
  if (!clean) return null;
  const exact = hotels.find((h) => h.nom.trim().toLowerCase() === clean);
  if (exact) return exact;
  // Kommo donne souvent le nom officiel complet ("Club Jumbo Bellagio Beach
  // Resort and Spa") alors que la référence hôtel est un nom court/usuel
  // ("Bellagio") — sans repli, la zone (et donc la taxe de transfert) ne
  // serait jamais détectée pour ces hôtels-là. minLength évite qu'un nom
  // de référence trop court fasse un faux positif par sous-chaîne.
  return (
    hotels.find((h) => {
      const nom = h.nom.trim().toLowerCase();
      return nom.length > 3 && (clean.includes(nom) || nom.includes(clean));
    }) || null
  );
}

// Bloc équipe Égypte (copié depuis la fiche client / la vue Réservations) :
// le nom de l'hôtel seul suffit à Hurghada, mais ailleurs (Sahl Hasheesh,
// El Gouna, Makadi...) l'équipe a besoin de la ville pour ne pas confondre
// deux hôtels au nom proche situés dans des zones différentes.
export function hotelDisplayForEgypt(hotelNom: string, ville: string | null | undefined): string {
  const nom = hotelNom || "—";
  if (!ville || ville.trim().toLowerCase() === "hurghada") return nom;
  return `${nom} (${ville})`;
}

// Date courte en anglais (le bloc équipe Égypte est toujours rédigé en
// anglais, voir "Name :"/"Room Number :"/"What's app :" ci-dessus).
const MOIS_EN = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
function fmtDateEn(dateStr: string | null): string {
  if (!dateStr) return "?";
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getDate()} ${MOIS_EN[d.getMonth()]}`;
}

// Séjour multi-hôtels (circuit Cairo → Louxor → Hurghada...) : quel hôtel
// couvre une date donnée — pour afficher, activité par activité dans la vue
// Réservations, uniquement celui où le client se trouve ce jour-là plutôt
// que la liste complète des trois. Quand deux étapes se chevauchent
// exactement un jour (une se termine et la suivante commence le même jour,
// ex. check-out Cairo et check-in Louxor tous deux le 30 août), on
// considère par convention que le client a déjà rejoint le nouvel hôtel —
// c'est la seule étape encore d'actualité pour le reste de la journée. À
// vérifier avec l'équipe si un cas concret contredit cette hypothèse.
export function hotelPourDate(clientHotels: ClientHotel[], dateStr: string | null): ClientHotel | null {
  if (!dateStr || clientHotels.length === 0) return null;
  const matches = clientHotels.filter(
    (h) => (!h.date_arrivee || h.date_arrivee <= dateStr) && (!h.date_depart || dateStr <= h.date_depart)
  );
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];
  return [...matches].sort((a, b) => (b.date_arrivee || "").localeCompare(a.date_arrivee || ""))[0];
}

// Bloc équipe Égypte de la fiche client : un séjour multi-hôtels affiche
// une ligne par étape (ville, nom, dates) plutôt qu'un seul "Hotel : X" qui
// resterait vide (le champ hotel du client n'est jamais rempli quand le
// circuit passe par plusieurs hôtels — voir client_hotels).
export function hotelsEgyptLines(clientHotels: ClientHotel[]): string[] {
  return [...clientHotels]
    .sort((a, b) => a.ordre - b.ordre)
    .map(
      (h) =>
        `Hotel ${h.ville || "?"} : ${h.nom || "—"} (from ${fmtDateEn(h.date_arrivee)} to ${fmtDateEn(h.date_depart)})`
    );
}

// Bloc équipe Égypte d'une activité précise (vue Réservations / fiche
// client) : un seul hôtel, celui où le client est ce jour-là. Sans étape
// multi-hôtels (clientHotels vide), on retombe sur le comportement d'avant
// (hôtel unique du client).
export function hotelEgyptLinePourActivite(
  clientHotels: ClientHotel[],
  dateActivite: string | null,
  hotelNomUnique: string,
  villeUnique: string | null | undefined
): string {
  if (clientHotels.length > 0) {
    const etape = hotelPourDate(clientHotels, dateActivite);
    if (etape) return hotelDisplayForEgypt(etape.nom, etape.ville);
  }
  return hotelDisplayForEgypt(hotelNomUnique, villeUnique);
}

function dansTranche(n: number, min: number | null, max: number | null) {
  if (min !== null && n < min) return false;
  if (max !== null && n > max) return false;
  return true;
}

export type TransfertTaxeResultat =
  | { type: "montant"; montant: number; note: string }
  | { type: "a_demander"; note: string }
  | { type: "aucune" };

// Trouve la tranche de taxe de transfert applicable pour une ville et une
// composition de groupe donnée — jamais un montant deviné : soit une
// tranche précise correspond (montant fixé par Mélanie, voir HELP), soit le
// cas est marqué "à demander" (ex. voyageur seul), soit rien ne correspond
// (aucune taxe connue pour cette ville/tranche) et on ne propose rien.
export function matchTransfertTaxe(
  taxes: TransfertTaxe[],
  ville: string,
  nbAdultes: number,
  nbEnfants: number
): TransfertTaxeResultat {
  const villeClean = ville.trim().toLowerCase();
  if (!villeClean) return { type: "aucune" };
  const tranches = taxes
    .filter((t) => t.ville.trim().toLowerCase() === villeClean)
    .sort((a, b) => a.ordre - b.ordre);

  const tranche = tranches.find((t) => {
    if (t.nb_total_min !== null || t.nb_total_max !== null) {
      return dansTranche(nbAdultes + nbEnfants, t.nb_total_min, t.nb_total_max);
    }
    const adultesOk = dansTranche(nbAdultes, t.nb_adultes_min, t.nb_adultes_max);
    const enfantsOk =
      t.nb_enfants_min === null && t.nb_enfants_max === null
        ? true
        : dansTranche(nbEnfants, t.nb_enfants_min, t.nb_enfants_max);
    return adultesOk && enfantsOk;
  });

  if (!tranche) return { type: "aucune" };
  if (tranche.montant === null) return { type: "a_demander", note: tranche.note };
  return { type: "montant", montant: tranche.montant, note: tranche.note };
}

export type VilleTransfertInfo =
  | { kind: "hurghada" }
  | { kind: "taxe"; ville: string; taxe: TransfertTaxeResultat }
  | { kind: "inconnue" };

// Pour un hôtel du circuit (plusieurs hôtels), la ville est saisie
// directement par l'employée — pas de recherche par nom d'hôtel comme pour
// l'hôtel principal (matchHotel). On ne se prononce que si la ville tapée
// correspond à l'une des zones connues (villesConnues, ex. ZONES_HOTEL) ;
// sinon on ne montre rien plutôt que de risquer un faux positif/négatif.
export function villeTransfertInfo(
  ville: string,
  taxes: TransfertTaxe[],
  nbAdultes: number,
  nbEnfants: number,
  villesConnues: readonly string[]
): VilleTransfertInfo {
  const clean = ville.trim().toLowerCase();
  if (!clean) return { kind: "inconnue" };
  if (clean === "hurghada") return { kind: "hurghada" };
  if (!villesConnues.some((v) => v.trim().toLowerCase() === clean)) return { kind: "inconnue" };
  return { kind: "taxe", ville: ville.trim(), taxe: matchTransfertTaxe(taxes, ville, nbAdultes, nbEnfants) };
}
