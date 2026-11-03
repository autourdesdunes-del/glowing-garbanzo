"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { EmployeFiche, EmployeSalaire, Profile } from "@/lib/types";
import { useToast } from "@/components/ToastProvider";
import { useConfirm } from "@/components/ConfirmProvider";
import { MONTH_NAMES_FULL } from "@/lib/planningRHFormat";

function euros(n: number) {
  return (Number(n) || 0).toLocaleString("fr-FR");
}

function dateLabel(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getDate()} ${MONTH_NAMES_FULL[d.getMonth()]} ${d.getFullYear()}`;
}

// Regroupe l'historique par année (sous-total par année) — demande de
// Mélanie, 2026-11-03 : sur 36+ lignes, un long tableau plat n'était plus
// lisible. `salaires` est déjà trié par date décroissante par l'appelant.
function groupesParAnnee(salaires: EmployeSalaire[]) {
  const groupes: { annee: string; lignes: EmployeSalaire[]; totalAnnee: number }[] = [];
  salaires.forEach((s) => {
    const annee = s.date_versement.slice(0, 4);
    const dernier = groupes[groupes.length - 1];
    if (dernier?.annee === annee) dernier.lignes.push(s);
    else groupes.push({ annee, lignes: [s], totalAnnee: 0 });
  });
  groupes.forEach((g) => {
    g.totalAnnee = g.lignes.reduce((sum, s) => sum + Number(s.montant || 0), 0);
  });
  return groupes;
}

// Segments **gras** et ==surligné pastel== à l'intérieur d'une ligne — même
// syntaxe légère que les titres/puces ci-dessous, demande de Mélanie,
// 2026-11-03 ("des trucs surlignés en pastel, des trucs en gras").
function InlineTexte({ text }: { text: string }) {
  const parts = text.split(/(\*\*.+?\*\*|==.+?==)/g).filter(Boolean);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**"))
          return (
            <strong key={i} className="font-semibold text-[#171717]">
              {part.slice(2, -2)}
            </strong>
          );
        if (part.startsWith("==") && part.endsWith("=="))
          return (
            <mark key={i} className="rounded bg-amber-100 px-1 py-0.5 text-[#171717]">
              {part.slice(2, -2)}
            </mark>
          );
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

// Rendu "page Notion" des conditions d'emploi en lecture — demande de
// Mélanie, 2026-11-03 : un bloc de texte brut dans un <textarea> n'était
// pas lisible. Le texte reste du markdown-lite en base (- puces, lignes
// finissant par ":" = titre de section, **gras**, ==surligné==) ; seul
// l'affichage change, l'édition reste en texte brut pour rester simple à
// saisir.
function ConditionsRendu({ text }: { text: string }) {
  const lignes = text.split("\n");
  const blocs: { type: "titre" | "liste" | "texte"; contenu: string[] }[] = [];
  lignes.forEach((ligne) => {
    const trimmed = ligne.trim();
    if (!trimmed) return;
    if (trimmed.startsWith("- ")) {
      const dernier = blocs[blocs.length - 1];
      if (dernier?.type === "liste") dernier.contenu.push(trimmed.slice(2));
      else blocs.push({ type: "liste", contenu: [trimmed.slice(2)] });
      return;
    }
    if (trimmed.endsWith(":")) {
      blocs.push({ type: "titre", contenu: [trimmed.slice(0, -1)] });
      return;
    }
    blocs.push({ type: "texte", contenu: [trimmed] });
  });
  return (
    <div className="space-y-2.5">
      {blocs.map((bloc, i) => {
        if (bloc.type === "titre")
          return (
            <p
              key={i}
              className="inline-block rounded bg-[#F2E6D2]/70 px-2 py-1 text-sm font-semibold text-[#5C2A1D]"
            >
              <InlineTexte text={bloc.contenu[0]} />
            </p>
          );
        if (bloc.type === "liste")
          return (
            <ul key={i} className="space-y-1 pl-4 text-sm text-[#171717]/90">
              {bloc.contenu.map((item, j) => (
                <li key={j} className="list-disc">
                  <InlineTexte text={item} />
                </li>
              ))}
            </ul>
          );
        return (
          <p key={i} className="text-sm text-[#171717]/90">
            <InlineTexte text={bloc.contenu[0]} />
          </p>
        );
      })}
    </div>
  );
}

// Fiche employé (conditions d'emploi + historique des salaires) — Direction
// uniquement, demande de Mélanie, 2026-11-03. Données séparées de la table
// profiles (lisible par toute l'équipe) : fetch et policies dédiées, voir
// migration 0169. `profiles` est déjà filtré par l'appelant (role "equipe",
// sans Laura/Bodé — voir teamProfiles dans PlanningRHView.tsx).
export default function EmployeFichesView({ profiles }: { profiles: Profile[] }) {
  const supabase = createClient();
  const toast = useToast();
  const confirm = useConfirm();

  const [fiches, setFiches] = useState<EmployeFiche[]>([]);
  const [salaires, setSalaires] = useState<EmployeSalaire[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editingConditions, setEditingConditions] = useState<Record<string, boolean>>({});
  const [conditionsDraft, setConditionsDraft] = useState<Record<string, string>>({});
  const [nouvelleDate, setNouvelleDate] = useState<Record<string, string>>({});
  const [nouveauMontant, setNouveauMontant] = useState<Record<string, string>>({});
  const [nouveauNote, setNouveauNote] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const [{ data: f }, { data: s }] = await Promise.all([
        supabase.from("employe_fiches").select("*"),
        supabase.from("employe_salaires").select("*").order("date_versement", { ascending: false }),
      ]);
      setFiches((f as EmployeFiche[]) || []);
      setSalaires((s as EmployeSalaire[]) || []);
      setLoaded(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const employes = useMemo(
    () => [...profiles].sort((a, b) => (a.prenom || "").localeCompare(b.prenom || "")),
    [profiles]
  );

  const ficheFor = (userId: string) => fiches.find((f) => f.user_id === userId);
  const salairesFor = (userId: string) =>
    salaires
      .filter((s) => s.user_id === userId)
      .sort((a, b) => b.date_versement.localeCompare(a.date_versement));

  const saveConditions = async (userId: string) => {
    const value = (conditionsDraft[userId] ?? ficheFor(userId)?.conditions_emploi ?? "").trim();
    setFiches((prev) => {
      const exists = prev.some((f) => f.user_id === userId);
      if (exists) return prev.map((f) => (f.user_id === userId ? { ...f, conditions_emploi: value } : f));
      return [...prev, { user_id: userId, conditions_emploi: value, updated_at: new Date().toISOString() }];
    });
    const { error } = await supabase
      .from("employe_fiches")
      .upsert({ user_id: userId, conditions_emploi: value, updated_at: new Date().toISOString() });
    if (error) {
      toast("Échec de l'enregistrement des conditions d'emploi.");
      return;
    }
    toast("Conditions d'emploi enregistrées.", "success");
    setEditingConditions((prev) => ({ ...prev, [userId]: false }));
  };

  const ajouterSalaire = async (userId: string) => {
    const dateVersement = nouvelleDate[userId];
    const montantInput = Number(nouveauMontant[userId]);
    if (!dateVersement) {
      toast("Choisis une date de versement.");
      return;
    }
    const note = nouveauNote[userId] || "";
    const { data, error } = await supabase
      .from("employe_salaires")
      .insert({ user_id: userId, date_versement: dateVersement, montant: montantInput || 0, note })
      .select();
    if (error) {
      toast("Échec de l'enregistrement du salaire.");
      return;
    }
    const saved = (data as EmployeSalaire[])[0];
    setSalaires((prev) => [...prev, saved]);
    setNouvelleDate((prev) => ({ ...prev, [userId]: "" }));
    setNouveauMontant((prev) => ({ ...prev, [userId]: "" }));
    setNouveauNote((prev) => ({ ...prev, [userId]: "" }));
    toast("Salaire enregistré.", "success");
  };

  const supprimerSalaire = async (id: string) => {
    const ok = await confirm({
      title: "Supprimer cette ligne de salaire ?",
      message: "Cette action est irréversible.",
      confirmLabel: "Supprimer",
      danger: true,
    });
    if (!ok) return;
    setSalaires((prev) => prev.filter((s) => s.id !== id));
    const { error } = await supabase.from("employe_salaires").delete().eq("id", id);
    if (error) toast("Échec de la suppression.");
  };

  if (!loaded) return null;

  return (
    <div className="space-y-3">
      <p className="text-xs text-[#666666]">
        Conditions d&apos;emploi et historique des salaires versés — visible uniquement par Direction.
      </p>
      {employes.map((p) => {
        const open = openId === p.id;
        const fiche = ficheFor(p.id);
        const histo = salairesFor(p.id);
        const totalHisto = histo.reduce((s, h) => s + Number(h.montant || 0), 0);
        return (
          <div key={p.id} className="rounded-md border border-neutral-200 bg-white">
            <button
              onClick={() => setOpenId(open ? null : p.id)}
              className="flex w-full items-center justify-between px-3 py-2.5 text-left"
            >
              <span className="text-sm font-medium text-[#171717]">{p.prenom || p.email}</span>
              <span className="text-xs text-neutral-400">
                {histo.length} versement{histo.length > 1 ? "s" : ""} {open ? "▲" : "▼"}
              </span>
            </button>
            {open && (
              <div className="space-y-4 border-t border-neutral-100 px-3 pb-4 pt-3">
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                      Conditions d&apos;emploi
                    </p>
                    {!editingConditions[p.id] && (
                      <button
                        onClick={() =>
                          setEditingConditions((prev) => ({ ...prev, [p.id]: true }))
                        }
                        className="text-xs text-neutral-500 hover:underline"
                      >
                        Modifier
                      </button>
                    )}
                  </div>
                  {editingConditions[p.id] ? (
                    <div className="space-y-2">
                      <textarea
                        value={conditionsDraft[p.id] ?? fiche?.conditions_emploi ?? ""}
                        onChange={(e) =>
                          setConditionsDraft((prev) => ({ ...prev, [p.id]: e.target.value }))
                        }
                        placeholder={
                          "Type de contrat, horaires, poste, date d'embauche…\n\n" +
                          "Astuce de mise en forme :\n" +
                          "Un titre de section :\n" +
                          "- un point de liste\n" +
                          "- un **mot en gras**, un ==mot surligné=="
                        }
                        rows={8}
                        className="input font-mono text-xs"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveConditions(p.id)}
                          className="rounded-md bg-[#171717] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                        >
                          Enregistrer
                        </button>
                        <button
                          onClick={() =>
                            setEditingConditions((prev) => ({ ...prev, [p.id]: false }))
                          }
                          className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  ) : fiche?.conditions_emploi ? (
                    <ConditionsRendu text={fiche.conditions_emploi} />
                  ) : (
                    <p className="text-xs text-neutral-400">Rien de renseigné pour l&apos;instant.</p>
                  )}
                </div>

                <div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-400">
                    Historique des salaires {histo.length > 0 && `— total ${euros(totalHisto)} €`}
                  </p>
                  {histo.length === 0 ? (
                    <p className="text-xs text-neutral-400">Aucun versement enregistré pour l&apos;instant.</p>
                  ) : (
                    <div className="overflow-hidden rounded-md border border-neutral-200">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-neutral-200 bg-[#fafafa] text-left text-[10px] uppercase tracking-wide text-neutral-400">
                            <th className="px-3 py-1.5 font-medium">Date</th>
                            <th className="w-24 px-3 py-1.5 text-right font-medium">Montant</th>
                            <th className="px-3 py-1.5 font-medium">Note</th>
                            <th className="px-3 py-1.5"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {groupesParAnnee(histo).map(({ annee, lignes, totalAnnee }) => (
                            <Fragment key={annee}>
                              <tr className="bg-[#fafafa]">
                                <td
                                  colSpan={3}
                                  className="px-3 py-1 text-xs font-semibold text-neutral-500"
                                >
                                  {annee}
                                </td>
                                <td className="px-3 py-1 text-right text-xs text-neutral-400">
                                  {euros(totalAnnee)} €
                                </td>
                              </tr>
                              {lignes.map((h, idx) => (
                                <tr
                                  key={h.id}
                                  className={`border-b border-neutral-200 last:border-0 ${
                                    idx % 2 === 1 ? "bg-[#fafafa]/70" : "bg-white"
                                  }`}
                                >
                                  <td className="whitespace-nowrap px-3 py-2 text-neutral-600">
                                    {dateLabel(h.date_versement)}
                                  </td>
                                  <td className="px-3 py-2 text-right font-medium tabular-nums text-[#171717]">
                                    {euros(h.montant)} €
                                  </td>
                                  <td className="px-3 py-2 text-xs leading-snug text-neutral-500">
                                    {h.note || "—"}
                                  </td>
                                  <td className="px-3 py-2 text-right align-top">
                                    <button
                                      onClick={() => supprimerSalaire(h.id)}
                                      className="text-xs text-red-600 hover:underline"
                                    >
                                      Retirer
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-end gap-2 rounded-md border border-dashed border-neutral-300 p-2.5">
                  <label className="flex flex-col gap-1 text-xs text-neutral-500">
                    Date de versement
                    <input
                      type="date"
                      value={nouvelleDate[p.id] || ""}
                      onChange={(e) => setNouvelleDate((prev) => ({ ...prev, [p.id]: e.target.value }))}
                      className="input w-36"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-neutral-500">
                    Montant (€)
                    <input
                      type="number"
                      step="0.01"
                      value={nouveauMontant[p.id] || ""}
                      onChange={(e) => setNouveauMontant((prev) => ({ ...prev, [p.id]: e.target.value }))}
                      className="input w-28"
                    />
                  </label>
                  <label className="flex min-w-[140px] flex-1 flex-col gap-1 text-xs text-neutral-500">
                    Note (optionnel)
                    <input
                      value={nouveauNote[p.id] || ""}
                      onChange={(e) => setNouveauNote((prev) => ({ ...prev, [p.id]: e.target.value }))}
                      className="input"
                    />
                  </label>
                  <button
                    onClick={() => ajouterSalaire(p.id)}
                    className="rounded-md bg-[#171717] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
                  >
                    Ajouter
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
