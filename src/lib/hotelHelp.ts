import { HotelReference, TransfertTaxe } from "@/lib/types";

export function matchHotel(hotelName: string, hotels: HotelReference[]): HotelReference | null {
  const clean = hotelName.trim().toLowerCase();
  if (!clean) return null;
  return hotels.find((h) => h.nom.trim().toLowerCase() === clean) || null;
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
