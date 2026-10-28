import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllRows } from "@/lib/supabase/fetchAll";

// Les messages viennent directement de l'API Kommo (events), pas de notre
// table interne kommo_webhook_events — celle-ci s'est avérée ne capter
// qu'environ 8% des messages réels (175 vs 8 constatés le 2026-10-28, le
// Salesbot Kommo qui l'alimente ne couvre visiblement pas tout le
// pipeline/tous les canaux). Fenêtre fixe depuis le 20/09/2026 (demande de
// Mélanie) plutôt qu'une fenêtre glissante de 30/182/365 jours : au-delà,
// le volume réel (~300-500 messages/jour) demanderait des centaines voire
// des milliers de pages à l'API Kommo à chaque chargement, bien trop lent.
const MESSAGES_HISTORY_START = "2026-09-19T22:00:00Z"; // 2026-09-20 00:00 heure d'Égypte

// La récupération séquentielle des messages Kommo (voir plus bas) peut
// prendre jusqu'à ~45-60s sur la fenêtre depuis le 20/09 — bien au-delà des
// 10s par défaut de Vercel.
export const maxDuration = 90;

type KommoEvent = { created_at: number; entity_id: number; entity_type: string };

// Une seule page à la fois, jamais en parallèle : testé en parallèle
// (lots de 3 à 6), l'API Kommo renvoie sporadiquement des réponses vides ou
// un JSON tronqué sous cette charge — indiscernable d'une "dernière page"
// (moins de 250 résultats), ce qui tronquait silencieusement des milliers
// d'événements sans erreur visible. Plus lent (~45s pour toute la fenêtre
// depuis le 20/09) mais fiable — un chiffre faux dans une page Direction
// est pire qu'une page un peu longue à charger.
async function fetchKommoEventsPage(
  type: "incoming_chat_message" | "outgoing_chat_message",
  fromEpoch: number,
  toEpoch: number,
  page: number,
  attempt = 1
): Promise<{ ok: boolean; items: KommoEvent[] }> {
  const subdomain = process.env.KOMMO_SUBDOMAIN;
  const token = process.env.KOMMO_ACCESS_TOKEN;
  if (!subdomain || !token) return { ok: false, items: [] };
  const base = `https://${subdomain}.kommo.com/api/v4`;
  const url = `${base}/events?filter[type]=${type}&filter[created_at][from]=${fromEpoch}&filter[created_at][to]=${toEpoch}&page=${page}&limit=250`;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const items = (json?._embedded?.events || []) as KommoEvent[];
    return { ok: true, items };
  } catch {
    // Jamais traiter un échec réseau/JSON comme "plus de pages" — on
    // réessaie avant d'abandonner cette page précise.
    if (attempt < 4) {
      await new Promise((r) => setTimeout(r, 300 * attempt));
      return fetchKommoEventsPage(type, fromEpoch, toEpoch, page, attempt + 1);
    }
    return { ok: false, items: [] };
  }
}

async function fetchKommoEventsAll(
  type: "incoming_chat_message" | "outgoing_chat_message",
  fromEpoch: number,
  toEpoch: number
): Promise<KommoEvent[]> {
  const all: KommoEvent[] = [];
  const MAX_PAGES = 400; // garde-fou (~100 000 events par type)
  let page = 1;
  for (;;) {
    const { ok, items } = await fetchKommoEventsPage(type, fromEpoch, toEpoch, page);
    if (!ok) break; // échec persistant malgré les tentatives : on s'arrête là plutôt que de boucler indéfiniment
    all.push(...items);
    if (items.length < 250 || page >= MAX_PAGES) break;
    page++;
  }
  return all;
}

// Stat agences (Direction > Statistiques) — demande de Mélanie, 2026-10-28 :
// messages entrants/sortants (par jour/semaine/mois + répartition par
// heure + temps de réponse moyen), réservations rentrées (par jour/semaine/
// mois + qui en rentre le plus, normalisé par jour travaillé + matin/après-
// midi), et taux de conversion par canal. Calculé côté serveur (jamais
// chargé dans l'état global d'AppShell, potentiellement des dizaines de
// milliers de lignes de kommo_webhook_events) et réservé à la Direction,
// comme les autres routes /api/direction/*.
export async function GET(request: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Non authentifié." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "direction") {
    return Response.json({ error: "Réservé à la Direction." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const range = searchParams.get("range") === "week" || searchParams.get("range") === "month" ? searchParams.get("range") : "day";

  // Fenêtre glissante selon le niveau de détail demandé : assez large pour
  // remplir le graphique de tendance (30 jours / 26 semaines / 12 mois),
  // et réutilisée telle quelle pour la répartition par heure, le temps de
  // réponse, le classement par employée, le matin/après-midi et la
  // conversion par canal (même période partout, cohérent avec le bouton
  // jour/semaine/mois).
  const joursParRange: Record<string, number> = { day: 30, week: 182, month: 365 };
  const depuis = new Date(Date.now() - joursParRange[range as string] * 86400000).toISOString();

  const messagesFromEpoch = Math.floor(new Date(MESSAGES_HISTORY_START).getTime() / 1000);
  const messagesToEpoch = Math.floor(Date.now() / 1000);

  const [inEvents, outEvents, { data: reservations }, { data: profiles }, { data: shifts }, { data: clientsCanal }] =
    await Promise.all([
      fetchKommoEventsAll("incoming_chat_message", messagesFromEpoch, messagesToEpoch),
      fetchKommoEventsAll("outgoing_chat_message", messagesFromEpoch, messagesToEpoch),
      fetchAllRows<{ created_at: string; cree_par_nom: string }>(
        admin,
        "reservations",
        "created_at, cree_par_nom",
        "created_at",
        false
      ),
      admin.from("profiles").select("id, prenom"),
      admin.from("planning_shifts").select("user_id, date, statut").gte("date", depuis.slice(0, 10)),
      admin.from("clients").select("canal, statut, created_at").gte("created_at", depuis),
    ]);

  const events: { created_at: string; direction: "in" | "out"; groupKey: string }[] = [
    ...inEvents.map((e) => ({
      created_at: new Date(e.created_at * 1000).toISOString(),
      direction: "in" as const,
      groupKey: `${e.entity_type}:${e.entity_id}`,
    })),
    ...outEvents.map((e) => ({
      created_at: new Date(e.created_at * 1000).toISOString(),
      direction: "out" as const,
      groupKey: `${e.entity_type}:${e.entity_id}`,
    })),
  ];

  return Response.json({
    range,
    messages: buildMessagesStats(events, range as string),
    reservations: buildReservationsStats(
      (reservations || []).filter((r) => r.created_at >= depuis),
      range as string,
      profiles || [],
      shifts || []
    ),
    conversion: buildConversionStats(clientsCanal || []),
  });
}

// --- Regroupement par bucket (jour/semaine/mois), en heure locale du
// serveur Vercel (UTC) — cohérent avec created_at (timestamptz), pas
// d'ambiguïté de fuseau côté agrégation ; seul l'affichage par heure ci-
// dessous a vraiment besoin d'un fuseau "métier".

function isoWeekLabel(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `S${String(weekNo).padStart(2, "0")} ${date.getUTCFullYear()}`;
}

function bucketLabel(dateStr: string, range: string): string {
  const d = new Date(dateStr);
  if (range === "month") {
    return d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit", timeZone: "UTC" });
  }
  if (range === "week") {
    return isoWeekLabel(d);
  }
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
}

// Clé de tri chronologique (le label affiché seul ne trie pas bien, ex.
// "S02 2027" avant "S45 2026" alphabétiquement).
function bucketSortKey(dateStr: string, range: string): string {
  const d = new Date(dateStr);
  if (range === "month") return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  if (range === "week") {
    const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `${date.getUTCFullYear()}-${String(weekNo).padStart(2, "0")}`;
  }
  return dateStr.slice(0, 10);
}

function buildMessagesStats(
  events: { created_at: string; direction: "in" | "out"; groupKey: string }[],
  range: string
) {
  const trendMap = new Map<string, { label: string; sortKey: string; in: number; out: number }>();
  // 0-23h, heure d'Égypte (Africa/Cairo, UTC+2 toute l'année depuis l'arrêt
  // de l'heure d'été égyptienne en 2016) — c'est l'heure à laquelle
  // l'équipe sur place lit/répond réellement aux messages.
  const byHour = Array.from({ length: 24 }, (_, h) => ({ hour: h, in: 0, out: 0 }));
  // Lundi en premier (convention FR), toujours en heure d'Égypte — demande
  // de Mélanie, 2026-10-28 : quels jours de la semaine reçoivent le plus/le
  // moins de messages entrants.
  const JOURS_FR = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
  const byWeekday = JOURS_FR.map((name) => ({ name, in: 0, out: 0 }));

  // Temps de réponse : pour chaque conversation (lead/contact Kommo), on
  // apparie le premier message entrant d'une "rafale" (le client peut
  // écrire plusieurs messages de suite avant une réponse) avec le prochain
  // message sortant — jamais l'inverse (un sortant qui suit un sortant, ou
  // un entrant déjà "répondu" ne redémarre pas le chrono). Pas d'auteur
  // dans ces events Kommo : le temps de réponse reste global, pas par
  // employée.
  const parConversation = new Map<string, { created_at: string; direction: "in" | "out" }[]>();
  for (const e of events) {
    const direction = e.direction;
    const key = bucketSortKey(e.created_at, range);
    if (!trendMap.has(key)) {
      trendMap.set(key, { label: bucketLabel(e.created_at, range), sortKey: key, in: 0, out: 0 });
    }
    trendMap.get(key)![direction] += 1;

    const heureEgypte = (new Date(e.created_at).getUTCHours() + 2) % 24;
    byHour[heureEgypte][direction] += 1;

    // +2h d'abord (décalage Égypte), puis le jour de la semaine de la date
    // décalée — sinon un message reçu après 22h UTC (après minuit en
    // Égypte) se comptait sur le mauvais jour.
    const dateEgypte = new Date(new Date(e.created_at).getTime() + 2 * 3600000);
    const jsWeekday = dateEgypte.getUTCDay(); // 0 = dimanche ... 6 = samedi
    const mondayFirst = jsWeekday === 0 ? 6 : jsWeekday - 1;
    byWeekday[mondayFirst][direction] += 1;

    if (!parConversation.has(e.groupKey)) parConversation.set(e.groupKey, []);
    parConversation.get(e.groupKey)!.push({ created_at: e.created_at, direction });
  }

  const reponseTrendMap = new Map<string, { label: string; sortKey: string; totalMinutes: number; count: number }>();
  for (const liste of parConversation.values()) {
    liste.sort((a, b) => a.created_at.localeCompare(b.created_at));
    let pendingInAt: string | null = null;
    for (const evt of liste) {
      if (evt.direction === "in") {
        if (!pendingInAt) pendingInAt = evt.created_at;
      } else if (pendingInAt) {
        const minutes = (new Date(evt.created_at).getTime() - new Date(pendingInAt).getTime()) / 60000;
        if (minutes >= 0) {
          const key = bucketSortKey(pendingInAt, range);
          if (!reponseTrendMap.has(key)) {
            reponseTrendMap.set(key, { label: bucketLabel(pendingInAt, range), sortKey: key, totalMinutes: 0, count: 0 });
          }
          const bucket = reponseTrendMap.get(key)!;
          bucket.totalMinutes += minutes;
          bucket.count += 1;
        }
        pendingInAt = null;
      }
    }
  }

  const trend = [...trendMap.values()].sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  const responseTrend = [...reponseTrendMap.values()]
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    .map((b) => ({ label: b.label, averageMinutes: b.count > 0 ? Math.round(b.totalMinutes / b.count) : 0, count: b.count }));
  const totalPaires = responseTrend.reduce((s, b) => s + b.count, 0);
  const totalMinutes = [...reponseTrendMap.values()].reduce((s, b) => s + b.totalMinutes, 0);
  const averageMinutesGlobal = totalPaires > 0 ? Math.round(totalMinutes / totalPaires) : null;

  return { trend, byHour, byWeekday, responseTrend, averageMinutesGlobal };
}

function buildReservationsStats(
  reservations: { created_at: string; cree_par_nom: string }[],
  range: string,
  profiles: { id: string; prenom: string }[],
  shifts: { user_id: string; date: string; statut: string }[]
) {
  const trendMap = new Map<string, { label: string; sortKey: string; count: number }>();
  const employeeCount = new Map<string, number>();
  let matin = 0;
  let apresMidi = 0;

  for (const r of reservations) {
    const key = bucketSortKey(r.created_at, range);
    if (!trendMap.has(key)) {
      trendMap.set(key, { label: bucketLabel(r.created_at, range), sortKey: key, count: 0 });
    }
    trendMap.get(key)!.count += 1;

    // Jamais "Import Notion" (bascule historique, pas une vraie employée) —
    // fausserait le classement sans refléter une vraie activité récente.
    const nom = (r.cree_par_nom || "").trim();
    if (nom && nom !== "Import Notion") {
      employeeCount.set(nom, (employeeCount.get(nom) || 0) + 1);
    }

    const heureEgypte = (new Date(r.created_at).getUTCHours() + 2) % 24;
    if (heureEgypte < 12) matin += 1;
    else apresMidi += 1;
  }

  // Jours travaillés par employée sur la même fenêtre — "travail" et
  // "superviseur" comptent comme présence, jamais "repos"/"conge"/"recup".
  // Un même jour avec deux shifts (coupure) ne compte qu'une fois : c'est
  // une journée de présence, pas deux.
  const prenomById = new Map(profiles.map((p) => [p.id, p.prenom]));
  const joursTravaillesParNom = new Map<string, Set<string>>();
  for (const s of shifts) {
    if (s.statut !== "travail" && s.statut !== "superviseur") continue;
    const nom = prenomById.get(s.user_id);
    if (!nom) continue;
    if (!joursTravaillesParNom.has(nom)) joursTravaillesParNom.set(nom, new Set());
    joursTravaillesParNom.get(nom)!.add(s.date);
  }

  const trend = [...trendMap.values()].sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  const byEmployee = [...employeeCount.entries()]
    .map(([nom, count]) => {
      const joursTravailles = joursTravaillesParNom.get(nom)?.size || 0;
      return {
        nom,
        count,
        joursTravailles,
        moyenneParJour: joursTravailles > 0 ? Math.round((count / joursTravailles) * 10) / 10 : null,
      };
    })
    .sort((a, b) => b.count - a.count);

  return { trend, byEmployee, matin, apresMidi };
}

function buildConversionStats(clients: { canal: string; statut: string; created_at: string }[]) {
  const parCanal = new Map<string, { total: number; confirmes: number }>();
  for (const c of clients) {
    const canal = c.canal || "Autre";
    if (!parCanal.has(canal)) parCanal.set(canal, { total: 0, confirmes: 0 });
    const bucket = parCanal.get(canal)!;
    bucket.total += 1;
    if (c.statut === "Client confirmé") bucket.confirmes += 1;
  }
  return [...parCanal.entries()]
    .map(([canal, b]) => ({
      canal,
      total: b.total,
      confirmes: b.confirmes,
      tauxPct: b.total > 0 ? Math.round((b.confirmes / b.total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.total - a.total);
}
