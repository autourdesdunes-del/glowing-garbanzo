import type { SupabaseClient } from "@supabase/supabase-js";

// PostgREST plafonne chaque requête à un maximum de lignes (1000 sur ce
// projet) même sans .limit() explicite dans le code — un simple
// .select("*") silencieux perd les lignes au-delà de ce seuil, sans erreur
// ni avertissement. Découvert le 13/09 : la table `clients` avait dépassé
// 1000 lignes, et les 71 clients les plus anciens (donc, pour les
// prospects, les plus urgents à relancer selon urgenceProspect) avaient
// disparu de tout le CRM — tableau de bord, Kanban, listes — sans que rien
// ne le signale. Ce helper boucle par pages de 1000 jusqu'à épuisement au
// lieu de faire confiance à une seule requête.
export async function fetchAllRows<T>(
  supabase: SupabaseClient,
  table: string,
  select: string,
  orderColumn: string,
  ascending: boolean
): Promise<{ data: T[]; error: null }> {
  const pageSize = 1000;
  let from = 0;
  const all: T[] = [];
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .order(orderColumn, { ascending })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...(data as T[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return { data: all, error: null };
}
