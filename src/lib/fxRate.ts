import type { SupabaseClient } from "@supabase/supabase-js";
import { todayStr } from "@/lib/dates";

// Taux de change EGP -> EUR au jour de l'activité (demande de Mélanie,
// 2026-10-19 : "pour chaque activité le taux du jour de l'activité") —
// nécessaire pour convertir les coûts prestataires (donnés en EGP) en
// euros et les comparer au CA (en euros) pour calculer un bénéfice.
//
// Source : l'API gratuite fawazahmed0/currency-api (taux quotidiens,
// historique par date dans l'URL, pas de clé requise), mise en cache dans
// la table fx_rates_egp_eur pour ne pas la re-questionner à chaque calcul
// et pour continuer à fonctionner si elle devient indisponible.
//
// - Une date future (activité pas encore passée) n'a pas encore de vrai
//   taux "du jour" : on utilise le taux le plus récent connu à la place,
//   mis à jour automatiquement une fois la date réellement passée.
// - Taux de secours si l'API et le cache sont tous les deux
//   indisponibles (ne devrait arriver qu'en cas de panne réseau) — à
//   ajuster si le taux réel s'en écarte durablement.
const TAUX_SECOURS_EUR_PAR_EGP = 0.017; // ≈ 58,8 EGP pour 1€, repère 10/2026

function currencyApiUrl(dateStr: string) {
  return `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${dateStr}/v1/currencies/egp.json`;
}

export async function getEurParEgp(supabase: SupabaseClient, dateActivite: string): Promise<number> {
  const today = todayStr();
  const dateCible = dateActivite && dateActivite <= today ? dateActivite : today;

  const { data: cache } = await supabase
    .from("fx_rates_egp_eur")
    .select("eur_per_egp")
    .eq("date", dateCible)
    .maybeSingle();
  if (cache?.eur_per_egp) return Number(cache.eur_per_egp);

  try {
    const res = await fetch(currencyApiUrl(dateCible));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const taux = Number(data?.egp?.eur);
    if (!taux || !Number.isFinite(taux)) throw new Error("Taux introuvable dans la réponse");
    await supabase.from("fx_rates_egp_eur").upsert({ date: dateCible, eur_per_egp: taux });
    return taux;
  } catch {
    // Repli : le taux connu le plus proche en cache (peu importe la
    // date), sinon le taux de secours codé en dur.
    const { data: dernierConnu } = await supabase
      .from("fx_rates_egp_eur")
      .select("eur_per_egp")
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();
    return dernierConnu?.eur_per_egp ? Number(dernierConnu.eur_per_egp) : TAUX_SECOURS_EUR_PAR_EGP;
  }
}
