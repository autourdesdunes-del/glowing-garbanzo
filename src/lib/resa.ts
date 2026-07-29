import { Client, Reservation, ReservationOption } from "@/lib/types";

export function participantsFor(r: Reservation, client: Client) {
  const nbAd =
    r.participants_mode === "tous" ? Number(client.adultes) || 0 : Number(r.participants_adultes) || 0;
  const nbEnf =
    r.participants_mode === "tous" ? Number(client.enfants) || 0 : Number(r.participants_enfants) || 0;
  return { nbAd, nbEnf };
}

export function resaTotalMontant(
  r: Reservation,
  client: Client,
  options: ReservationOption[] = []
) {
  const { nbAd, nbEnf } = participantsFor(r, client);
  const base = nbAd * (Number(r.pu_adulte) || 0) + nbEnf * (Number(r.pu_enfant) || 0);
  const optionsTotal = options.reduce((s, o) => s + (Number(o.prix) || 0), 0);
  const transfert = r.transfert_inclus ? 0 : Number(r.transfert_montant) || 0;
  return base + optionsTotal + transfert;
}
