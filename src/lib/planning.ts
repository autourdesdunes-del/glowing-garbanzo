import { PlanningShift, Profile } from "./types";

export function profileName(p: Profile) {
  return p.prenom || p.email.split("@")[0];
}

// Qui est en poste (statut "travail") à une date et une heure données —
// utilisé à la fois pour afficher la personne assignée à un appel dans
// Suivis, et pour déclencher les rappels d'appel de la bonne personne.
export function profilesOnShiftAt(
  profiles: Profile[],
  planningShifts: PlanningShift[],
  date: string | null,
  heure: string
): Profile[] {
  if (!date || !heure) return [];
  // Un shift "coupé" (shift2_debut/shift2_fin, voir migration 0144) compte
  // pour deux plages distinctes — sans ce second test, quelqu'un en pause
  // entre les deux (ex. 12h-15h) apparaissait à tort en poste sur toute la
  // plage 9h30-20h00.
  const userIds = new Set(
    planningShifts
      .filter(
        (s) =>
          s.date === date &&
          s.statut === "travail" &&
          ((s.shift_debut && s.shift_fin && s.shift_debut <= heure && heure <= s.shift_fin) ||
            (s.shift2_debut && s.shift2_fin && s.shift2_debut <= heure && heure <= s.shift2_fin))
      )
      .map((s) => s.user_id)
  );
  return profiles.filter((p) => userIds.has(p.id));
}
