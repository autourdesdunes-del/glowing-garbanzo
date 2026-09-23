// Données historiques mensuelles (CA, marge brute, nombre de ventes) issues du
// fichier Numbers "STATISTIQUES AGENCE - AUTOUR DES DUNES" tenu à la main par
// Mélanie depuis 2022 — le CRM (et donc reservations/coutsMap) ne remonte de
// façon fiable que sur les derniers mois, donc les graphiques Direction qui
// regardent 6/12 mois en arrière se retrouvaient presque vides avant cette
// période. Sert de repli pour tout mois déjà clos ici (voir DirectionView.tsx) ;
// le mois en cours et les mois à venir restent calculés en direct depuis le CRM.
// Importé une seule fois le 2026-09-23 — jamais remis à jour automatiquement,
// donc à ne pas utiliser au-delà du dernier mois listé. "ventes" est le
// nombre d'activités vendues (différent de "nouveaux clients").
export const STATS_HISTORIQUES_MENSUELLES: Record<string, { ca: number; marge: number; ventes: number }> = {
  "2022-09": { ca: 535.0, marge: 105.0, ventes: 5 },
  "2022-10": { ca: 881.0, marge: 313.72, ventes: 9 },
  "2022-11": { ca: 5589.0, marge: 1074.61, ventes: 45 },
  "2022-12": { ca: 6425.0, marge: 2436.91, ventes: 34 },
  "2023-01": { ca: 1435.0, marge: 331.68, ventes: 10 },
  "2023-02": { ca: 9422.0, marge: 3103.86, ventes: 89 },
  "2023-03": { ca: 18202.5, marge: 5524.0, ventes: 175 },
  "2023-04": { ca: 36036.5, marge: 8519.0, ventes: 196 },
  "2023-05": { ca: 32852.0, marge: 7743.0, ventes: 223 },
  "2023-06": { ca: 22555.0, marge: 5555.0, ventes: 180 },
  "2023-07": { ca: 40070.5, marge: 11512.0, ventes: 259 },
  "2023-08": { ca: 45632.53, marge: 12740.0, ventes: 349 },
  "2023-09": { ca: 34202.0, marge: 8337.0, ventes: 255 },
  "2023-10": { ca: 39395.5, marge: 7101.0, ventes: 187 },
  "2023-11": { ca: 20476.5, marge: 5825.0, ventes: 164 },
  "2023-12": { ca: 15864.5, marge: 4940.0, ventes: 126 },
  "2024-01": { ca: 12328.5, marge: 4695.0, ventes: 70 },
  "2024-02": { ca: 20621.5, marge: 8160.0, ventes: 144 },
  "2024-03": { ca: 34405.0, marge: 12105.0, ventes: 269 },
  "2024-04": { ca: 56165.5, marge: 19015.0, ventes: 350 },
  "2024-05": { ca: 44405.0, marge: 14520.0, ventes: 347 },
  "2024-06": { ca: 37778.0, marge: 12100.0, ventes: 292 },
  "2024-07": { ca: 48563.0, marge: 14176.0, ventes: 280 },
  "2024-08": { ca: 59430.0, marge: 19455.0, ventes: 420 },
  "2024-09": { ca: 51905.0, marge: 15140.0, ventes: 368 },
  "2024-10": { ca: 86016.5, marge: 22920.0, ventes: 453 },
  "2024-11": { ca: 47254.0, marge: 11160.0, ventes: 325 },
  "2024-12": { ca: 33099.6, marge: 9125.0, ventes: 184 },
  "2025-01": { ca: 25402.5, marge: 6872.0, ventes: 149 },
  "2025-02": { ca: 55901.0, marge: 16120.0, ventes: 292 },
  "2025-03": { ca: 69832.5, marge: 17115.0, ventes: 381 },
  "2025-04": { ca: 140310.0, marge: 21850.0, ventes: 546 },
  "2025-05": { ca: 114615.5, marge: 24750.0, ventes: 489 },
  "2025-06": { ca: 50892.0, marge: 12950.0, ventes: 322 },
  "2025-07": { ca: 51727.0, marge: 13100.0, ventes: 324 },
  "2025-08": { ca: 111709.52, marge: 27800.0, ventes: 586 },
  "2025-09": { ca: 93993.0, marge: 22400.0, ventes: 658 },
  "2025-10": { ca: 119036.95, marge: 30770.0, ventes: 663 },
  "2025-11": { ca: 111533.25, marge: 21750.0, ventes: 723 },
  "2025-12": { ca: 95600.0, marge: 18420.0, ventes: 435 },
  "2026-01": { ca: 64226.0, marge: 16800.0, ventes: 380 },
  "2026-02": { ca: 183149.0, marge: 29370.0, ventes: 856 },
  "2026-03": { ca: 153653.75, marge: 35280.0, ventes: 888 },
  "2026-04": { ca: 241819.87, marge: 48490.0, ventes: 1100 },
  "2026-05": { ca: 132739.5, marge: 26950.0, ventes: 762 },
  "2026-06": { ca: 85585.0, marge: 23780.0, ventes: 455 },
};
