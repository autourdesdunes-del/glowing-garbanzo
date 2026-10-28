"use client";

import { useEffect, useState } from "react";

type EmployeStats = {
  prenom: string;
  reservations: number;
  joursTravailles: number;
  moyenneParJour: number | null;
  ca: number;
  marge: number;
  panierMoyen: number | null;
  verifications: number;
  auRevoirEnvoyes: number;
  avisDemandes: number;
  relances: number;
};

type StatsResponse = { windowStart: string; employes: EmployeStats[] };

function euros(n: number) {
  return (Number(n) || 0).toLocaleString("fr-FR");
}

// Une ligne de comparaison : deux barres horizontales côte à côte, la plus
// haute valeur en avant — pour une direction qui compare du personnel,
// voir d'un coup d'œil qui est devant compte plus que le chiffre exact.
function CompareRow({
  label,
  values,
  format = (n) => String(n),
  colors,
  caveat,
}: {
  label: string;
  values: { prenom: string; value: number | null }[];
  format?: (n: number) => string;
  colors: string[];
  caveat?: string;
}) {
  const max = Math.max(...values.map((v) => v.value || 0), 1);
  return (
    <div className="mb-4">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-sm font-medium text-[#171717]">{label}</span>
        {caveat && <span className="text-[11px] italic text-neutral-400">{caveat}</span>}
      </div>
      <div className="space-y-1.5">
        {values.map((v, i) => (
          <div key={v.prenom} className="flex items-center gap-2">
            <span className="w-16 flex-shrink-0 text-xs text-neutral-500">{v.prenom}</span>
            <div className="h-5 flex-1 overflow-hidden rounded bg-neutral-100">
              <div
                className="h-full rounded"
                style={{
                  width: `${v.value != null && v.value > 0 ? Math.max((v.value / max) * 100, 4) : 0}%`,
                  background: colors[i],
                }}
              />
            </div>
            {/* Toujours affiché à côté, jamais DANS la barre — une barre à 0
                ou presque vide ne peut pas contenir de texte lisible, le
                chiffre disparaissait silencieusement (vécu : "Justine" à 0
                vérification semblait manquant plutôt que nul, 2026-10-28). */}
            <span className="w-16 flex-shrink-0 text-right text-xs font-medium text-[#171717]">
              {v.value != null ? format(v.value) : "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StatsEmployesView() {
  const [data, setData] = useState<StatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/direction/stats-employes");
        if (!res.ok) throw new Error("Échec du chargement.");
        setData(await res.json());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur inconnue.");
      }
    })();
  }, []);

  const colors = ["#8B4531", "#0F5C56"];

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <div>
        <h2 className="font-heading text-lg font-semibold text-[#171717]">Stat employés</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Sylvie vs Justine — depuis le 20 septembre 2026. Laura n&apos;est pas comparée (rôle différent, rédaction de
          programme ponctuelle).
        </p>
      </div>

      {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>}
      {!data ? (
        <div className="text-sm text-neutral-400">Chargement…</div>
      ) : (
        <div className="rounded-[6px] border border-[#eaeaea] bg-[#fafafa] p-5">
          <CompareRow
            label="Réservations rentrées"
            values={data.employes.map((e) => ({ prenom: e.prenom, value: e.reservations }))}
            colors={colors}
            caveat={data.employes.map((e) => `${e.prenom} : ${e.joursTravailles}j travaillés`).join(" · ")}
          />
          <CompareRow
            label="Moyenne par jour travaillé"
            values={data.employes.map((e) => ({ prenom: e.prenom, value: e.moyenneParJour }))}
            format={(n) => `${n}/j`}
            colors={colors}
          />
          <CompareRow
            label="Panier moyen (dossiers confirmés)"
            values={data.employes.map((e) => ({ prenom: e.prenom, value: e.panierMoyen }))}
            format={(n) => `${euros(n)} €`}
            colors={colors}
            caveat="Seules les réservations d'un dossier déjà « Client confirmé » comptent."
          />
          <CompareRow
            label="CA généré (dossiers confirmés)"
            values={data.employes.map((e) => ({ prenom: e.prenom, value: e.ca }))}
            format={(n) => `${euros(n)} €`}
            colors={colors}
            caveat="« Qui a saisi la réservation » ≠ « qui a convaincu le client »."
          />
          <CompareRow
            label="Marge générée"
            values={data.employes.map((e) => ({ prenom: e.prenom, value: e.marge }))}
            format={(n) => `${euros(n)} €`}
            colors={colors}
          />
          <CompareRow
            label="Relances effectuées"
            values={data.employes.map((e) => ({ prenom: e.prenom, value: e.relances }))}
            colors={colors}
          />
          <CompareRow
            label="Dossiers vérifiés"
            values={data.employes.map((e) => ({ prenom: e.prenom, value: e.verifications }))}
            colors={colors}
          />
          <CompareRow
            label="« Au revoir » (J+1) envoyés"
            values={data.employes.map((e) => ({ prenom: e.prenom, value: e.auRevoirEnvoyes }))}
            colors={colors}
          />
          <CompareRow
            label="Avis clients demandés"
            values={data.employes.map((e) => ({ prenom: e.prenom, value: e.avisDemandes }))}
            colors={colors}
          />
        </div>
      )}
    </div>
  );
}
