"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Conge, PlanningShift, Profile, SemaineTypeShift } from "@/lib/types";
import { JOURS_SEMAINE } from "@/lib/constants";
import { useConfirm } from "@/components/ConfirmProvider";
import { useToast } from "@/components/ToastProvider";

function fmtDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}
function localIso(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function todayStr() {
  return localIso(new Date());
}
function daysBetween(a: string, b: string) {
  return Math.round((new Date(b + "T00:00:00").getTime() - new Date(a + "T00:00:00").getTime()) / 86400000) + 1;
}
function addDaysIso(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return localIso(d);
}
// Avril, août, octobre : haute saison pour l'agence — pas de congé possible
// sur ces mois-là, même partiellement.
const BLOCKED_CONGE_MONTHS = [4, 8, 10];
function rangeHitsBlockedMonth(debut: string, fin: string) {
  const d = new Date(debut + "T00:00:00");
  const end = new Date(fin + "T00:00:00");
  while (d <= end) {
    if (BLOCKED_CONGE_MONTHS.includes(d.getMonth() + 1)) return true;
    d.setDate(d.getDate() + 1);
  }
  return false;
}
// Chaque semaine commence le lundi — toute date choisie est ramenée au
// lundi de sa semaine, pour ne plus jamais décaler l'alternance A/B.
function mondayOf(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  return localIso(d);
}

const WEEKDAY_JS_TO_FR = [
  "Dimanche",
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
];

function statutLabel(statut: string, debut?: string, fin?: string) {
  if (statut === "conge") return "Congé";
  if (statut === "repos") return "OFF";
  if (statut === "superviseur") return "Superviseur";
  return debut || fin ? `${debut} – ${fin}` : "Travail";
}

function statutBadgeClass(statut: string) {
  if (statut === "conge") return "bg-[#f5a623] text-white";
  if (statut === "repos") return "bg-neutral-200 text-neutral-500";
  if (statut === "superviseur") return "bg-purple-200 text-purple-800";
  return "bg-blue-100 text-blue-700";
}

// Tri des cartes d'une journée : OFF toujours en premier (repérable d'un
// coup d'œil), puis congé/superviseur, puis les horaires de travail triés
// par heure de début croissante.
function sortDayShifts(a: PlanningShift, b: PlanningShift) {
  const rank = (s: PlanningShift) => (s.statut === "repos" ? 0 : s.statut === "travail" ? 2 : 1);
  const ra = rank(a);
  const rb = rank(b);
  if (ra !== rb) return ra - rb;
  if (ra === 2) return (a.shift_debut || "").localeCompare(b.shift_debut || "");
  return 0;
}

// Priorité d'affichage quand plusieurs personnes ont des statuts différents
// le même jour (vue d'ensemble équipe) : congé/superviseur d'abord car ce
// sont les exceptions les plus utiles à repérer d'un coup d'œil.
const STATUT_PRIORITY = ["conge", "superviseur", "travail", "repos"];
function dominantStatut(dayShifts: PlanningShift[]): string | null {
  if (dayShifts.length === 0) return null;
  for (const s of STATUT_PRIORITY) {
    if (dayShifts.some((sh) => sh.statut === s)) return s;
  }
  return dayShifts[0].statut;
}

const AVATAR_PALETTE = [
  { bg: "bg-blue-50", border: "border-blue-200", dot: "bg-blue-400" },
  { bg: "bg-green-50", border: "border-green-200", dot: "bg-green-400" },
  { bg: "bg-amber-50", border: "border-amber-200", dot: "bg-amber-400" },
  { bg: "bg-pink-50", border: "border-pink-200", dot: "bg-pink-400" },
  { bg: "bg-purple-50", border: "border-purple-200", dot: "bg-purple-400" },
  { bg: "bg-cyan-50", border: "border-cyan-200", dot: "bg-cyan-400" },
];

const MONTH_NAMES_FULL = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];
const WEEKDAY_ABREV = ["L", "M", "M", "J", "V", "S", "D"];

function MiniMonth({
  year,
  month,
  shiftsByDate,
  onDayClick,
}: {
  year: number;
  month: number;
  shiftsByDate: Record<string, PlanningShift[]>;
  onDayClick?: (iso: string) => void;
}) {
  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = (firstOfMonth.getDay() + 6) % 7;
  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3">
      <p className="mb-2 text-center text-sm font-semibold capitalize text-[#171717]">
        {MONTH_NAMES_FULL[month]} {year}
      </p>
      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] text-neutral-400">
        {WEEKDAY_ABREV.map((w, i) => (
          <div key={i}>{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const dayShifts = shiftsByDate[iso] || [];
          const dominant = dominantStatut(dayShifts);
          const cls = dominant
            ? `${statutBadgeClass(dominant)} hover:ring-2 hover:ring-offset-1 hover:ring-[#171717]/30`
            : "border border-neutral-200 text-neutral-400 hover:border-[#171717]/40 hover:bg-neutral-50 hover:text-[#171717]";
          return (
            <button
              key={i}
              type="button"
              onClick={() => onDayClick?.(iso)}
              title={onDayClick ? "Voir le détail de ce jour" : undefined}
              className={`flex h-7 w-7 items-center justify-center rounded-md text-[11px] transition ${cls} ${
                onDayClick ? "cursor-pointer" : ""
              }`}
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DetailModal({
  date,
  onClose,
  shifts,
  teamProfiles,
  nameFor,
}: {
  date: string;
  onClose: () => void;
  shifts: PlanningShift[];
  teamProfiles: Profile[];
  nameFor: (uid: string) => string;
}) {
  const [view, setView] = useState<"jour" | "semaine" | "mois">("jour");
  const base = new Date(date + "T00:00:00");

  let rangeDates: Date[] = [base];
  if (view === "semaine") {
    const startOffset = (base.getDay() + 6) % 7;
    const monday = new Date(base);
    monday.setDate(monday.getDate() - startOffset);
    rangeDates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      return d;
    });
  } else if (view === "mois") {
    const daysInMonth = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    rangeDates = Array.from({ length: daysInMonth }, (_, i) => new Date(base.getFullYear(), base.getMonth(), i + 1));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-[6px] border border-[#eaeaea] bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-heading text-base font-semibold capitalize text-[#171717]">
            {base.toLocaleDateString("fr-FR", {
              weekday: view === "jour" ? "long" : undefined,
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">
            ✕
          </button>
        </div>
        <div className="mb-3 flex gap-1.5">
          {(["jour", "semaine", "mois"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${
                view === v
                  ? "border-[#171717] bg-[#171717] text-white"
                  : "border-neutral-300 text-neutral-600"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="space-y-3">
          {rangeDates.map((d) => {
            const iso = localIso(d);
            const dayShifts = shifts.filter((s) => s.date === iso).sort(sortDayShifts);
            return (
              <div key={iso}>
                <p className="mb-1 text-xs font-medium capitalize text-neutral-500">
                  {d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}
                </p>
                {dayShifts.length === 0 ? (
                  <p className="text-xs italic text-neutral-300">Rien de prévu.</p>
                ) : (
                  <div className="space-y-1">
                    {dayShifts.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between rounded-md bg-neutral-50 px-2 py-1 text-xs"
                      >
                        <span className="font-medium text-neutral-700">{nameFor(s.user_id)}</span>
                        <span className={`rounded-full px-2 py-0.5 ${statutBadgeClass(s.statut)}`}>
                          {statutLabel(s.statut, s.shift_debut, s.shift_fin)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {teamProfiles.length === 0 && (
            <p className="text-xs text-neutral-400">Aucune personne dans l&apos;équipe pour l&apos;instant.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PlanningRHView({
  isDirection,
  viewAsUserId,
}: {
  isDirection: boolean;
  // Simulation "Aperçu vu par" (AppShell) : affiche le planning de CETTE
  // personne plutôt que celui du vrai compte connecté — l'envoi d'une
  // demande de congé reste, lui, sous le vrai compte (voir requestConge).
  viewAsUserId?: string;
}) {
  const supabase = createClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState<"planning" | "conges">("planning");
  const [userId, setUserId] = useState<string | null>(null);
  // Pour tout ce qui est "affiché" (mes horaires, mes congés) : la personne
  // simulée si "Aperçu vu par" en désigne une, sinon le vrai compte connecté.
  const effectiveUserId = viewAsUserId ?? userId;
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [shifts, setShifts] = useState<PlanningShift[]>([]);
  const [conges, setConges] = useState<Conge[]>([]);
  const [semaineTypes, setSemaineTypes] = useState<SemaineTypeShift[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [activeSemaine, setActiveSemaine] = useState<"A" | "B">("A");
  const [genStart, setGenStart] = useState(mondayOf(todayStr()));
  const [genStartSemaine, setGenStartSemaine] = useState<"A" | "B">("A");
  const [genWeeks, setGenWeeks] = useState(12);

  const [assignUserId, setAssignUserId] = useState("");
  const [assignDate, setAssignDate] = useState(todayStr());
  const [assignDebut, setAssignDebut] = useState("");
  const [assignFin, setAssignFin] = useState("");
  const [assignStatut, setAssignStatut] = useState<PlanningShift["statut"]>("travail");

  const [congeDebut, setCongeDebut] = useState("");
  const [congeFin, setCongeFin] = useState("");
  const [congeMotif, setCongeMotif] = useState("");
  const [prenomModalInput, setPrenomModalInput] = useState("");
  const [skippedPrenomIds, setSkippedPrenomIds] = useState<Set<string>>(new Set());
  const [adminCollapsed, setAdminCollapsed] = useState(true);
  const [detailDate, setDetailDate] = useState<string | null>(null);
  // "Ta semaine" par défaut pour une conseillère : elle veut d'abord savoir
  // quand ELLE travaille, pas qui travaille dans l'équipe — "L'équipe" est
  // un choix explicite, pas le point de départ.
  const [planningScope, setPlanningScope] = useState<"moi" | "equipe">("moi");
  const [weekStart, setWeekStart] = useState(mondayOf(todayStr()));

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      const [{ data: profs }, { data: sh }, { data: cg }, { data: st }] = await Promise.all([
        supabase.from("profiles").select("*"),
        supabase.from("planning_shifts").select("*").order("date", { ascending: true }),
        supabase.from("conges").select("*").order("date_debut", { ascending: false }),
        supabase.from("planning_semaine_type").select("*"),
      ]);
      setProfiles((profs as Profile[]) || []);
      setShifts((sh as PlanningShift[]) || []);
      setConges((cg as Conge[]) || []);
      setSemaineTypes((st as SemaineTypeShift[]) || []);
      setLoaded(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nameFor = (uid: string) => {
    const p = profiles.find((p) => p.id === uid);
    return p?.prenom || p?.email?.split("@")[0] || "—";
  };

  const colorFor = (uid: string) => {
    const idx = profiles.filter((p) => p.role === "equipe").findIndex((p) => p.id === uid);
    return AVATAR_PALETTE[(idx >= 0 ? idx : 0) % AVATAR_PALETTE.length];
  };

  const savePrenom = async (id: string, prenom: string) => {
    const value = prenom.trim();
    setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, prenom: value } : p)));
    const { error } = await supabase.from("profiles").update({ prenom: value }).eq("id", id);
    if (error) toast("Échec de l'enregistrement du prénom.");
    else toast("Prénom enregistré.", "success");
  };

  const semaineCellFor = (semaine: "A" | "B", uid: string, jour: string) =>
    semaineTypes.find((s) => s.semaine === semaine && s.user_id === uid && s.jour === jour);

  const upsertSemaineType = async (
    semaine: "A" | "B",
    uid: string,
    jour: string,
    patch: Partial<Pick<SemaineTypeShift, "statut" | "shift_debut" | "shift_fin">>
  ) => {
    const existing = semaineCellFor(semaine, uid, jour);
    const row = {
      semaine,
      user_id: uid,
      jour,
      statut: existing?.statut ?? "repos",
      shift_debut: existing?.shift_debut ?? "",
      shift_fin: existing?.shift_fin ?? "",
      ...patch,
    };
    const { data, error } = await supabase
      .from("planning_semaine_type")
      .upsert(row, { onConflict: "semaine,user_id,jour" })
      .select()
      .single();
    if (!error && data) {
      setSemaineTypes((prev) => [
        ...prev.filter((s) => !(s.semaine === semaine && s.user_id === uid && s.jour === jour)),
        data as SemaineTypeShift,
      ]);
    } else {
      toast("Échec de l'enregistrement du modèle de semaine.");
    }
  };

  const generatePlanning = async () => {
    const team = profiles.filter((p) => p.role === "equipe");
    if (team.length === 0) {
      toast("Ajoute d'abord des membres d'équipe.");
      return;
    }
    const ok = await confirm({
      title: "Générer le planning ?",
      message: `Ceci va appliquer l'alternance Semaine A / Semaine B pendant ${genWeeks} semaines à partir du ${fmtDate(genStart)}, en écrasant les horaires déjà existants sur ces jours-là.`,
      confirmLabel: "Générer",
      danger: true,
    });
    if (!ok) return;
    const startDate = new Date(genStart + "T00:00:00");
    const rows: {
      user_id: string;
      date: string;
      statut: string;
      shift_debut: string;
      shift_fin: string;
    }[] = [];
    for (let w = 0; w < genWeeks; w++) {
      const semaine = w % 2 === 0 ? genStartSemaine : genStartSemaine === "A" ? "B" : "A";
      for (let d = 0; d < 7; d++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + w * 7 + d);
        // Le jour réel de `date` (pas un simple décalage depuis genStart, qui
        // peut tomber n'importe quel jour de la semaine) détermine quel
        // modèle appliquer — sinon tout se décale si genStart n'est pas un
        // lundi.
        const jour = WEEKDAY_JS_TO_FR[date.getDay()];
        const iso = localIso(date);
        team.forEach((p) => {
          const st = semaineTypes.find(
            (s) => s.semaine === semaine && s.user_id === p.id && s.jour === jour
          );
          const statut = st?.statut ?? "repos";
          rows.push({
            user_id: p.id,
            date: iso,
            statut,
            shift_debut: statut === "travail" ? st?.shift_debut ?? "" : "",
            shift_fin: statut === "travail" ? st?.shift_fin ?? "" : "",
          });
        });
      }
    }
    if (rows.length === 0) {
      toast("Remplis d'abord la Semaine A et la Semaine B ci-dessus.");
      return;
    }
    const { data, error } = await supabase
      .from("planning_shifts")
      .upsert(rows, { onConflict: "user_id,date" })
      .select();
    if (error || !data) {
      toast("Échec de la génération du planning.");
      return;
    }
    setShifts((prev) => {
      const map = new Map(prev.map((s) => [`${s.user_id}_${s.date}`, s]));
      (data as PlanningShift[]).forEach((s) => map.set(`${s.user_id}_${s.date}`, s));
      return Array.from(map.values());
    });
    toast(`Planning généré pour ${genWeeks} semaines.`, "success");
  };

  const upsertShift = async () => {
    if (!assignUserId || !assignDate) {
      toast("Choisis une personne et une date.");
      return;
    }
    const { data, error } = await supabase
      .from("planning_shifts")
      .upsert(
        {
          user_id: assignUserId,
          date: assignDate,
          shift_debut: assignStatut === "travail" ? assignDebut : "",
          shift_fin: assignStatut === "travail" ? assignFin : "",
          statut: assignStatut,
        },
        { onConflict: "user_id,date" }
      )
      .select()
      .single();
    if (!error && data) {
      setShifts((prev) => [
        ...prev.filter((s) => !(s.user_id === assignUserId && s.date === assignDate)),
        data as PlanningShift,
      ]);
      toast("Planning mis à jour.", "success");
    } else {
      toast("Impossible d'enregistrer ce planning.");
    }
  };

  const deleteShift = async (id: string) => {
    setShifts((prev) => prev.filter((s) => s.id !== id));
    const { error } = await supabase.from("planning_shifts").delete().eq("id", id);
    if (error) toast("Échec de la suppression.");
  };

  const requestConge = async () => {
    if (!congeDebut || !congeFin || !userId) {
      toast("Renseigne les dates de congé.");
      return;
    }
    if (rangeHitsBlockedMonth(congeDebut, congeFin)) {
      toast(
        "Les congés ne sont pas possibles en avril, août et octobre — ce sont les mois de forte affluence pour l'agence."
      );
      return;
    }
    const { data, error } = await supabase
      .from("conges")
      .insert({ user_id: userId, date_debut: congeDebut, date_fin: congeFin, motif: congeMotif })
      .select()
      .single();
    if (!error && data) {
      setConges((prev) => [data as Conge, ...prev]);
      setCongeDebut("");
      setCongeFin("");
      setCongeMotif("");
      toast("Demande de congé envoyée.", "success");
    } else {
      toast("Impossible d'envoyer la demande.");
    }
  };

  const updateCongeStatut = async (id: string, statut: Conge["statut"]) => {
    const conge = conges.find((c) => c.id === id);
    setConges((prev) => prev.map((c) => (c.id === id ? { ...c, statut } : c)));
    const { error } = await supabase.from("conges").update({ statut }).eq("id", id);
    if (error) {
      toast("Échec de l'enregistrement.");
      return;
    }
    // Un congé validé se reflète directement dans le planning — chaque jour
    // de la période passe en "Congé", sans ressaisir quoi que ce soit.
    if (statut === "Validé" && conge) {
      const rows: { user_id: string; date: string; statut: string; shift_debut: string; shift_fin: string }[] = [];
      const d = new Date(conge.date_debut + "T00:00:00");
      const end = new Date(conge.date_fin + "T00:00:00");
      while (d <= end) {
        rows.push({ user_id: conge.user_id, date: localIso(d), statut: "conge", shift_debut: "", shift_fin: "" });
        d.setDate(d.getDate() + 1);
      }
      const { data: shiftData, error: shiftError } = await supabase
        .from("planning_shifts")
        .upsert(rows, { onConflict: "user_id,date" })
        .select();
      if (!shiftError && shiftData) {
        setShifts((prev) => {
          const map = new Map(prev.map((s) => [`${s.user_id}_${s.date}`, s]));
          (shiftData as PlanningShift[]).forEach((s) => map.set(`${s.user_id}_${s.date}`, s));
          return Array.from(map.values());
        });
      }
    }
  };

  const deleteConge = async (id: string) => {
    const ok = await confirm({
      message: "Retirer cette demande de congé ?",
      confirmLabel: "Retirer",
      danger: true,
    });
    if (!ok) return;
    setConges((prev) => prev.filter((c) => c.id !== id));
    const { error } = await supabase.from("conges").delete().eq("id", id);
    if (error) toast("Échec de la suppression.");
  };

  // Refuser une demande la retire directement de la liste — pas de statut
  // "Refusé" qui traîne, elle disparaît tout simplement.
  const refuserConge = async (id: string) => {
    setConges((prev) => prev.filter((c) => c.id !== id));
    const { error } = await supabase.from("conges").delete().eq("id", id);
    if (error) toast("Échec du refus.");
  };

  if (!loaded) return null;

  const thisYear = new Date().getFullYear();
  const congesTotalFor = (uid: string) =>
    conges
      .filter((c) => c.user_id === uid && c.statut === "Validé" && c.date_debut.startsWith(String(thisYear)))
      .reduce((s, c) => s + daysBetween(c.date_debut, c.date_fin), 0);

  const today = todayStr();
  // Direction gère son propre planning ailleurs (shift du jour au Dashboard)
  // — ce planning d'équipe ne concerne que les employées.
  const teamProfiles = profiles.filter((p) => p.role === "equipe");
  const teamIds = new Set(teamProfiles.map((p) => p.id));
  const visibleConges = isDirection ? conges : conges.filter((c) => c.user_id === effectiveUserId);
  const missingPrenomProfile = isDirection
    ? teamProfiles.find((p) => !p.prenom.trim() && !skippedPrenomIds.has(p.id))
    : undefined;
  const myShiftsByDate: Record<string, PlanningShift[]> = {};
  shifts
    .filter((s) => s.user_id === effectiveUserId)
    .forEach((s) => {
      myShiftsByDate[s.date] = [...(myShiftsByDate[s.date] || []), s];
    });
  const teamShiftsByDate: Record<string, PlanningShift[]> = {};
  shifts
    .filter((s) => teamIds.has(s.user_id))
    .forEach((s) => {
      teamShiftsByDate[s.date] = [...(teamShiftsByDate[s.date] || []), s];
    });
  const monthCards = [0, 1, 2].map((offset) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + offset);
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  // Semaine affichée : toujours du lundi au dimanche, entièrement visible
  // sans défilement — "aujourd'hui" est simplement mis en avant dans cette
  // semaine, jamais besoin de faire défiler pour se trouver.
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart + "T00:00:00");
    d.setDate(d.getDate() + i);
    return d;
  });
  const isCurrentWeek = weekStart === mondayOf(today);

  // Alerte "jour incomplet" : scanne les 6 prochaines semaines (au-delà de
  // la semaine affichée) pour repérer un jour où personne n'a rien généré
  // ou pas assez de monde — sinon un jour comme celui du 18 septembre reste
  // invisible jusqu'à ce qu'il arrive. Toujours calculé sur toute l'équipe,
  // même en vue "Ta semaine".
  const incompleteDays: { iso: string; count: number }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(today + "T00:00:00");
    d.setDate(d.getDate() + i);
    const iso = localIso(d);
    const dayShifts = (teamShiftsByDate[iso] || []).filter((s) => s.statut !== "repos");
    const workingCount = dayShifts.filter((s) => s.statut === "travail" || s.statut === "superviseur").length;
    if (workingCount < 3) {
      incompleteDays.push({ iso, count: workingCount });
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <div className="flex gap-2">
        <button
          onClick={() => setTab("planning")}
          className={`rounded-full border px-3 py-1.5 text-sm ${
            tab === "planning" ? "border-[#171717] bg-[#171717] text-white" : "border-neutral-300 bg-white text-neutral-600"
          }`}
        >
          Planning
        </button>
        <button
          onClick={() => setTab("conges")}
          className={`rounded-full border px-3 py-1.5 text-sm ${
            tab === "conges" ? "border-[#171717] bg-[#171717] text-white" : "border-neutral-300 bg-white text-neutral-600"
          }`}
        >
          Congés
        </button>
      </div>

      {tab === "planning" && (
        <div>
          {isDirection && (
            <div className="mb-4 rounded-md border border-dashed border-neutral-300 bg-white p-3">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-[#171717]">Modification du planning</p>
                <button
                  onClick={() => setAdminCollapsed((v) => !v)}
                  className="text-xs font-medium text-[#666666] hover:underline"
                >
                  {adminCollapsed ? "Déplier ▾" : "Replier ▴"}
                </button>
              </div>
              {!adminCollapsed && (
                <>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium text-neutral-700">
                  Modèles de semaine — rempli une fois, dupliqué ensuite
                </p>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setActiveSemaine("A")}
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${
                      activeSemaine === "A"
                        ? "border-[#171717] bg-[#171717] text-white"
                        : "border-neutral-300 text-neutral-600"
                    }`}
                  >
                    Semaine A
                  </button>
                  <button
                    onClick={() => setActiveSemaine("B")}
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${
                      activeSemaine === "B"
                        ? "border-[#171717] bg-[#171717] text-white"
                        : "border-neutral-300 text-neutral-600"
                    }`}
                  >
                    Semaine B
                  </button>
                </div>
              </div>
              <div className="mb-4 overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr>
                      <th className="p-1.5 text-left text-neutral-500">Personne</th>
                      {JOURS_SEMAINE.map((j) => (
                        <th key={j} className="p-1.5 text-center text-neutral-500">
                          {j.slice(0, 3)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {teamProfiles.map((p) => (
                      <tr key={p.id} className="border-t border-neutral-100">
                        <td className="whitespace-nowrap p-1.5 font-medium text-neutral-700">
                          {nameFor(p.id)}
                        </td>
                        {JOURS_SEMAINE.map((j) => {
                          const cell = semaineCellFor(activeSemaine, p.id, j);
                          return (
                            <td key={j} className="p-1 align-top">
                              <select
                                value={cell?.statut ?? "repos"}
                                onChange={(e) =>
                                  upsertSemaineType(activeSemaine, p.id, j, {
                                    statut: e.target.value as PlanningShift["statut"],
                                  })
                                }
                                className="input w-24 px-1 py-1 text-[11px]"
                              >
                                <option value="travail">Travail</option>
                                <option value="conge">Congé</option>
                                <option value="repos">OFF</option>
                                <option value="superviseur">Superviseur</option>
                              </select>
                              {cell?.statut === "travail" && (
                                <div className="mt-1 flex gap-0.5">
                                  <input
                                    type="time"
                                    value={cell?.shift_debut ?? ""}
                                    onChange={(e) =>
                                      upsertSemaineType(activeSemaine, p.id, j, {
                                        shift_debut: e.target.value,
                                      })
                                    }
                                    className="input w-full px-1 py-0.5 text-[10px]"
                                  />
                                  <input
                                    type="time"
                                    value={cell?.shift_fin ?? ""}
                                    onChange={(e) =>
                                      upsertSemaineType(activeSemaine, p.id, j, {
                                        shift_fin: e.target.value,
                                      })
                                    }
                                    className="input w-full px-1 py-0.5 text-[10px]"
                                  />
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="mb-1 text-sm font-medium text-neutral-700">
                Générer le planning à partir de ces modèles
              </p>
              <p className="mb-2 text-xs text-neutral-400">
                Chaque semaine commence le lundi — la date est toujours ramenée au lundi de sa
                semaine.
              </p>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={genStart}
                  onChange={(e) => setGenStart(mondayOf(e.target.value))}
                  className="input w-40"
                />
                <span className="text-xs text-neutral-500">est une</span>
                <select
                  value={genStartSemaine}
                  onChange={(e) => setGenStartSemaine(e.target.value as "A" | "B")}
                  className="input w-32"
                >
                  <option value="A">Semaine A</option>
                  <option value="B">Semaine B</option>
                </select>
                <span className="text-xs text-neutral-500">pendant</span>
                <input
                  type="number"
                  min={1}
                  value={genWeeks}
                  onChange={(e) => setGenWeeks(Math.max(1, Number(e.target.value)))}
                  className="input w-20"
                />
                <span className="text-xs text-neutral-500">semaines</span>
                <button
                  onClick={generatePlanning}
                  className="rounded-md bg-[#171717] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
                >
                  Générer / Dupliquer
                </button>
              </div>

              <p className="mb-2 text-sm font-medium text-neutral-700">
                Assigner un horaire ponctuel
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={assignUserId}
                  onChange={(e) => setAssignUserId(e.target.value)}
                  className="input min-w-[180px] flex-1"
                >
                  <option value="">Choisir une personne…</option>
                  {teamProfiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {nameFor(p.id)}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={assignDate}
                  onChange={(e) => setAssignDate(e.target.value)}
                  className="input w-40"
                />
                <select
                  value={assignStatut}
                  onChange={(e) => setAssignStatut(e.target.value as PlanningShift["statut"])}
                  className="input w-32"
                >
                  <option value="travail">Travail</option>
                  <option value="conge">Congé</option>
                  <option value="repos">OFF</option>
                  <option value="superviseur">Superviseur</option>
                </select>
                {assignStatut === "travail" && (
                  <>
                    <input
                      type="time"
                      value={assignDebut}
                      onChange={(e) => setAssignDebut(e.target.value)}
                      className="input w-28"
                    />
                    <input
                      type="time"
                      value={assignFin}
                      onChange={(e) => setAssignFin(e.target.value)}
                      className="input w-28"
                    />
                  </>
                )}
                <button
                  onClick={upsertShift}
                  className="rounded-md bg-[#171717] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
                >
                  Enregistrer
                </button>
              </div>
                </>
              )}
            </div>
          )}
          {isDirection && incompleteDays.length > 0 && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3">
              <p className="mb-1.5 text-sm font-semibold text-red-700">
                ⚠ {incompleteDays.length} jour{incompleteDays.length > 1 ? "s" : ""} incomplet
                {incompleteDays.length > 1 ? "s" : ""} dans les 6 prochaines semaines
              </p>
              <div className="flex flex-wrap gap-1.5">
                {incompleteDays.map((d) => (
                  <button
                    key={d.iso}
                    onClick={() => setWeekStart(mondayOf(d.iso))}
                    className="rounded-full border border-red-300 bg-white px-2.5 py-1 text-xs text-red-700 hover:bg-red-100"
                  >
                    {fmtDate(d.iso)} — {d.count === 0 ? "personne" : `${d.count} pers.`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!isDirection && (
            <div className="mb-4 flex gap-1.5">
              <button
                onClick={() => setPlanningScope("moi")}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                  planningScope === "moi"
                    ? "border-[#171717] bg-[#171717] text-white"
                    : "border-neutral-300 bg-white text-neutral-600"
                }`}
              >
                Ta semaine
              </button>
              <button
                onClick={() => setPlanningScope("equipe")}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                  planningScope === "equipe"
                    ? "border-[#171717] bg-[#171717] text-white"
                    : "border-neutral-300 bg-white text-neutral-600"
                }`}
              >
                L&apos;équipe
              </button>
            </div>
          )}

          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setWeekStart((w) => addDaysIso(w, -7))}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-neutral-300 text-neutral-500 hover:bg-neutral-50"
              >
                ‹
              </button>
              <p className="text-sm font-semibold capitalize text-[#171717]">
                {weekDays[0].toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} –{" "}
                {weekDays[6].toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
              </p>
              <button
                onClick={() => setWeekStart((w) => addDaysIso(w, 7))}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-neutral-300 text-neutral-500 hover:bg-neutral-50"
              >
                ›
              </button>
            </div>
            {!isCurrentWeek && (
              <button
                onClick={() => setWeekStart(mondayOf(today))}
                className="text-xs font-medium text-[#171717] hover:underline"
              >
                Aujourd&apos;hui
              </button>
            )}
          </div>

          <div className="space-y-2">
            {weekDays.map((d) => {
              const iso = localIso(d);
              const isToday = iso === today;
              const dayShifts = shifts
                .filter(
                  (s) =>
                    s.date === iso &&
                    teamIds.has(s.user_id) &&
                    (isDirection || planningScope === "equipe" || s.user_id === effectiveUserId)
                )
                .sort(sortDayShifts);
              return (
                <div
                  key={iso}
                  className={`rounded-lg border p-3 ${
                    isToday ? "border-[#171717] bg-[#fafafa]" : "border-neutral-200 bg-white"
                  }`}
                >
                  <p
                    className={`mb-2 flex items-center gap-1.5 text-sm font-semibold capitalize ${
                      isToday ? "text-[#171717]" : "text-neutral-700"
                    }`}
                  >
                    {d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "short" })}
                    {isToday && (
                      <span className="rounded-full bg-[#171717] px-1.5 py-0.5 text-[10px] font-medium text-white">
                        Aujourd&apos;hui
                      </span>
                    )}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {dayShifts.length === 0 && <span className="text-xs text-neutral-300">—</span>}
                    {dayShifts.map((s) => {
                      const c = colorFor(s.user_id);
                      const name = nameFor(s.user_id);
                      const isOff = s.statut === "repos";
                      return (
                        <span
                          key={s.id}
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
                            isOff
                              ? "border-dashed border-neutral-300 bg-neutral-50 text-neutral-400"
                              : `${c.border} ${c.bg} text-neutral-700`
                          }`}
                        >
                          <span
                            className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white ${
                              isOff ? "bg-neutral-400" : c.dot
                            }`}
                          >
                            {name.charAt(0).toUpperCase()}
                          </span>
                          <span className="font-medium">{name}</span>
                          <span className="text-neutral-500">
                            {statutLabel(s.statut, s.shift_debut, s.shift_fin)}
                          </span>
                          {isDirection && (
                            <button
                              onClick={() => deleteShift(s.id)}
                              className="text-neutral-300 hover:text-red-600"
                            >
                              ✕
                            </button>
                          )}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {!isDirection && (
            <div className="mt-6">
              <p className="mb-2 text-sm font-medium text-neutral-700">
                Mon planning sur 3 mois — clique un jour pour le détail
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {monthCards.map(({ year, month }) => (
                  <MiniMonth
                    key={`${year}-${month}`}
                    year={year}
                    month={month}
                    shiftsByDate={myShiftsByDate}
                    onDayClick={setDetailDate}
                  />
                ))}
              </div>
            </div>
          )}

          {isDirection && (
            <div className="mt-6">
              <p className="mb-2 text-sm font-medium text-neutral-700">
                Planning de l&apos;équipe sur 3 mois — clique une date pour le détail
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {monthCards.map(({ year, month }) => (
                  <MiniMonth
                    key={`${year}-${month}`}
                    year={year}
                    month={month}
                    shiftsByDate={teamShiftsByDate}
                    onDayClick={setDetailDate}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-neutral-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-400" /> Travail
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#f5a623]" /> Congé
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-neutral-300" /> OFF
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-purple-400" /> Superviseur
            </span>
          </div>
        </div>
      )}

      {tab === "conges" && (
        <div className="space-y-4">
          {!isDirection && (
            <div className="rounded-md border border-dashed border-neutral-300 bg-white p-3">
              <p className="mb-1 text-sm font-medium text-neutral-700">Demander un congé</p>
              <p className="mb-2 text-xs text-[#666666]">
                ⚠️ Pas de congé possible en avril, août et octobre — mois de forte affluence pour
                l&apos;agence.
              </p>
              <div className="flex flex-wrap gap-2">
                <input
                  type="date"
                  value={congeDebut}
                  onChange={(e) => setCongeDebut(e.target.value)}
                  className="input w-40"
                />
                <input
                  type="date"
                  value={congeFin}
                  onChange={(e) => setCongeFin(e.target.value)}
                  className="input w-40"
                />
                <input
                  value={congeMotif}
                  onChange={(e) => setCongeMotif(e.target.value)}
                  placeholder="Motif (optionnel)"
                  className="input min-w-[160px] flex-1"
                />
                <button
                  onClick={requestConge}
                  className="rounded-md bg-[#171717] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
                >
                  Envoyer la demande
                </button>
              </div>
            </div>
          )}

          {!isDirection && effectiveUserId && (
            <div className="rounded-md bg-[#fafafa]/50 p-3 text-sm text-[#171717]">
              <p>
                Congés pris en {thisYear} : <strong>{congesTotalFor(effectiveUserId)} jour(s)</strong>
              </p>
              {(() => {
                const mine = conges
                  .filter(
                    (c) =>
                      c.user_id === effectiveUserId &&
                      c.statut === "Validé" &&
                      c.date_debut.startsWith(String(thisYear))
                  )
                  .sort((a, b) => a.date_debut.localeCompare(b.date_debut));
                if (mine.length === 0) return null;
                return (
                  <ul className="mt-2 space-y-0.5 text-xs text-[#171717]/80">
                    {mine.map((c) => (
                      <li key={c.id}>
                        {fmtDate(c.date_debut)}
                        {c.date_debut !== c.date_fin ? ` → ${fmtDate(c.date_fin)}` : ""}
                      </li>
                    ))}
                  </ul>
                );
              })()}
            </div>
          )}

          {isDirection && (
            <div>
              <p className="mb-2 text-sm font-medium text-neutral-700">
                Congés par personne ({thisYear})
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {teamProfiles.map((p) => {
                  const mine = conges
                    .filter((c) => c.user_id === p.id && c.date_debut.startsWith(String(thisYear)))
                    .sort((a, b) => a.date_debut.localeCompare(b.date_debut));
                  return (
                    <div key={p.id} className="rounded-md border border-neutral-200 bg-white p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm font-semibold text-[#171717]">{nameFor(p.id)}</p>
                        <span className="rounded-full bg-[#fafafa] px-2 py-0.5 text-xs font-medium text-[#171717]">
                          {congesTotalFor(p.id)} jour(s)
                        </span>
                      </div>
                      {mine.length === 0 ? (
                        <p className="text-xs text-neutral-400">Aucun congé posé.</p>
                      ) : (
                        <ul className="space-y-1 text-xs text-neutral-600">
                          {mine.map((c) => (
                            <li key={c.id} className="flex items-center justify-between gap-2">
                              <span>
                                {fmtDate(c.date_debut)}
                                {c.date_debut !== c.date_fin ? ` → ${fmtDate(c.date_fin)}` : ""}
                              </span>
                              {c.statut === "En attente" ? (
                                <span className="flex items-center gap-2">
                                  <button
                                    onClick={() => updateCongeStatut(c.id, "Validé")}
                                    className="text-green-700 hover:underline"
                                  >
                                    Valider
                                  </button>
                                  <button
                                    onClick={() => refuserConge(c.id)}
                                    className="text-red-600 hover:underline"
                                  >
                                    Refuser
                                  </button>
                                </span>
                              ) : (
                                <span className="whitespace-nowrap rounded-full bg-green-100 px-1.5 py-0.5 text-green-700">
                                  Validé
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!isDirection && (
            <div className="space-y-2">
              {visibleConges.length === 0 && (
                <div className="text-sm text-neutral-400">Aucune demande de congé.</div>
              )}
              {visibleConges.map((c) => (
                <div
                  key={c.id}
                  className="flex flex-wrap items-center gap-3 rounded-md border border-neutral-200 bg-white p-3 text-sm"
                >
                  <span className="font-amounts text-neutral-500">
                    {fmtDate(c.date_debut)} → {fmtDate(c.date_fin)}
                  </span>
                  {c.motif && <span className="text-neutral-500">{c.motif}</span>}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      c.statut === "Validé"
                        ? "bg-green-100 text-green-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {c.statut}
                  </span>
                  <span className="flex-1" />
                  {c.statut === "En attente" && (
                    <button onClick={() => deleteConge(c.id)} className="text-xs text-red-600 hover:underline">
                      Retirer
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {missingPrenomProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-[6px] border border-[#eaeaea] bg-white p-5">
            <h3 className="mb-1 font-heading text-base font-semibold text-[#171717]">
              Nouveau membre de l&apos;équipe
            </h3>
            <p className="mb-3 text-sm text-neutral-500">
              Quel est le prénom de <strong>{missingPrenomProfile.email}</strong> ?
            </p>
            <input
              autoFocus
              value={prenomModalInput}
              onChange={(e) => setPrenomModalInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && prenomModalInput.trim()) {
                  savePrenom(missingPrenomProfile.id, prenomModalInput);
                  setPrenomModalInput("");
                }
              }}
              placeholder="Prénom"
              className="input mb-3"
            />
            <div className="flex items-center justify-between">
              <button
                onClick={() =>
                  setSkippedPrenomIds((prev) => new Set(prev).add(missingPrenomProfile.id))
                }
                className="text-xs text-neutral-400 hover:underline"
              >
                Plus tard
              </button>
              <button
                onClick={() => {
                  if (!prenomModalInput.trim()) return;
                  savePrenom(missingPrenomProfile.id, prenomModalInput);
                  setPrenomModalInput("");
                }}
                className="rounded-md bg-[#171717] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {detailDate && (
        <DetailModal
          date={detailDate}
          onClose={() => setDetailDate(null)}
          shifts={shifts}
          teamProfiles={teamProfiles}
          nameFor={nameFor}
        />
      )}
    </div>
  );
}
