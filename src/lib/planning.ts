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
  const userIds = new Set(
    planningShifts
      .filter(
        (s) =>
          s.date === date &&
          s.statut === "travail" &&
          s.shift_debut &&
          s.shift_fin &&
          s.shift_debut <= heure &&
          heure <= s.shift_fin
      )
      .map((s) => s.user_id)
  );
  return profiles.filter((p) => userIds.has(p.id));
}
