import React from "react";
const { useState, useEffect, useCallback } = React;

const CLIENTS_KEY = "clients-v2";
const CATALOGUE_KEY = "catalogue-activites-v1";

const EMPTY_CLIENT = () => ({
  id: "c" + Date.now() + Math.random().toString(36).slice(2, 7),
  nom: "",
  canal: "WhatsApp",
  canalAutre: "",
  pseudoContact: "",
  relationGraceA: "Instagram",
  relationAutre: "",
  statut: "Prospect",
  telephone: "",
  email: "",
  hotel: "",
  chambre: "",
  dateDebut: "",
  dateFin: "",
  adultes: 2,
  enfants: 0,
  agesEnfants: "",
  participantNoms: "",
  lienPasseport: "",
  infosManquantes: [],
  infoManquanteAutre: "",
  commentaires: "",
  paiements: [],
  solde: { montant: 0, mode: "Espèces EUR", date: "", paye: false, activiteId: "", rdvHeure: "", rdvLieu: "", assigneA: "" },
  reservations: [],
  remboursements: [],
  verifications: [],
  auRevoirEnvoye: false,
  avisEnvoye: false,
  billetAvion: { requis: false, acomptePaye: false, billetEnvoye: false, lienBillet: "", statut: "En attente", notes: "", date: "", activiteId: "" },
});

const EMPTY_RESA = () => ({
  id: "r" + Date.now() + Math.random().toString(36).slice(2, 7),
  nomActivite: "",
  dateDebut: "",
  dateFin: "",
  moment: "Journée",
  puAdulte: 0,
  puEnfant: 0,
  participantsMode: "tous",
  participantsAdultes: 0,
  participantsEnfants: 0,
  participantsNoms: "",
  options: [],
  transfertInclus: true,
  transfertMontant: 0,
  horaireApprox: "",
  pickupReel: "",
  inclus: "",
  nonInclus: "",
  aPrevoir: "",
  pointRdv: "",
  infoImportante: "",
  coutReel: 0,
  paxOverride: "",
  statutResa: "Brouillon",
  photoUrl: "",
  expanded: false,
});

const EMPTY_PAIEMENT = () => ({
  id: "p" + Date.now() + Math.random().toString(36).slice(2, 7),
  montant: 0,
  mode: "PayPal",
  date: "",
});

const EMPTY_REMBOURSEMENT = () => ({
  id: "rb" + Date.now() + Math.random().toString(36).slice(2, 7),
  montant: 0,
  raison: "Annulation",
  raisonAutre: "",
  activiteId: "",
  dateProbleme: "",
  mode: "Virement bancaire",
  par: "",
  dateRemboursement: "",
  statut: "En attente",
});

const EMPTY_CATALOGUE_ITEM = () => ({
  id: "a" + Date.now() + Math.random().toString(36).slice(2, 7),
  nom: "",
  disponibilites: "",
  puAdulte: 0,
  puEnfant: 0,
  puBebe: 0,
  margePct: 0,
  horaireApprox: "",
  inclus: "",
  nonInclus: "",
  aPrevoir: "",
  pointRdv: "",
  valide: false,
});

const STATUTS = ["Prospect", "En négociation", "Client confirmé", "Perdu"];
const CANAUX = ["Instagram", "WhatsApp", "TikTok", "Email", "Autre"];
const RELATIONS = ["Bouche à oreille", "Instagram", "TikTok", "Influenceurs", "Google", "Site internet", "Le Petit Futé", "Élodie Gossuin", "VIP Mélanie", "Agence de voyage", "TripAdvisor", "ChatGPT", "GetYourGuide", "Autre"];
const MOMENTS = ["Matin", "Après-midi", "Journée", "Plusieurs jours"];
const TYPES_PAIEMENT = ["Acompte", "Partiel", "Solde", "Total"];
const MODES_PAIEMENT = ["PayPal", "Espèces EUR", "Espèces EGP", "Carte bleue", "Virement bancaire"];
const OPTIONS_PRESETS = ["Guide francophone", "Privatif", "Autre"];
const INFOS_MANQUANTES_OPTIONS = ["Room number", "Date de RDV", "Numéro WhatsApp", "Billets d'avion", "Passeport", "Acompte PayPal", "Localisation", "Ticket de train", "Autre"];
const RAISONS_REMBOURSEMENT = ["Annulation", "Problème activité", "Dédommagement", "Autre"];

function fmtDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((d - now) / 86400000);
}
function euros(n) {
  return (Number(n) || 0).toLocaleString("fr-FR");
}

function computeResaTotal(r) {
  const nbAd = r.participantsMode === "tous" ? null : Number(r.participantsAdultes) || 0;
  const nbEnf = r.participantsMode === "tous" ? null : Number(r.participantsEnfants) || 0;
  return { nbAd, nbEnf };
}

export default function App() {
  const [clients, setClients] = useState([]);
  const [catalogue, setCatalogue] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState("idle");
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("team");
  const [previewId, setPreviewId] = useState(null);
  const [directionUnlocked, setDirectionUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const DIRECTOR_PIN = "2026";

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(CLIENTS_KEY, true);
        const data = res && res.value ? JSON.parse(res.value) : [];
        setClients(data);
        if (data.length) setSelectedId(data[0].id);
      } catch (e) { setClients([]); }
      try {
        const res2 = await window.storage.get(CATALOGUE_KEY, true);
        const data2 = res2 && res2.value ? JSON.parse(res2.value) : [];
        setCatalogue(data2);
      } catch (e) { setCatalogue([]); }
      setLoaded(true);
    })();
  }, []);

  const persistClients = useCallback(async (next) => {
    setSaveState("saving");
    try {
      await window.storage.set(CLIENTS_KEY, JSON.stringify(next), true);
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 1000);
    } catch (e) { setSaveState("error"); }
  }, []);

  const persistCatalogue = useCallback(async (next) => {
    try { await window.storage.set(CATALOGUE_KEY, JSON.stringify(next), true); } catch (e) {}
  }, []);

  const updateClients = (next) => { setClients(next); persistClients(next); };
  const updateCatalogue = (next) => { setCatalogue(next); persistCatalogue(next); };

  const addClient = () => {
    const c = EMPTY_CLIENT();
    updateClients([c, ...clients]);
    setSelectedId(c.id);
    setMode("team");
  };

  const duplicateAsNewStay = (source) => {
    const c = {
      ...EMPTY_CLIENT(),
      nom: source.nom,
      telephone: source.telephone,
      email: source.email,
      relationGraceA: source.relationGraceA,
      lienPasseport: source.lienPasseport,
    };
    updateClients([c, ...clients]);
    setSelectedId(c.id);
  };
  const updateClient = (id, patch) => updateClients(clients.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const deleteClient = (id) => {
    const next = clients.filter((c) => c.id !== id);
    updateClients(next);
    if (selectedId === id) setSelectedId(next[0] ? next[0].id : null);
  };

  const filtered = clients.filter((c) => (c.nom || "").toLowerCase().includes(query.toLowerCase()));
  const selected = clients.find((c) => c.id === selectedId);
  const previewClient = clients.find((c) => c.id === previewId) || clients[0];

  if (!loaded) return <div style={S.loading}>Chargement…</div>;

  return (
    <div style={S.app}>
      <style>{CSS}</style>
      <div style={S.topbar} className="ad-topbar">
        <div style={S.brand}>
          <div style={S.brandMark}>AD</div>
          <div>
            <div style={S.brandName}>Autour des Dunes — Espace interne</div>
            <div style={S.brandSub} className="ad-brand-sub">{saveState === "saving" ? "Enregistrement…" : "Données partagées entre l'équipe"}</div>
          </div>
        </div>
        <div style={S.tabs} className="ad-tabs">
          <button style={mode === "team" ? S.tabActive : S.tab} onClick={() => setMode("team")}>Vue équipe</button>
          <button style={mode === "catalogue" ? S.tabActive : S.tab} onClick={() => setMode("catalogue")}>Catalogue</button>
          <button style={mode === "suivis" ? S.tabActive : S.tab} onClick={() => setMode("suivis")}>Suivis</button>
          <button style={mode === "planning" ? S.tabActive : S.tab} onClick={() => setMode("planning")}>Réservations</button>
          <button style={mode === "preview" ? S.tabActive : S.tab} onClick={() => { setMode("preview"); if (!previewId && clients[0]) setPreviewId(clients[0].id); }}>Aperçu client</button>
          <button style={mode === "direction" ? S.tabActive : S.tab} onClick={() => setMode("direction")}>Direction</button>
        </div>
      </div>

      {mode === "team" && (
        <div style={S.teamLayout}>
          <div style={S.sidebar}>
            <div style={S.sidebarHead}>
              <input style={S.search} placeholder="Rechercher un client…" value={query} onChange={(e) => setQuery(e.target.value)} />
              <button style={S.addBtn} onClick={addClient}>+ Nouveau</button>
            </div>
            <div style={S.clientList}>
              {filtered.length === 0 && <div style={S.emptyList}>Aucun client.</div>}
              {filtered.map((c) => (
                <button key={c.id} style={c.id === selectedId ? S.clientItemActive : S.clientItem} onClick={() => setSelectedId(c.id)}>
                  <div style={S.clientItemName}>{c.nom || "Sans nom"}</div>
                  <div style={S.clientItemMeta}>
                    <span style={S.badge(c.statut)}>{c.statut}</span>
                    {c.dateDebut && <span style={S.clientItemDate}>{fmtDate(c.dateDebut)}</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div style={S.detail}>
            {!selected ? (
              <div style={S.emptyDetail}>Sélectionnez ou créez un client pour commencer.</div>
            ) : (
              <ClientForm key={selected.id} client={selected} catalogue={catalogue} allClients={clients} onChange={(patch) => updateClient(selected.id, patch)} onDelete={() => deleteClient(selected.id)} onDuplicateAsNewStay={(c) => duplicateAsNewStay(c)} onJumpTo={(id) => setSelectedId(id)} />
            )}
          </div>
        </div>
      )}

      {mode === "catalogue" && <CatalogueManager catalogue={catalogue} onChange={updateCatalogue} />}

      {mode === "planning" && <PlanningPanel clients={clients} onOpenClient={(id) => { setSelectedId(id); setMode("team"); }} />}

      {mode === "suivis" && <SuivisPanel clients={clients} onUpdateClient={updateClient} onOpenClient={(id) => { setSelectedId(id); setMode("team"); }} />}

      {mode === "direction" && (
        directionUnlocked ? (
          <DirectionPanel clients={clients} catalogue={catalogue} onUpdateCatalogue={updateCatalogue} />
        ) : (
          <div style={S.pinWrap}>
            <p style={S.catalogueSub}>Espace pensé pour un usage de confiance — ce n'est pas une vraie sécurité, juste un frein simple.</p>
            <input style={S.input} type="password" placeholder="Code d'accès" value={pinInput} onChange={(e) => setPinInput(e.target.value)} />
            <button style={S.addBtn} onClick={() => { if (pinInput === DIRECTOR_PIN) setDirectionUnlocked(true); }}>Déverrouiller</button>
          </div>
        )
      )}

      {mode === "preview" && (
        <div style={S.previewWrap}>
          <div style={S.previewPicker}>
            <label style={S.previewLabel}>Client à prévisualiser</label>
            <select style={S.previewSelect} value={previewId || ""} onChange={(e) => setPreviewId(e.target.value)}>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.nom || "Sans nom"}</option>)}
            </select>
          </div>
          {previewClient ? <ClientPreview client={previewClient} catalogue={catalogue} /> : <div style={S.emptyDetail}>Créez un client pour voir son aperçu.</div>}
        </div>
      )}
    </div>
  );
}

/* ---------------- DIRECTION (Phase 3) ---------------- */
function DirectionPanel({ clients, catalogue, onUpdateCatalogue }) {
  const rows = [];
  clients.forEach((c) => {
    (c.reservations || []).forEach((r) => {
      const total = resaTotalMontant(r, c);
      const cout = Number(r.coutReel) || 0;
      rows.push({ nom: r.nomActivite || "Sans nom", date: r.dateDebut, total, marge: total - cout, clientNom: c.nom || "Sans nom" });
    });
  });

  const byMonth = {};
  const byYear = {};
  rows.forEach((r) => {
    if (!r.date) return;
    byMonth[r.date.slice(0, 7)] = (byMonth[r.date.slice(0, 7)] || 0) + r.total;
    byYear[r.date.slice(0, 4)] = (byYear[r.date.slice(0, 4)] || 0) + r.total;
  });

  const byActivite = {};
  rows.forEach((r) => {
    if (!byActivite[r.nom]) byActivite[r.nom] = { count: 0, total: 0, marge: 0 };
    byActivite[r.nom].count += 1;
    byActivite[r.nom].total += r.total;
    byActivite[r.nom].marge += r.marge;
  });
  const topVendues = Object.entries(byActivite).sort((a, b) => b[1].total - a[1].total).slice(0, 8);
  const topRentables = Object.entries(byActivite).sort((a, b) => b[1].marge - a[1].marge).slice(0, 8);

  const byClient = {};
  rows.forEach((r) => { byClient[r.clientNom] = (byClient[r.clientNom] || 0) + r.total; });
  const topClients = Object.entries(byClient).sort((a, b) => b[1] - a[1]).slice(0, 8);

  const caTotal = rows.reduce((s, r) => s + r.total, 0);
  const margeTotal = rows.reduce((s, r) => s + r.marge, 0);
  const margePct = caTotal > 0 ? Math.round((margeTotal / caTotal) * 100) : 0;

  const updateCatalogueMarge = (id, val) => onUpdateCatalogue(catalogue.map((a) => (a.id === id ? { ...a, margePct: val } : a)));

  return (
    <div style={S.suivisWrap}>
      <h3 style={S.sectionTitle}>Vue direction</h3>
      <div style={S.dashGrid}>
        <div style={S.dashCard}><p style={S.dashLabel}>CA total</p><p style={S.dashValue}>{euros(caTotal)} €</p></div>
        <div style={S.dashCard}><p style={S.dashLabel}>Marge totale</p><p style={S.dashValue}>{euros(margeTotal)} €</p></div>
        <div style={S.dashCard}><p style={S.dashLabel}>Marge %</p><p style={S.dashValue}>{margePct}%</p></div>
      </div>

      <h3 style={{ ...S.sectionTitle, marginTop: 22 }}>Marge de référence par activité (catalogue)</h3>
      <p style={S.catalogueSub}>Note indicative par type d'activité — la marge réelle par dossier reste calculée depuis le "Coût réel" saisi sur chaque réservation.</p>
      {catalogue.length === 0 && <div style={S.emptyList}>Aucune activité dans le catalogue.</div>}
      {catalogue.map((a) => (
        <div key={a.id} style={S.suiviRow}>
          <span style={S.suiviRowMain}>{a.nom || "Sans nom"}</span>
          <input type="number" style={{ ...S.input, maxWidth: 90 }} value={a.margePct} onChange={(e) => updateCatalogueMarge(a.id, e.target.value)} />
          <span>% de marge visée</span>
        </div>
      ))}

      <h3 style={{ ...S.sectionTitle, marginTop: 22 }}>CA par mois</h3>
      {Object.entries(byMonth).sort().reverse().map(([m, v]) => (
        <div key={m} style={S.suiviRow}><span style={S.suiviRowDate}>{m}</span><span style={S.suiviRowMain}>{euros(v)} €</span></div>
      ))}
      {Object.keys(byMonth).length === 0 && <div style={S.emptyList}>Pas encore de données datées.</div>}

      <h3 style={{ ...S.sectionTitle, marginTop: 22 }}>CA par année</h3>
      {Object.entries(byYear).sort().reverse().map(([y, v]) => (
        <div key={y} style={S.suiviRow}><span style={S.suiviRowDate}>{y}</span><span style={S.suiviRowMain}>{euros(v)} €</span></div>
      ))}

      <h3 style={{ ...S.sectionTitle, marginTop: 22 }}>Activités les plus vendues</h3>
      {topVendues.map(([nom, d]) => (
        <div key={nom} style={S.suiviRow}><span style={S.suiviRowMain}><strong>{nom}</strong> — {d.count} vente(s)</span><span>{euros(d.total)} €</span></div>
      ))}
      {topVendues.length === 0 && <div style={S.emptyList}>Pas encore d'activités vendues.</div>}

      <h3 style={{ ...S.sectionTitle, marginTop: 22 }}>Activités les plus rentables</h3>
      {topRentables.map(([nom, d]) => (
        <div key={nom} style={S.suiviRow}><span style={S.suiviRowMain}><strong>{nom}</strong></span><span>{euros(d.marge)} € de marge</span></div>
      ))}
      {topRentables.length === 0 && <div style={S.emptyList}>Pas encore de données de coût.</div>}

      <h3 style={{ ...S.sectionTitle, marginTop: 22 }}>Plus gros clients</h3>
      {topClients.map(([nom, total]) => (
        <div key={nom} style={S.suiviRow}><span style={S.suiviRowMain}><strong>{nom}</strong></span><span>{euros(total)} €</span></div>
      ))}
      {topClients.length === 0 && <div style={S.emptyList}>Pas encore de clients avec activités.</div>}
    </div>
  );
}

/* ---------------- CATALOGUE ---------------- */
function CatalogueManager({ catalogue, onChange }) {
  const add = () => onChange([EMPTY_CATALOGUE_ITEM(), ...catalogue]);
  const update = (id, patch) => onChange(catalogue.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  const remove = (id) => onChange(catalogue.filter((a) => a.id !== id));

  return (
    <div style={S.catalogueWrap}>
      <div style={S.catalogueHead}>
        <div>
          <h3 style={S.sectionTitle}>Catalogue d'activités</h3>
          <p style={S.catalogueSub}>Rempli une fois, réutilisé pour chaque réservation — pré-remplit prix, horaires, inclus/non inclus.</p>
        </div>
        <button style={S.addBtn} onClick={add}>+ Nouvelle activité</button>
      </div>
      {catalogue.length === 0 && <div style={S.emptyList}>Aucune activité dans le catalogue pour l'instant.</div>}
      {catalogue.map((a) => {
        if (a.valide) {
          return (
            <div key={a.id} style={S.actCardDone} onClick={() => update(a.id, { valide: false })}>
              <span style={S.doneCheck}>✓</span>
              <span style={S.actCardTitleDone}>{a.nom || "Sans nom"}</span>
              <span style={S.actCardMeta}>{a.disponibilites || "Disponibilités ?"}</span>
              <span style={{ flex: 1 }} />
              <span style={S.actCardMeta}>Ad. {euros(a.puAdulte)}€ · Enf. {euros(a.puEnfant)}€ · Bébé {euros(a.puBebe)}€</span>
            </div>
          );
        }
        return (
        <div key={a.id} style={S.catalogueCard}>
          <div style={S.resaStatusRow}>
            <span style={S.draftTag}>✎ Brouillon</span>
            <button style={S.confirmBtn} onClick={() => update(a.id, { valide: true })}>✓ Valider cette activité</button>
          </div>
          <div style={S.resaTopRow}>
            <input style={S.resaName} placeholder="Nom de l'activité" value={a.nom} onChange={(e) => update(a.id, { nom: e.target.value })} />
            <button style={S.smallDeleteBtn} onClick={() => remove(a.id)}>Retirer</button>
          </div>
          <div style={S.grid3}>
            <Field label="Disponibilités"><input style={S.input} placeholder="ex. tous les jours, sauf vendredi" value={a.disponibilites} onChange={(e) => update(a.id, { disponibilites: e.target.value })} /></Field>
            <Field label="PU adulte (€)"><input type="number" style={S.input} value={a.puAdulte} onChange={(e) => update(a.id, { puAdulte: e.target.value })} /></Field>
            <Field label="PU enfant (€)"><input type="number" style={S.input} value={a.puEnfant} onChange={(e) => update(a.id, { puEnfant: e.target.value })} /></Field>
            <Field label="PU bébé (€)"><input type="number" style={S.input} value={a.puBebe} onChange={(e) => update(a.id, { puBebe: e.target.value })} /></Field>
            <Field label="Horaire approximatif"><input style={S.input} value={a.horaireApprox} onChange={(e) => update(a.id, { horaireApprox: e.target.value })} /></Field>
            <Field label="Point de RDV"><input style={S.input} value={a.pointRdv} onChange={(e) => update(a.id, { pointRdv: e.target.value })} /></Field>
            <Field label="Inclus"><input style={S.input} value={a.inclus} onChange={(e) => update(a.id, { inclus: e.target.value })} /></Field>
            <Field label="Non inclus"><input style={S.input} value={a.nonInclus} onChange={(e) => update(a.id, { nonInclus: e.target.value })} /></Field>
            <Field label="À prévoir"><input style={S.input} value={a.aPrevoir} onChange={(e) => update(a.id, { aPrevoir: e.target.value })} /></Field>
          </div>
        </div>
        );
      })}
    </div>
  );
}

/* ---------------- SUIVIS (Phase 2) ---------------- */
/* ---------------- PLANNING (par date) ---------------- */
function resaActiveOn(r, dateStr) {
  if (!r.dateDebut) return false;
  const end = r.dateFin || r.dateDebut;
  return dateStr >= r.dateDebut && dateStr <= end;
}
function rangesOverlap(rStart, rEnd, fStart, fEnd) {
  if (!rStart) return false;
  const end = rEnd || rStart;
  return rStart <= fEnd && end >= fStart;
}
function toStr(d) { return d.toISOString().slice(0, 10); }

function PlanningPanel({ clients, onOpenClient }) {
  const [filter, setFilter] = useState("aujourdhui");
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayStr = toStr(today);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const prochainStart = new Date(today); prochainStart.setDate(today.getDate() + 2);
  const prochainEnd = new Date(today); prochainEnd.setDate(today.getDate() + 8);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const rows = [];
  clients.forEach((c) => {
    (c.reservations || []).forEach((r) => {
      if (!r.dateDebut) return;
      let include = true;
      if (filter === "hier") include = resaActiveOn(r, toStr(yesterday));
      else if (filter === "aujourdhui") include = resaActiveOn(r, todayStr);
      else if (filter === "demain") include = resaActiveOn(r, toStr(tomorrow));
      else if (filter === "prochainement") include = rangesOverlap(r.dateDebut, r.dateFin, toStr(prochainStart), toStr(prochainEnd));
      else if (filter === "mois") include = rangesOverlap(r.dateDebut, r.dateFin, toStr(monthStart), toStr(monthEnd));
      if (!include) return;

      const total = resaTotalMontant(r, c);
      const soldeIci = c.solde && c.solde.activiteId === r.id;
      const statutPaiement = soldeIci ? (c.solde.paye ? "Payé" : "À régler") : null;
      const dernierMode = soldeIci && c.solde.paye ? c.solde.mode : null;
      const nbAd = r.participantsMode === "tous" ? Number(c.adultes) || 0 : Number(r.participantsAdultes) || 0;
      const nbEnf = r.participantsMode === "tous" ? Number(c.enfants) || 0 : Number(r.participantsEnfants) || 0;
      const infoStatut = (c.infosManquantes && c.infosManquantes.length && !c.infosManquantes.includes("Complet")) ? c.infosManquantes[0] : "Complet";
      rows.push({ client: c, r, total, statutPaiement, dernierMode, nbAd, nbEnf, infoStatut, soldeIci, soldeMontant: soldeIci ? c.solde.montant : 0 });
    });
  });
  rows.sort((a, b) => (a.r.dateDebut || "").localeCompare(b.r.dateDebut || ""));

  const grouped = {};
  rows.forEach((row) => {
    const key = row.r.dateDebut;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(row);
  });

  return (
    <div style={S.suivisWrap}>
      <div style={S.chipRow}>
        <ChipToggle label="Hier" active={filter === "hier"} onClick={() => setFilter("hier")} tone="warn" />
        <ChipToggle label="Aujourd'hui" active={filter === "aujourdhui"} onClick={() => setFilter("aujourdhui")} tone="ok" />
        <ChipToggle label="Demain" active={filter === "demain"} onClick={() => setFilter("demain")} tone="ok" />
        <ChipToggle label="Prochainement" active={filter === "prochainement"} onClick={() => setFilter("prochainement")} tone="ok" />
        <ChipToggle label="Ce mois-ci" active={filter === "mois"} onClick={() => setFilter("mois")} tone="ok" />
        <ChipToggle label="Tout" active={filter === "tout"} onClick={() => setFilter("tout")} tone="warn" />
      </div>

      {Object.keys(grouped).length === 0 && <div style={{ ...S.emptyList, marginTop: 16 }}>Aucune activité sur cette période.</div>}

      {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([date, items]) => (
        <div key={date} style={S.tableWrap}>
          <h3 style={S.sectionTitle}>{fmtDate(date)}{date === todayStr ? " — aujourd'hui" : ""}</h3>
          <div style={S.cardGrid}>
            {items.map(({ client, r, total, statutPaiement, dernierMode, nbAd, nbEnf, infoStatut, soldeIci, soldeMontant }) => (
              <div key={r.id} style={S.actCard} onClick={() => onOpenClient(client.id)}>
                <p style={S.actCardTitle}>
                  {r.nomActivite || "Activité"}
                  {soldeIci && !client.solde.paye && <span style={S.warnIcon}> ⚠️ solde à régler ici</span>}
                </p>
                <p style={S.actCardMeta}>{fmtDate(r.dateDebut)}{r.dateFin && r.dateFin !== r.dateDebut ? ` → ${fmtDate(r.dateFin)}` : ""} · {r.moment}{r.pickupReel ? ` · Pick-up ${r.pickupReel}` : ""}</p>
                <p style={S.actCardClient}>{client.nom || "Sans nom"}</p>
                <p style={S.actCardMeta}>{r.paxOverride || `${nbAd} adultes${nbEnf ? `, ${nbEnf} enfant(s)` : ""}`}</p>
                <div style={S.actCardFooter}>
                  {soldeIci ? <span style={S.miniBadge(statutPaiement)}>💰 Solde — {statutPaiement}{dernierMode ? ` — ${dernierMode}` : ""}</span> : <span />}
                  <span style={S.actCardTotal}>{euros(total)} €</span>
                </div>
                <span style={S.miniBadge(infoStatut === "Complet" ? "Payé" : "En attente")}>{infoStatut}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SuivisPanel({ clients, onUpdateClient, onOpenClient }) {
  const [sub, setSub] = useState("rdv");
  const [expanded, setExpanded] = useState({});
  const toggleExpand = (key) => setExpanded((e) => ({ ...e, [key]: !e[key] }));
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);

  const rdvRows = [];
  clients.forEach((c) => {
    if (c.solde && !c.solde.activiteId && (c.solde.rdvHeure || c.solde.rdvLieu)) {
      rdvRows.push({ client: c, paiement: c.solde });
    }
  });
  rdvRows.sort((a, b) => (a.paiement.date || "").localeCompare(b.paiement.date || ""));

  const auRevoirRows = clients
    .filter((c) => c.dateFin)
    .map((c) => ({ c, dateCible: addDays(c.dateFin, 1) }))
    .filter((x) => x.dateCible <= todayStr || x.dateCible === todayStr)
    .sort((a, b) => a.dateCible.localeCompare(b.dateCible));

  const avisRows = clients
    .filter((c) => c.dateFin)
    .map((c) => ({ c, dateCible: addDays(c.dateFin, 7) }))
    .filter((x) => x.dateCible <= todayStr)
    .sort((a, b) => a.dateCible.localeCompare(b.dateCible));

  const remboursementRows = [];
  clients.forEach((c) => (c.remboursements || []).forEach((r) => remboursementRows.push({ client: c, r })));
  remboursementRows.sort((a, b) => (b.r.dateProbleme || "").localeCompare(a.r.dateProbleme || ""));

  const billetsRows = clients.filter((c) => c.billetAvion && c.billetAvion.requis);

  const JumpBtn = ({ id }) => (
    <button style={S.linkChip} onClick={() => onOpenClient(id)}>→ Fiche client</button>
  );

  return (
    <div style={S.suivisWrap}>
      <div style={S.chipRow}>
        <ChipToggle label="RDV paiements" active={sub === "rdv"} onClick={() => setSub("rdv")} tone="ok" />
        <ChipToggle label="Au revoir" active={sub === "aurevoir"} onClick={() => setSub("aurevoir")} tone="ok" />
        <ChipToggle label="Avis clients" active={sub === "avis"} onClick={() => setSub("avis")} tone="ok" />
        <ChipToggle label="Remboursements" active={sub === "remb"} onClick={() => setSub("remb")} tone="warn" />
        <ChipToggle label="Billets d'avion" active={sub === "billets"} onClick={() => setSub("billets")} tone="ok" />
      </div>

      {sub === "rdv" && (
        <div style={S.tableWrap}>
          <h3 style={S.sectionTitle}>Rendez-vous de paiement à venir</h3>
          {rdvRows.length === 0 && <div style={S.emptyList}>Aucun RDV paiement enregistré.</div>}
          {rdvRows.map(({ client, paiement }) => (
            <div key={paiement.id} style={S.suiviRow}>
              <span style={S.suiviRowDate}>{fmtDate(paiement.date)} {paiement.rdvHeure}</span>
              <span style={S.suiviRowMain}><strong>{client.nom || "Sans nom"}</strong> — {client.hotel || "Hôtel ?"}</span>
              <span>{paiement.rdvLieu}</span>
              <span>{euros(paiement.montant)} €</span>
              <span>{paiement.assigneA || "Non assigné"}</span>
              <JumpBtn id={client.id} />
            </div>
          ))}
        </div>
      )}

      {sub === "aurevoir" && (
        <div style={S.tableWrap}>
          <h3 style={S.sectionTitle}>Messages de bon retour à envoyer (J+1)</h3>
          {auRevoirRows.length === 0 && <div style={S.emptyList}>Rien à envoyer pour l'instant.</div>}
          {auRevoirRows.map(({ c, dateCible }) => (
            <div key={c.id} style={{ ...S.suiviRow, ...(dateCible === todayStr ? S.suiviRowToday : {}) }}>
              <span style={S.suiviRowDate}>{fmtDate(dateCible)}{dateCible === todayStr ? " — aujourd'hui" : ""}</span>
              <span style={S.suiviRowMain}><strong>{c.nom || "Sans nom"}</strong></span>
              <label style={S.checkLabel}>
                <input type="checkbox" checked={!!c.auRevoirEnvoye} onChange={(e) => onUpdateClient(c.id, { auRevoirEnvoye: e.target.checked })} /> Envoyé
              </label>
              <JumpBtn id={c.id} />
            </div>
          ))}
        </div>
      )}

      {sub === "avis" && (
        <div style={S.tableWrap}>
          <h3 style={S.sectionTitle}>Demandes d'avis à envoyer (J+7)</h3>
          {avisRows.length === 0 && <div style={S.emptyList}>Rien à envoyer pour l'instant.</div>}
          {avisRows.map(({ c, dateCible }) => (
            <div key={c.id} style={{ ...S.suiviRow, ...(dateCible === todayStr ? S.suiviRowToday : {}) }}>
              <span style={S.suiviRowDate}>{fmtDate(dateCible)}{dateCible === todayStr ? " — aujourd'hui" : ""}</span>
              <span style={S.suiviRowMain}><strong>{c.nom || "Sans nom"}</strong></span>
              <label style={S.checkLabel}>
                <input type="checkbox" checked={!!c.avisEnvoye} onChange={(e) => onUpdateClient(c.id, { avisEnvoye: e.target.checked })} /> Envoyé
              </label>
              <JumpBtn id={c.id} />
            </div>
          ))}
        </div>
      )}

      {sub === "remb" && (
        <div style={S.tableWrap}>
          <h3 style={S.sectionTitle}>Remboursements</h3>
          {remboursementRows.length === 0 && <div style={S.emptyList}>Aucun remboursement enregistré.</div>}
          {remboursementRows.map(({ client, r }) => {
            const activite = (client.reservations || []).find((res) => res.id === r.activiteId);
            const isOpen = expanded["remb-" + r.id];
            return (
              <div key={r.id} style={S.expandableCard}>
                <div style={S.suiviRow} onClick={() => toggleExpand("remb-" + r.id)}>
                  <span style={S.suiviRowDate}>{fmtDate(r.dateProbleme)}</span>
                  <span style={S.suiviRowMain}><strong>{client.nom || "Sans nom"}</strong> — {r.raison === "Autre" ? r.raisonAutre || "Autre" : r.raison}</span>
                  <span>{activite ? activite.nomActivite : "Non liée"}</span>
                  <span>{euros(r.montant)} €</span>
                  <span style={S.miniBadge(r.statut === "Effectué" ? "Payé" : "En attente")}>{r.statut}</span>
                </div>
                {isOpen && (
                  <div style={S.expandDetail}>
                    <div>Mode : {r.mode || "—"}</div>
                    <div>Fait par : {r.par || "—"}</div>
                    <div>Date du remboursement : {r.dateRemboursement ? fmtDate(r.dateRemboursement) : "—"}</div>
                    <JumpBtn id={client.id} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {sub === "billets" && (
        <div style={S.tableWrap}>
          <h3 style={S.sectionTitle}>Billets d'avion — pour Hossam</h3>
          {billetsRows.length === 0 && <div style={S.emptyList}>Aucun client avec billet à gérer pour l'instant.</div>}
          {billetsRows.map((c) => {
            const activite = (c.reservations || []).find((r) => r.id === c.billetAvion.activiteId);
            const isOpen = expanded["billet-" + c.id];
            return (
              <div key={c.id} style={S.expandableCard}>
                <div style={S.suiviRow} onClick={() => toggleExpand("billet-" + c.id)}>
                  <span style={S.suiviRowDate}>{c.billetAvion.date ? fmtDate(c.billetAvion.date) : "Date ?"}</span>
                  <span style={S.suiviRowMain}><strong>{c.nom || "Sans nom"}</strong> — {c.hotel || "Hôtel ?"}</span>
                  {activite && <span>Lié à : {activite.nomActivite}</span>}
                  <span style={S.miniBadge(c.billetAvion.acomptePaye ? "Payé" : "En attente")}>Acompte {c.billetAvion.acomptePaye ? "payé" : "en attente"}</span>
                  <span style={S.miniBadge(c.billetAvion.billetEnvoye ? "Payé" : "En attente")}>{c.billetAvion.billetEnvoye ? "Envoyé" : "Pas envoyé"}</span>
                  <span style={S.miniBadge(c.billetAvion.statut === "Validé" ? "Payé" : c.billetAvion.statut === "Refusé" ? "En attente" : "Partiel")}>{c.billetAvion.statut}</span>
                </div>
                {isOpen && (
                  <div style={S.expandDetail}>
                    {c.billetAvion.lienBillet && <div><a href={c.billetAvion.lienBillet} target="_blank" rel="noreferrer">Voir le billet</a></div>}
                    <div>Notes : {c.billetAvion.notes || "—"}</div>
                    <JumpBtn id={c.id} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}


function ClientForm({ client, catalogue, allClients, onChange, onDelete, onDuplicateAsNewStay, onJumpTo }) {
  const autresSejours = (allClients || []).filter(
    (c) => c.id !== client.id && client.telephone && c.telephone === client.telephone
  );
  const totalAcomptes = (client.paiements || []).reduce((s, p) => s + (Number(p.montant) || 0), 0);
  const soldeMontant = client.solde?.paye ? (Number(client.solde.montant) || 0) : 0;
  const totalPaye = totalAcomptes + soldeMontant;
  const sommeActivites = (client.reservations || []).reduce((s, r) => s + resaTotalMontant(r, client), 0);
  const reste = sommeActivites - totalPaye;

  const toggleInfoManquante = (item) => {
    const cur = client.infosManquantes || [];
    if (item === "Complet") { onChange({ infosManquantes: cur.includes("Complet") ? [] : ["Complet"] }); return; }
    let next = cur.filter((i) => i !== "Complet");
    next = next.includes(item) ? next.filter((i) => i !== item) : [...next, item];
    onChange({ infosManquantes: next });
  };

  const setReservations = (resas) => onChange({ reservations: resas });
  const addResa = () => setReservations([...(client.reservations || []), EMPTY_RESA()]);
  const updateResa = (id, patch) => setReservations(client.reservations.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const deleteResa = (id) => setReservations(client.reservations.filter((r) => r.id !== id));

  const setPaiements = (p) => onChange({ paiements: p });
  const addPaiement = () => setPaiements([...(client.paiements || []), EMPTY_PAIEMENT()]);
  const updatePaiement = (id, patch) => setPaiements(client.paiements.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const deletePaiement = (id) => setPaiements(client.paiements.filter((p) => p.id !== id));
  const updateSolde = (patch) => onChange({ solde: { ...client.solde, ...patch } });

  const setRemboursements = (r) => onChange({ remboursements: r });
  const addRemboursement = () => setRemboursements([...(client.remboursements || []), EMPTY_REMBOURSEMENT()]);
  const updateRemboursement = (id, patch) => setRemboursements(client.remboursements.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const deleteRemboursement = (id) => setRemboursements(client.remboursements.filter((r) => r.id !== id));

  const [verifNom, setVerifNom] = useState("");
  const addVerification = () => {
    if (!verifNom.trim()) return;
    const entry = { id: "v" + Date.now(), nom: verifNom.trim(), date: new Date().toISOString().slice(0, 10) };
    onChange({ verifications: [entry, ...(client.verifications || [])] });
    setVerifNom("");
  };

  const copyBlock = `Name : ${client.nom || "—"}\n${client.adultes || 0} adults\nHotel : ${client.hotel || "—"}\nRoom Number : ${client.chambre || "—"}\nWhat's app : ${client.telephone || "—"}`;
  const [copied, setCopied] = useState(false);
  const doCopy = async () => {
    try { await navigator.clipboard.writeText(copyBlock); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch (e) {}
  };

  const STEPS = ["Contact", "Séjour", "Billet d'avion", "Activités", "Paiements", "Suivi"];
  const [step, setStep] = useState(0);

  return (
    <div>
      <div style={S.detailHead}>
        <input style={S.nameInput} placeholder="Nom du client" value={client.nom} onChange={(e) => onChange({ nom: e.target.value })} />
        <button style={S.deleteBtn} onClick={onDelete}>Supprimer ce client</button>
      </div>

      {(client.reservations || []).some((r) => r.infoImportante) && (
        <div style={S.globalAlert}>⚠ Une ou plusieurs activités ont une information importante — voir plus bas.</div>
      )}

      {autresSejours.length > 0 && (
        <div style={S.returningAlert}>
          <span>🔁 Ce client est déjà venu — {autresSejours.length} autre(s) séjour(s) enregistré(s) :</span>
          <div style={S.chipRow}>
            {autresSejours.map((c) => (
              <button key={c.id} style={S.linkChip} onClick={() => onJumpTo(c.id)}>{c.nom || "Sans nom"} — {fmtDate(c.dateDebut)}</button>
            ))}
          </div>
        </div>
      )}
      <button style={S.smallAddBtn} onClick={() => onDuplicateAsNewStay(client)}>+ Nouveau séjour pour ce même client</button>

      <div style={S.stepperRow}>
        {STEPS.map((label, i) => (
          <button key={label} style={i === step ? S.stepPillActive : S.stepPill} onClick={() => setStep(i)}>{i + 1}. {label}</button>
        ))}
      </div>

      {step === 0 && (
      <div style={S.section}>
        <h3 style={S.sectionTitle}>Contact</h3>

        <PropRow icon="◈" label="Statut">
          <select className="plain-select" style={S.plainInput} value={client.statut} onChange={(e) => onChange({ statut: e.target.value })}>{STATUTS.map((s) => <option key={s}>{s}</option>)}</select>
        </PropRow>
        <PropRow icon="✆" label="Contact via">
          <select className="plain-select" style={S.plainInput} value={client.canal} onChange={(e) => onChange({ canal: e.target.value })}>{CANAUX.map((c) => <option key={c}>{c}</option>)}</select>
        </PropRow>
        {(client.canal === "Instagram" || client.canal === "TikTok") && (
          <PropRow icon="@" label={`Pseudo ${client.canal}`}><input className="plain-input" style={S.plainInput} value={client.pseudoContact} onChange={(e) => onChange({ pseudoContact: e.target.value })} /></PropRow>
        )}
        {client.canal === "Autre" && (
          <PropRow icon="@" label="Préciser le canal"><input className="plain-input" style={S.plainInput} value={client.canalAutre} onChange={(e) => onChange({ canalAutre: e.target.value })} /></PropRow>
        )}
        <PropRow icon="◆" label="Relation grâce à">
          <select className="plain-select" style={S.plainInput} value={client.relationGraceA} onChange={(e) => onChange({ relationGraceA: e.target.value })}>{RELATIONS.map((r) => <option key={r}>{r}</option>)}</select>
        </PropRow>
        {client.relationGraceA === "Autre" && (
          <PropRow icon="◆" label="Préciser la relation"><input className="plain-input" style={S.plainInput} value={client.relationAutre} onChange={(e) => onChange({ relationAutre: e.target.value })} /></PropRow>
        )}
        <PropRow icon="☎" label="Téléphone / WhatsApp"><input className="plain-input" style={S.plainInput} value={client.telephone} onChange={(e) => onChange({ telephone: e.target.value })} /></PropRow>

        <PropRow icon="☰" label="Infos manquantes">
          <div style={S.chipRow}>
            <ChipToggle label="Complet" active={(client.infosManquantes || []).includes("Complet")} onClick={() => toggleInfoManquante("Complet")} tone="ok" />
            {INFOS_MANQUANTES_OPTIONS.map((opt) => (
              <ChipToggle key={opt} label={opt} active={(client.infosManquantes || []).includes(opt)} onClick={() => toggleInfoManquante(opt)} tone="warn" />
            ))}
          </div>
          {(client.infosManquantes || []).includes("Autre") && (
            <input className="plain-input" style={{ ...S.plainInput, marginTop: 6, maxWidth: 320, border: `1px solid ${sandDark}` }} placeholder="Préciser" value={client.infoManquanteAutre} onChange={(e) => onChange({ infoManquanteAutre: e.target.value })} />
          )}
        </PropRow>

        <MoreProps>
          <PropRow icon="✉" label="Email"><input className="plain-input" style={S.plainInput} value={client.email} onChange={(e) => onChange({ email: e.target.value })} /></PropRow>
          <PropRow icon="⎘" label="Lien passeport (Drive)"><input className="plain-input" style={S.plainInput} value={client.lienPasseport} onChange={(e) => onChange({ lienPasseport: e.target.value })} /></PropRow>
        </MoreProps>
      </div>
      )}

      {step === 1 && (
      <>
      <div style={S.section}>
        <h3 style={S.sectionTitle}>Séjour</h3>

        <PropRow icon="▤" label="Dates du voyage">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input className="plain-input" type="date" style={{ ...S.plainInput, width: "auto" }} value={client.dateDebut} onChange={(e) => onChange({ dateDebut: e.target.value })} />
            <span style={{ color: inkSoft }}>→</span>
            <input className="plain-input" type="date" style={{ ...S.plainInput, width: "auto" }} value={client.dateFin} onChange={(e) => onChange({ dateFin: e.target.value })} />
          </div>
        </PropRow>
        <PropRow icon="⌂" label="Hôtel"><input className="plain-input" style={S.plainInput} value={client.hotel} onChange={(e) => onChange({ hotel: e.target.value })} /></PropRow>
        <PropRow icon="⚭" label="Voyageurs">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input className="plain-input" type="number" min="0" style={{ ...S.plainInput, width: 55 }} value={client.adultes} onChange={(e) => onChange({ adultes: e.target.value })} /><span style={{ color: inkSoft, fontSize: 13 }}>adultes</span>
            <input className="plain-input" type="number" min="0" style={{ ...S.plainInput, width: 55 }} value={client.enfants} onChange={(e) => onChange({ enfants: e.target.value })} /><span style={{ color: inkSoft, fontSize: 13 }}>enfants</span>
          </div>
        </PropRow>

        <MoreProps>
          <PropRow icon="⚿" label="N° de chambre"><input className="plain-input" style={S.plainInput} value={client.chambre} onChange={(e) => onChange({ chambre: e.target.value })} /></PropRow>
          <PropRow icon="◔" label="Âges des enfants"><input className="plain-input" style={S.plainInput} placeholder="ex. 7 et 4 ans" value={client.agesEnfants} onChange={(e) => onChange({ agesEnfants: e.target.value })} /></PropRow>
          <PropRow icon="☺" label="Noms des participants"><input className="plain-input" style={S.plainInput} placeholder="Saisie manuelle" value={client.participantNoms} onChange={(e) => onChange({ participantNoms: e.target.value })} /></PropRow>
        </MoreProps>
      </div>

      <div style={S.section}>
        <h3 style={S.sectionTitle}>Bloc pour l'équipe Égypte</h3>
        <p style={S.catalogueSub}>La date et le détail de l'activité restent à taper à la main — ce bloc ne couvre que la partie client.</p>
        <pre style={S.copyBlock}>{copyBlock}</pre>
        <button style={S.addBtn} onClick={doCopy}>{copied ? "Copié ✓" : "Copier"}</button>
      </div>
      </>
      )}

      {step === 2 && (
      <div style={S.section}>
        <div style={S.sectionHeadRow}>
          <h3 style={S.sectionTitle}>Billet d'avion</h3>
          <label style={S.checkLabel}>
            <input type="checkbox" checked={client.billetAvion?.requis || false} onChange={(e) => onChange({ billetAvion: { ...client.billetAvion, requis: e.target.checked } })} /> Ce client a un billet à gérer
          </label>
        </div>
        {client.billetAvion?.requis && (
          <>
            <PropRow icon="◷" label="Statut">
              <select className="plain-select" style={S.plainInput} value={client.billetAvion.statut} onChange={(e) => onChange({ billetAvion: { ...client.billetAvion, statut: e.target.value } })}>
                <option>En attente</option><option>Validé</option><option>Refusé</option>
              </select>
            </PropRow>
            <PropRow icon="▤" label="Date du billet"><input className="plain-input" type="date" style={S.plainInput} value={client.billetAvion.date} onChange={(e) => onChange({ billetAvion: { ...client.billetAvion, date: e.target.value } })} /></PropRow>
            <PropRow icon="⇄" label="Activité liée">
              <select className="plain-select" style={S.plainInput} value={client.billetAvion.activiteId} onChange={(e) => onChange({ billetAvion: { ...client.billetAvion, activiteId: e.target.value } })}>
                <option value="">Non liée</option>
                {(client.reservations || []).map((r) => <option key={r.id} value={r.id}>{r.nomActivite || "Activité sans nom"}</option>)}
              </select>
            </PropRow>
            <PropRow icon="€" label="Acompte billet payé">
              <select className="plain-select" style={S.plainInput} value={client.billetAvion.acomptePaye ? "Oui" : "Non"} onChange={(e) => onChange({ billetAvion: { ...client.billetAvion, acomptePaye: e.target.value === "Oui" } })}>
                <option>Non</option><option>Oui</option>
              </select>
            </PropRow>
            <PropRow icon="➤" label="Billet envoyé au client">
              <select className="plain-select" style={S.plainInput} value={client.billetAvion.billetEnvoye ? "Oui" : "Non"} onChange={(e) => onChange({ billetAvion: { ...client.billetAvion, billetEnvoye: e.target.value === "Oui" } })}>
                <option>Non</option><option>Oui</option>
              </select>
            </PropRow>
            <PropRow icon="⎘" label="Lien billet (Drive)"><input className="plain-input" style={S.plainInput} value={client.billetAvion.lienBillet} onChange={(e) => onChange({ billetAvion: { ...client.billetAvion, lienBillet: e.target.value } })} /></PropRow>
            <PropRow icon="✎" label="Notes pour Hossam"><input className="plain-input" style={S.plainInput} value={client.billetAvion.notes} onChange={(e) => onChange({ billetAvion: { ...client.billetAvion, notes: e.target.value } })} /></PropRow>
          </>
        )}
      </div>
      )}

      {step === 4 && (
      <>
      <div style={S.section}>
        <h3 style={S.sectionTitle}>Paiements</h3>
        <div style={S.resteBox}>
          Total séjour (calculé automatiquement) : <strong>{euros(sommeActivites)} €</strong>
        </div>

        <h4 style={S.subHeading}>Acompte(s) à la réservation</h4>
        {(client.paiements || []).map((p) => (
          <div key={p.id} style={S.paiementCard}>
            <div style={S.grid3}>
              <Field label="Montant (€)"><input type="number" style={S.input} value={p.montant} onChange={(e) => updatePaiement(p.id, { montant: e.target.value })} /></Field>
              <Field label="Mode"><select style={S.input} value={p.mode} onChange={(e) => updatePaiement(p.id, { mode: e.target.value })}>{MODES_PAIEMENT.map((m) => <option key={m}>{m}</option>)}</select></Field>
              <Field label="Date"><input type="date" style={S.input} value={p.date} onChange={(e) => updatePaiement(p.id, { date: e.target.value })} /></Field>
            </div>
            <button style={S.smallDeleteBtn} onClick={() => deletePaiement(p.id)}>Retirer</button>
          </div>
        ))}
        <button style={S.smallAddBtn} onClick={addPaiement}>+ Ajouter un acompte</button>

        <h4 style={S.subHeading}>Solde (un seul, pour tout le séjour)</h4>
        <div style={S.paiementCard}>
          <div style={S.grid3}>
            <Field label="Montant du solde (€)"><input type="number" style={S.input} value={client.solde?.montant} onChange={(e) => updateSolde({ montant: e.target.value })} /></Field>
            <Field label="Mode"><select style={S.input} value={client.solde?.mode} onChange={(e) => updateSolde({ mode: e.target.value })}>{MODES_PAIEMENT.map((m) => <option key={m}>{m}</option>)}</select></Field>
            <Field label="Date"><input type="date" style={S.input} value={client.solde?.date} onChange={(e) => updateSolde({ date: e.target.value })} /></Field>
            <Field label="Où est-il réglé ?">
              <select style={S.input} value={client.solde?.activiteId} onChange={(e) => updateSolde({ activiteId: e.target.value })}>
                <option value="">RDV dédié à l'hôtel</option>
                {(client.reservations || []).map((r) => <option key={r.id} value={r.id}>À l'activité — {r.nomActivite || "Activité sans nom"}</option>)}
              </select>
            </Field>
            {!client.solde?.activiteId && (
              <>
                <Field label="RDV — heure"><input style={S.input} value={client.solde?.rdvHeure} onChange={(e) => updateSolde({ rdvHeure: e.target.value })} /></Field>
                <Field label="RDV — lieu"><input style={S.input} value={client.solde?.rdvLieu} onChange={(e) => updateSolde({ rdvLieu: e.target.value })} /></Field>
                <Field label="Assigné à"><input style={S.input} value={client.solde?.assigneA} onChange={(e) => updateSolde({ assigneA: e.target.value })} /></Field>
              </>
            )}
          </div>
          <label style={{ ...S.checkLabel, marginTop: 10 }}>
            <input type="checkbox" checked={!!client.solde?.paye} onChange={(e) => updateSolde({ paye: e.target.checked })} /> Solde encaissé
          </label>
        </div>

        <div style={S.resteBox}>
          Payé : <strong>{euros(totalPaye)} €</strong> — Reste à payer : <strong>{euros(reste)} €</strong>
        </div>
      </div>
      </>
      )}

      {step === 3 && (
      <div style={S.section}>
        <div style={S.sectionHeadRow}>
          <h3 style={S.sectionTitle}>Activités réservées</h3>
          <button style={S.smallAddBtn} onClick={addResa}>+ Ajouter une activité</button>
        </div>
        {(client.reservations || []).length === 0 && <div style={S.emptyList}>Aucune activité.</div>}
        {(client.reservations || []).map((r) => (
          <ReservationCard key={r.id} r={r} client={client} catalogue={catalogue} onUpdate={(patch) => updateResa(r.id, patch)} onDelete={() => deleteResa(r.id)} onUpdateSolde={updateSolde} />
        ))}
      </div>
      )}

      {step === 5 && (
      <>
      <div style={S.section}>
        <div style={S.sectionHeadRow}>
          <h3 style={S.sectionTitle}>Remboursements</h3>
          <button style={S.smallAddBtn} onClick={addRemboursement}>+ Ajouter un remboursement</button>
        </div>
        {(client.remboursements || []).length === 0 && <div style={S.emptyList}>Aucun remboursement.</div>}
        {(client.remboursements || []).map((r) => (
          <div key={r.id} style={S.paiementCard}>
            <div style={S.grid3}>
              <Field label="Montant (€)"><input type="number" style={S.input} value={r.montant} onChange={(e) => updateRemboursement(r.id, { montant: e.target.value })} /></Field>
              <Field label="Raison"><select style={S.input} value={r.raison} onChange={(e) => updateRemboursement(r.id, { raison: e.target.value })}>{RAISONS_REMBOURSEMENT.map((x) => <option key={x}>{x}</option>)}</select></Field>
              {r.raison === "Autre" && (
                <Field label="Préciser la raison"><input style={S.input} value={r.raisonAutre} onChange={(e) => updateRemboursement(r.id, { raisonAutre: e.target.value })} /></Field>
              )}
              <Field label="Activité liée">
                <select style={S.input} value={r.activiteId} onChange={(e) => updateRemboursement(r.id, { activiteId: e.target.value })}>
                  <option value="">Non liée</option>
                  {(client.reservations || []).map((res) => <option key={res.id} value={res.id}>{res.nomActivite || "Activité sans nom"}</option>)}
                </select>
              </Field>
              <Field label="Date du problème"><input type="date" style={S.input} value={r.dateProbleme} onChange={(e) => updateRemboursement(r.id, { dateProbleme: e.target.value })} /></Field>
              <Field label="Mode de remboursement"><select style={S.input} value={r.mode} onChange={(e) => updateRemboursement(r.id, { mode: e.target.value })}>{MODES_PAIEMENT.map((m) => <option key={m}>{m}</option>)}</select></Field>
              <Field label="Fait par"><input style={S.input} value={r.par} onChange={(e) => updateRemboursement(r.id, { par: e.target.value })} /></Field>
              <Field label="Date du remboursement"><input type="date" style={S.input} value={r.dateRemboursement} onChange={(e) => updateRemboursement(r.id, { dateRemboursement: e.target.value })} /></Field>
              <Field label="Statut">
                <select style={S.input} value={r.statut} onChange={(e) => updateRemboursement(r.id, { statut: e.target.value })}>
                  <option>En attente</option><option>Effectué</option>
                </select>
              </Field>
            </div>
            <button style={S.smallDeleteBtn} onClick={() => deleteRemboursement(r.id)}>Retirer</button>
          </div>
        ))}
      </div>

      <div style={S.section}>
        <h3 style={S.sectionTitle}>Vérification du dossier</h3>
        <div style={S.resaTopRow}>
          <input style={S.input} placeholder="Votre prénom" value={verifNom} onChange={(e) => setVerifNom(e.target.value)} />
          <button style={S.smallAddBtn} onClick={addVerification}>Marquer vérifié aujourd'hui</button>
        </div>
        {(client.verifications || []).length === 0 && <div style={S.emptyList}>Pas encore vérifié.</div>}
        {(client.verifications || []).map((v) => (
          <div key={v.id} style={S.verifRow}>✓ Vérifié par <strong>{v.nom}</strong> le {fmtDate(v.date)}</div>
        ))}
      </div>

      <div style={S.section}>
        <h3 style={S.sectionTitle}>Commentaires internes</h3>
        <textarea style={S.textarea} rows={3} value={client.commentaires} onChange={(e) => onChange({ commentaires: e.target.value })} />
      </div>
      </>
      )}

      <div style={S.stepNavRow}>
        <button style={S.stepNavBtn} disabled={step === 0} onClick={() => setStep(Math.max(0, step - 1))}>← Précédent</button>
        <span style={S.stepNavLabel}>Étape {step + 1} / {STEPS.length}</span>
        <button style={S.stepNavBtn} disabled={step === STEPS.length - 1} onClick={() => setStep(Math.min(STEPS.length - 1, step + 1))}>Suivant →</button>
      </div>
    </div>
  );
}

function resaTotalMontant(r, client) {
  const nbAd = r.participantsMode === "tous" ? Number(client.adultes) || 0 : Number(r.participantsAdultes) || 0;
  const nbEnf = r.participantsMode === "tous" ? Number(client.enfants) || 0 : Number(r.participantsEnfants) || 0;
  const base = nbAd * (Number(r.puAdulte) || 0) + nbEnf * (Number(r.puEnfant) || 0);
  const optionsTotal = (r.options || []).reduce((s, o) => s + (Number(o.prix) || 0), 0);
  const transfert = r.transfertInclus ? 0 : (Number(r.transfertMontant) || 0);
  return base + optionsTotal + transfert;
}

function ReservationCard({ r, client, catalogue, onUpdate, onDelete, onUpdateSolde }) {
  const nbAd = r.participantsMode === "tous" ? Number(client.adultes) || 0 : Number(r.participantsAdultes) || 0;
  const nbEnf = r.participantsMode === "tous" ? Number(client.enfants) || 0 : Number(r.participantsEnfants) || 0;
  const total = resaTotalMontant(r, client);
  const soldeIci = client.solde && client.solde.activiteId === r.id;
  const soldeLabel = soldeIci ? (client.solde.paye ? "Payé" : "À régler") : null;

  const pickFromCatalogue = (id) => {
    const item = catalogue.find((a) => a.id === id);
    if (!item) return;
    onUpdate({
      nomActivite: item.nom, puAdulte: item.puAdulte, puEnfant: item.puEnfant,
      horaireApprox: item.horaireApprox, inclus: item.inclus, nonInclus: item.nonInclus,
      aPrevoir: item.aPrevoir, pointRdv: item.pointRdv,
    });
  };

  const addOption = () => onUpdate({ options: [...(r.options || []), { id: "o" + Date.now(), nom: "Guide francophone", prix: 0 }] });
  const updateOption = (id, patch) => onUpdate({ options: r.options.map((o) => (o.id === id ? { ...o, ...patch } : o)) });
  const removeOption = (id) => onUpdate({ options: r.options.filter((o) => o.id !== id) });

  const hasOptions = (r.options || []).length > 0;
  const hasInfo = !!r.infoImportante;

  if (!r.expanded) {
    if (r.statutResa === "Confirmée") {
      return (
        <div style={S.actCardDoneBlock} onClick={() => onUpdate({ expanded: true })}>
          <div style={S.actCardDoneTop}>
            <span style={S.doneCheck}>✓</span>
            <span style={S.actCardTitleDone}>{r.nomActivite || "Activité sans nom"}</span>
            <span style={{ flex: 1 }} />
            <span style={S.actCardTotal}>{euros(total)} €</span>
          </div>
          <p style={S.actCardMeta}>{fmtDate(r.dateDebut)}{r.pickupReel ? ` · Pick-up ${r.pickupReel}` : ""}</p>
          {(soldeIci || hasOptions || hasInfo) && (
            <div style={S.chipRow}>
              {soldeIci && <span style={S.miniBadge(soldeLabel)}>💰 Solde ici — {soldeLabel}</span>}
              {hasOptions && <span style={S.optionFlag}>⚙ {r.options.map((o) => o.nom).join(", ")}</span>}
            </div>
          )}
          {hasInfo && <div style={S.miniAlert}>⚠ {r.infoImportante}</div>}
        </div>
      );
    }
    return (
      <div style={S.actCard} onClick={() => onUpdate({ expanded: true })}>
        <p style={S.actCardTitle}>
          {r.nomActivite || "Activité sans nom"}
          {soldeIci && !client.solde.paye && <span style={S.warnIcon}> ⚠️ solde à régler ici</span>}
        </p>
        <p style={S.actCardMeta}>{fmtDate(r.dateDebut)}{r.dateFin && r.dateFin !== r.dateDebut ? ` → ${fmtDate(r.dateFin)}` : ""} · {r.moment}{r.pickupReel ? ` · Pick-up ${r.pickupReel}` : ""}</p>
        <p style={S.actCardMeta}>{r.paxOverride || `${nbAd} adultes${nbEnf ? `, ${nbEnf} enfant(s)` : ""}`}</p>
        {hasInfo && <div style={S.miniAlert}>⚠ {r.infoImportante}</div>}
        <div style={S.actCardFooter}>
          {soldeIci ? <span style={S.miniBadge(soldeLabel)}>💰 Solde ici — {soldeLabel}</span> : <span />}
          <span style={S.actCardTotal}>{euros(total)} €</span>
        </div>
        {hasOptions && <span style={S.optionFlag}>⚙ {r.options.length} option(s) ajoutée(s)</span>}
      </div>
    );
  }

  return (
    <div style={S.resaCard}>
      <div style={S.resaStatusRow}>
        {r.statutResa === "Confirmée" ? (
          <span style={S.confirmedTag}>✓ Confirmée</span>
        ) : (
          <span style={S.draftTag}>✎ Brouillon — encore en cours de remplissage</span>
        )}
        <button
          style={r.statutResa === "Confirmée" ? S.unconfirmBtn : S.confirmBtn}
          onClick={() => onUpdate({ statutResa: r.statutResa === "Confirmée" ? "Brouillon" : "Confirmée", expanded: r.statutResa === "Confirmée" })}
        >
          {r.statutResa === "Confirmée" ? "Repasser en brouillon" : "✓ Marquer comme confirmée"}
        </button>
      </div>
      <div style={S.resaTopRow}>
        <select style={S.input} onChange={(e) => e.target.value && pickFromCatalogue(e.target.value)} defaultValue="">
          <option value="">— Choisir dans le catalogue —</option>
          {catalogue.map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)}
        </select>
        <input style={S.resaName} placeholder="Nom de l'activité" value={r.nomActivite} onChange={(e) => onUpdate({ nomActivite: e.target.value })} />
        <button style={S.smallDeleteBtn} onClick={onDelete}>Retirer</button>
        <button style={S.collapseBtn} onClick={() => onUpdate({ expanded: false })}>Réduire</button>
      </div>

      {(r.options || []).length > 0 && (
        <div style={S.optionAlertBox}>⚠ Option(s) ajoutée(s) : {r.options.map((o) => o.nom).join(", ")}</div>
      )}

      <div style={S.grid3}>
        <Field label="Date début"><input type="date" style={S.input} value={r.dateDebut} onChange={(e) => onUpdate({ dateDebut: e.target.value })} /></Field>
        <Field label="Date fin (si plusieurs jours)"><input type="date" style={S.input} value={r.dateFin} onChange={(e) => onUpdate({ dateFin: e.target.value })} /></Field>
        <Field label="Moment"><select style={S.input} value={r.moment} onChange={(e) => onUpdate({ moment: e.target.value })}>{MOMENTS.map((m) => <option key={m}>{m}</option>)}</select></Field>
        <Field label="PU adulte (€)"><input type="number" style={S.input} value={r.puAdulte} onChange={(e) => onUpdate({ puAdulte: e.target.value })} /></Field>
        <Field label="PU enfant (€)"><input type="number" style={S.input} value={r.puEnfant} onChange={(e) => onUpdate({ puEnfant: e.target.value })} /></Field>
        <Field label="Coût réel (interne)"><input type="number" style={S.input} value={r.coutReel} onChange={(e) => onUpdate({ coutReel: e.target.value })} /></Field>
      </div>

      <div style={{ marginTop: 10 }}>
        <p style={S.fieldLabel}>Participants</p>
        <div style={S.chipRow}>
          <ChipToggle label={`Tous (${client.adultes} ad. + ${client.enfants} enf.)`} active={r.participantsMode === "tous"} onClick={() => onUpdate({ participantsMode: "tous" })} tone="ok" />
          <ChipToggle label="Personnalisé" active={r.participantsMode === "custom"} onClick={() => onUpdate({ participantsMode: "custom" })} tone="warn" />
        </div>
        {r.participantsMode === "custom" && (
          <div style={{ ...S.grid3, marginTop: 8 }}>
            <Field label="Adultes participants"><input type="number" style={S.input} value={r.participantsAdultes} onChange={(e) => onUpdate({ participantsAdultes: e.target.value })} /></Field>
            <Field label="Enfants participants"><input type="number" style={S.input} value={r.participantsEnfants} onChange={(e) => onUpdate({ participantsEnfants: e.target.value })} /></Field>
            <Field label="Noms"><input style={S.input} value={r.participantsNoms} onChange={(e) => onUpdate({ participantsNoms: e.target.value })} /></Field>
          </div>
        )}
        <div style={{ marginTop: 8 }}>
          <Field label="PAX affiché (optionnel — ex. « 2 participants, 1 accompagnateur »)">
            <input style={S.input} placeholder="Laisser vide pour un calcul automatique" value={r.paxOverride} onChange={(e) => onUpdate({ paxOverride: e.target.value })} />
          </Field>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <p style={S.fieldLabel}>Options</p>
        {(r.options || []).map((o) => (
          <div key={o.id} style={S.optionRow}>
            <select style={S.input} value={OPTIONS_PRESETS.includes(o.nom) ? o.nom : "Autre"} onChange={(e) => updateOption(o.id, { nom: e.target.value === "Autre" ? "" : e.target.value })}>
              {OPTIONS_PRESETS.map((p) => <option key={p}>{p}</option>)}
            </select>
            {!OPTIONS_PRESETS.includes(o.nom) && <input style={S.input} placeholder="Préciser" value={o.nom} onChange={(e) => updateOption(o.id, { nom: e.target.value })} />}
            <input type="number" style={S.input} placeholder="Prix €" value={o.prix} onChange={(e) => updateOption(o.id, { prix: e.target.value })} />
            <button style={S.smallDeleteBtn} onClick={() => removeOption(o.id)}>✕</button>
          </div>
        ))}
        <button style={S.smallAddBtn} onClick={addOption}>+ Ajouter une option</button>
      </div>

      <div style={{ marginTop: 12 }}>
        <p style={S.fieldLabel}>Transfert</p>
        <div style={S.chipRow}>
          <ChipToggle label="Transfert inclus" active={r.transfertInclus} onClick={() => onUpdate({ transfertInclus: true })} tone="ok" />
          <ChipToggle label="Taxe de transfert" active={!r.transfertInclus} onClick={() => onUpdate({ transfertInclus: false })} tone="warn" />
        </div>
        {!r.transfertInclus && (
          <div style={{ marginTop: 8, maxWidth: 200 }}>
            <Field label="Montant total (€)"><input type="number" style={S.input} value={r.transfertMontant} onChange={(e) => onUpdate({ transfertMontant: e.target.value })} /></Field>
          </div>
        )}
      </div>

      <div style={S.grid3WideLater}>
        <Field label="Horaire approximatif (client)"><input style={S.input} value={r.horaireApprox} onChange={(e) => onUpdate({ horaireApprox: e.target.value })} /></Field>
        <Field label="Pick-up réel (confirmé la veille)"><input style={S.input} placeholder="Rempli par l'employée" value={r.pickupReel} onChange={(e) => onUpdate({ pickupReel: e.target.value })} /></Field>
      </div>
      <div style={S.grid3}>
        <Field label="Point de RDV"><input style={S.input} value={r.pointRdv} onChange={(e) => onUpdate({ pointRdv: e.target.value })} /></Field>
        <Field label="Photo (lien image)"><input style={S.input} placeholder="https://..." value={r.photoUrl} onChange={(e) => onUpdate({ photoUrl: e.target.value })} /></Field>
        <Field label="Inclus"><input style={S.input} value={r.inclus} onChange={(e) => onUpdate({ inclus: e.target.value })} /></Field>
        <Field label="Non inclus"><input style={S.input} value={r.nonInclus} onChange={(e) => onUpdate({ nonInclus: e.target.value })} /></Field>
        <Field label="À prévoir"><input style={S.input} value={r.aPrevoir} onChange={(e) => onUpdate({ aPrevoir: e.target.value })} /></Field>
      </div>

      <div style={{ marginTop: 10 }}>
        <Field label="Info importante pour l'équipe (encadré visible)">
          <textarea style={S.textarea} rows={2} value={r.infoImportante} onChange={(e) => onUpdate({ infoImportante: e.target.value })} />
        </Field>
      </div>

      <div style={S.resaFooter}>
        <span>Total activité : <strong>{euros(total)} €</strong> ({nbAd} ad. + {nbEnf} enf.)</span>
        {soldeIci ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={S.miniBadge(soldeLabel)}>💰 Solde ici — {euros(client.solde.montant)} € — {soldeLabel}</span>
            <button style={client.solde.paye ? S.unconfirmBtn : S.confirmBtn} onClick={() => onUpdateSolde({ paye: !client.solde.paye })}>
              {client.solde.paye ? "Annuler" : "Marquer le solde encaissé"}
            </button>
          </div>
        ) : (
          <span style={S.hint}>Le solde du séjour n'est pas rattaché à cette activité (voir étape Paiements).</span>
        )}
      </div>
    </div>
  );
}

function ChipToggle({ label, active, onClick, tone }) {
  return <button type="button" style={S.chip(active, tone)} onClick={onClick}>{label}</button>;
}
function Field({ label, children }) {
  return <div style={S.field}><label style={S.fieldLabel}>{label}</label>{children}</div>;
}

function PropRow({ icon, label, children }) {
  return (
    <div style={S.propRow}>
      <div style={S.propLabel}><span style={S.propIcon}>{icon}</span>{label}</div>
      <div style={S.propValue}>{children}</div>
    </div>
  );
}

function MoreProps({ children }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 6 }}>
      <button style={S.moreBtn} onClick={() => setOpen(!open)}>{open ? "− Masquer" : "+ Autres propriétés"}</button>
      {open && <div>{children}</div>}
    </div>
  );
}

/* ---------------- PREVIEW ---------------- */
const FAQ_EGYPTE = [
  { q: "Quelle météo prévoir ?", a: "À Hurghada, comptez 25-32°C en journée toute l'année, avec des soirées plus fraîches en hiver. Le désert peut être frais la nuit." },
  { q: "Comment s'habiller ?", a: "Vêtements légers et respirants en journée, une veste pour les soirées et le désert. Prévoyez une tenue couvrante pour les sites religieux et Louxor." },
  { q: "Faut-il donner des pourboires ?", a: "Oui, c'est une pratique courante en Égypte pour les guides et chauffeurs. Prévoyez quelques livres égyptiennes en petites coupures." },
  { q: "Et pour internet sur place ?", a: "La plupart des hôtels ont le wifi. Une carte SIM locale est simple à acheter à l'aéroport si vous voulez du réseau en excursion." },
  { q: "Quel argent apporter ?", a: "Les distributeurs sont rares. Voyagez avec les espèces nécessaires pour vos soldes à régler sur place." },
  { q: "Que mettre dans ma valise ?", a: "Maillot de bain, crème solaire, chapeau, chaussures fermées pour les excursions désert, une pochette étanche pour la mer." },
];

function computeTrackerStep(client, totalPaye) {
  const daysToStart = daysUntil(client.dateDebut);
  const daysToEnd = daysUntil(client.dateFin);
  const confirmee = client.statut === "Client confirmé";
  const acompteRecu = totalPaye > 0;
  let current = 0;
  if (confirmee) current = 1;
  if (confirmee && acompteRecu) current = 2;
  if (daysToStart !== null && daysToStart <= 0) current = 3;
  if (daysToStart !== null && daysToStart < 0 && daysToEnd !== null && daysToEnd >= 0) current = 4;
  if (daysToEnd !== null && daysToEnd < 0) current = 5;
  return current;
}

function ClientPreview({ client, catalogue }) {
  const daysToStart = daysUntil(client.dateDebut);
  const daysToEnd = daysUntil(client.dateFin);
  let countdownNum = "", countdownLabel = "";
  if (daysToStart === null) { countdownNum = ""; }
  else if (daysToStart > 0) { countdownNum = `J-${daysToStart}`; countdownLabel = "avant le départ"; }
  else if (daysToEnd !== null && daysToEnd > 0) { countdownNum = "En Égypte"; countdownLabel = `retour dans ${daysToEnd} j`; }
  else if (daysToEnd === 0) { countdownNum = "Dernier jour"; countdownLabel = "retour aujourd'hui"; }
  else { countdownNum = "Séjour terminé"; countdownLabel = ""; }

  const totalAcomptes = (client.paiements || []).reduce((s, p) => s + (Number(p.montant) || 0), 0);
  const totalPaye = totalAcomptes + (client.solde?.paye ? (Number(client.solde.montant) || 0) : 0);
  const sortedResas = [...(client.reservations || [])].sort((a, b) => (a.dateDebut || "").localeCompare(b.dateDebut || ""));
  const total = sortedResas.reduce((s, r) => s + resaTotalMontant(r, client), 0);
  const reste = total - totalPaye;
  const pct = total > 0 ? Math.min(100, Math.round((totalPaye / total) * 100)) : 0;
  const trackerStep = computeTrackerStep(client, totalPaye);
  const steps = ["Réservation confirmée", "Acompte reçu", "Préparation", "Départ", "En Égypte", "Retour"];

  const [openPanel, setOpenPanel] = useState("sejour");
  const [search, setSearch] = useState("");
  const [interests, setInterests] = useState({});

  const bookedNames = new Set((client.reservations || []).map((r) => r.nomActivite));
  const suggestions = (catalogue || []).filter((a) => a.valide && !bookedNames.has(a.nom)).slice(0, 4);

  const filteredFaq = FAQ_EGYPTE.filter((f) => !search.trim() || (f.q + f.a).toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div style={P.wrap}>
      <div style={P.ticket}>
        <p style={P.greeting}>Bonjour {client.nom ? client.nom.split(" ")[0] : "voyageur"}</p>
        <p style={P.greetingSub}>Nous sommes ravis de vous accompagner pour votre séjour.</p>
        <div style={P.ticketGrid}>
          <div><p style={P.fieldLabel}>Dates</p><p style={P.fieldValue}>{fmtDate(client.dateDebut)} → {fmtDate(client.dateFin)}</p></div>
          <div><p style={P.fieldLabel}>Voyageurs</p><p style={P.fieldValue}>{client.adultes} ad. + {client.enfants} enf.{client.agesEnfants ? ` (${client.agesEnfants})` : ""}</p></div>
          <div><p style={P.fieldLabel}>Hôtel</p><p style={P.fieldValue}>{client.hotel || "—"}</p></div>
        </div>
        {countdownNum && <div style={P.countdown}><span style={P.countdownNum}>{countdownNum}</span>{countdownLabel && <span style={P.countdownLabel}>{countdownLabel}</span>}</div>}
      </div>

      <div style={P.tracker}>
        {steps.map((label, i) => (
          <div key={label} style={P.trackStep}>
            {i > 0 && <div style={{ ...P.trackLine, background: i <= trackerStep ? teal : sandDark }} />}
            <div style={{ ...P.trackDot, background: i < trackerStep ? teal : i === trackerStep ? gold : white, borderColor: i <= trackerStep ? (i < trackerStep ? teal : gold) : sandDark, color: i <= trackerStep ? white : inkSoft }}>
              {i < trackerStep ? "✓" : ""}
            </div>
            <span style={{ ...P.trackLabel, color: i === trackerStep ? ink : inkSoft, fontWeight: i === trackerStep ? 600 : 400 }}>{label}</span>
          </div>
        ))}
      </div>

      <NavPanel title="Mon séjour" open={openPanel === "sejour"} onToggle={() => setOpenPanel(openPanel === "sejour" ? "" : "sejour")}>
        <div style={S.chipRow}>
          <span style={S.plainChip}>{fmtDate(client.dateDebut)} → {fmtDate(client.dateFin)}</span>
          <span style={S.plainChip}>{client.adultes} adultes{client.enfants ? ` + ${client.enfants} enfants` : ""}</span>
          <span style={S.plainChip}>{client.hotel || "Hôtel ?"}</span>
        </div>
        {sortedResas.map((r) => (
          <div key={r.id} style={{ ...S.suiviRow, cursor: "default" }}>
            <span style={S.suiviRowDate}>{fmtDate(r.dateDebut)}</span>
            <span style={S.suiviRowMain}>{r.nomActivite || "Activité"}</span>
          </div>
        ))}
        {sortedResas.length === 0 && <div style={P.emptyNote}>Aucune activité programmée pour l'instant.</div>}
      </NavPanel>

      <NavPanel title="Mes paiements" open={openPanel === "paiements"} onToggle={() => setOpenPanel(openPanel === "paiements" ? "" : "paiements")}>
        <div style={P.payTotalRow}><span style={P.payTotal}>{euros(total)} €</span><span style={P.payLabel}>montant total du séjour</span></div>
        <div style={P.payBarTrack}><div style={{ ...P.payBarFill, width: pct + "%" }} /></div>
        <div style={P.payDetail}><span>{euros(totalPaye)} € déjà payés</span><span style={P.payDue}>{euros(reste)} € restants</span></div>
      </NavPanel>

      <NavPanel title="Mes activités" open={openPanel === "activites"} onToggle={() => setOpenPanel(openPanel === "activites" ? "" : "activites")}>
        {sortedResas.length === 0 && <div style={P.emptyNote}>Aucune activité programmée pour l'instant.</div>}
        {sortedResas.map((r) => (
          <div key={r.id} style={P.dayCard}>
            {r.photoUrl && <img src={r.photoUrl} alt={r.nomActivite} style={P.activityPhoto} />}
            <div style={P.dayHead}>
              <span style={P.dayDate}>{fmtDate(r.dateDebut)}{r.dateFin && r.dateFin !== r.dateDebut ? ` → ${fmtDate(r.dateFin)}` : ""}</span>
              <span style={P.dayTitle}>{r.nomActivite || "Activité"}</span>
              <span style={P.dayMoment}>{r.moment}</span>
            </div>
            <div style={P.dayBody}>
              {r.pickupReel && <div style={P.dayRow}><strong>Pick-up</strong><span>{r.pickupReel}</span></div>}
              {r.pointRdv && <div style={P.dayRow}><strong>Point de RDV</strong><span>{r.pointRdv}</span></div>}
              {r.aPrevoir && <div style={P.dayRow}><strong>À prévoir</strong><span>{r.aPrevoir}</span></div>}
              {r.inclus && <div style={P.dayRow}><strong>Inclus</strong><span>{r.inclus}</span></div>}
              {r.nonInclus && <div style={P.dayRow}><strong>Non inclus</strong><span>{r.nonInclus}</span></div>}
              {(r.options || []).length > 0 && <div style={P.dayRow}><strong>Options</strong><span>{r.options.map((o) => o.nom).join(", ")}</span></div>}
            </div>
          </div>
        ))}
      </NavPanel>

      <NavPanel title="Guide Égypte" open={openPanel === "guide"} onToggle={() => setOpenPanel(openPanel === "guide" ? "" : "guide")}>
        {FAQ_EGYPTE.map((f) => <FaqItem key={f.q} q={f.q} a={f.a} />)}
        <p style={{ ...P.emptyNote, marginTop: 8 }}>Contenu de départ à enrichir avec votre expertise terrain.</p>
      </NavPanel>

      {suggestions.length > 0 && (
        <div style={P.section}>
          <h2 style={P.h2}>Envie de plus ?</h2>
          <div style={S.cardGrid}>
            {suggestions.map((a) => (
              <div key={a.id} style={S.upsellCard}>
                <p style={S.actCardTitleDone}>{a.nom}</p>
                <p style={P.emptyNote}>{a.disponibilites || "Disponibilités sur demande"}</p>
                <span style={S.actCardTotal}>{euros(a.puAdulte)} € / pers.</span>
                <button
                  style={interests[a.id] ? S.unconfirmBtn : S.confirmBtn}
                  onClick={() => setInterests({ ...interests, [a.id]: true })}
                  disabled={!!interests[a.id]}
                >
                  {interests[a.id] ? "Intérêt enregistré ✓" : "Je suis intéressé(e)"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={P.section}>
        <h2 style={P.h2}>Besoin d'aide ?</h2>
        <div style={P.payCard}>
          <input style={{ ...S.input, marginBottom: 10 }} placeholder="Je cherche… par exemple « pourboire »" value={search} onChange={(e) => setSearch(e.target.value)} />
          {search && filteredFaq.length === 0 && <div style={P.emptyNote}>Rien trouvé dans le guide pour l'instant.</div>}
          {search && filteredFaq.map((f) => <FaqItem key={f.q} q={f.q} a={f.a} />)}
          <div style={P.helpFallback}>
            <span>Vous ne trouvez pas votre réponse ?</span>
            <a href="https://wa.me/201556221115" target="_blank" rel="noreferrer" style={P.helpLink}>Contacter ma conseillère →</a>
          </div>
        </div>
      </div>

      <div style={P.section}>
        <h2 style={P.h2}>Un souci ?</h2>
        <div style={S.cardGrid}>
          <div style={S.upsellCard}>
            <span>Je veux annuler une activité</span>
            <a href="https://wa.me/201556221115" target="_blank" rel="noreferrer" style={P.helpLink}>Voir les conditions →</a>
          </div>
          <div style={S.upsellCard}>
            <span>Je ne trouve pas mon transfert</span>
            <a href="tel:+201556221115" style={P.helpLink}>Numéro spécial transfert →</a>
          </div>
        </div>
      </div>

      <div style={P.helpFooter}>
        <div>
          <h3 style={P.helpFooterTitle}>Une autre question ?</h3>
          <p style={P.helpFooterSub}>Notre équipe vous répond directement sur WhatsApp.</p>
        </div>
        <a style={P.helpFooterBtn} href="https://wa.me/201556221115" target="_blank" rel="noreferrer">Écrire sur WhatsApp</a>
      </div>
    </div>
  );
}

function NavPanel({ title, open, onToggle, children }) {
  return (
    <div style={S.navPanel}>
      <button style={S.navHead} onClick={onToggle}>
        <span style={S.navTitle}>{title}</span>
        <span style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>⌄</span>
      </button>
      {open && <div style={S.navBody}>{children}</div>}
    </div>
  );
}

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={P.faqItem}>
      <button style={P.faqQ} onClick={() => setOpen(!open)}>
        <span>{q}</span><span>{open ? "−" : "+"}</span>
      </button>
      {open && <div style={P.faqA}>{a}</div>}
    </div>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500,600&family=Work+Sans:wght@400;500;600&family=Space+Mono:wght@400;700&display=swap');
* { box-sizing: border-box; }
input, select, textarea, button { font-family: 'Work Sans', sans-serif; }
input:focus, select:focus, textarea:focus, button:focus-visible { outline: 2px solid #0F5C56; outline-offset: 1px; }
.plain-input:focus, .plain-select:focus { background: #F2E6D2 !important; outline: none; }
.plain-input:hover, .plain-select:hover { background: #F2E6D2; }
@media (max-width: 560px) {
  .ad-topbar { flex-direction: column; align-items: stretch !important; }
  .ad-tabs { width: 100%; justify-content: stretch; }
  .ad-tabs button { flex: 1; }
  .ad-brand-sub { display: none; }
}
`;

const rust900 = "#5C2A1D", rust700 = "#8B4531", sand = "#F2E6D2", sandDark = "#E3CFA8";
const gold = "#C9973E", teal = "#0F5C56", tealDark = "#0B453F", tealBg = "#E2EFEC";
const ink = "#2A1D14", inkSoft = "#6B5A48", white = "#FFFCF6";
const warnBg = "#FBF0DD", warnText = "#8F6A26", alertBg = "#F5E1DC", alertText = "#93392A";

const S = {
  app: { fontFamily: "'Work Sans', sans-serif", color: ink, background: sand, borderRadius: 14, overflow: "hidden", border: `1px solid ${sandDark}` },
  loading: { padding: "3rem", textAlign: "center", color: inkSoft, fontSize: 14 },
  topbar: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.9rem 1.1rem", background: rust900, flexWrap: "wrap", gap: 10, position: "sticky", top: 0, zIndex: 20 },
  brand: { display: "flex", alignItems: "center", gap: 10, minWidth: 0, overflow: "hidden" },
  brandMark: { width: 30, height: 30, borderRadius: "50%", background: gold, color: rust900, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 12 },
  brandName: { fontFamily: "'Fraunces', serif", color: white, fontSize: 14, fontWeight: 600 },
  brandSub: { fontSize: 11, color: "#E9D3B8" },
  tabs: { display: "flex", gap: 6, background: "rgba(255,252,246,0.1)", padding: 4, borderRadius: 10, flexShrink: 0 },
  tab: { border: "none", background: "none", color: "#E9D3B8", fontSize: 12, fontWeight: 500, padding: "0.45rem 0.8rem", borderRadius: 8, cursor: "pointer" },
  tabActive: { border: "none", background: gold, color: rust900, fontSize: 12, fontWeight: 600, padding: "0.45rem 0.8rem", borderRadius: 8, cursor: "pointer" },
  teamLayout: { display: "flex", minHeight: 480, flexWrap: "wrap" },
  sidebar: { width: 260, borderRight: `1px solid ${sandDark}`, background: white, flexShrink: 0 },
  sidebarHead: { padding: "0.85rem", display: "flex", flexDirection: "column", gap: 8, borderBottom: `1px solid ${sand}` },
  search: { border: `1px solid ${sandDark}`, borderRadius: 8, padding: "0.5rem 0.7rem", fontSize: 13, background: sand },
  addBtn: { border: "none", background: rust700, color: white, fontWeight: 500, fontSize: 12.5, padding: "0.5rem 0.7rem", borderRadius: 8, cursor: "pointer" },
  clientList: { maxHeight: 700, overflowY: "auto" },
  emptyList: { padding: "1rem", fontSize: 12.5, color: inkSoft },
  clientItem: { display: "block", width: "100%", textAlign: "left", border: "none", borderBottom: `1px solid ${sand}`, background: "none", padding: "0.7rem 0.85rem", cursor: "pointer" },
  clientItemActive: { display: "block", width: "100%", textAlign: "left", border: "none", borderBottom: `1px solid ${sand}`, background: tealBg, padding: "0.7rem 0.85rem", cursor: "pointer" },
  clientItemName: { fontWeight: 500, fontSize: 13.5, marginBottom: 4 },
  clientItemMeta: { display: "flex", alignItems: "center", gap: 8 },
  clientItemDate: { fontFamily: "'Space Mono', monospace", fontSize: 10.5, color: inkSoft },
  badge: (statut) => ({ fontSize: 10, padding: "2px 7px", borderRadius: 100, background: statut === "Client confirmé" ? tealBg : statut === "Perdu" ? alertBg : warnBg, color: statut === "Client confirmé" ? tealDark : statut === "Perdu" ? alertText : warnText }),
  detail: { flex: 1, padding: "1.2rem 1.4rem", background: sand, minWidth: 340, maxHeight: 760, overflowY: "auto" },
  emptyDetail: { color: inkSoft, fontSize: 13.5, padding: "2rem 0" },
  detailHead: { display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" },
  nameInput: { flex: 1, fontFamily: "'Fraunces', serif", fontWeight: 500, fontSize: 18, border: "none", background: "none", borderBottom: `2px solid ${sandDark}`, padding: "0.2rem 0", color: rust900, minWidth: 180 },
  deleteBtn: { border: `1px solid ${sandDark}`, background: white, color: alertText, fontSize: 11.5, padding: "0.4rem 0.6rem", borderRadius: 8, cursor: "pointer" },
  globalAlert: { background: warnBg, color: warnText, borderRadius: 10, padding: "0.6rem 0.85rem", fontSize: 12.5, marginBottom: 12 },
  returningAlert: { background: tealBg, color: tealDark, borderRadius: 10, padding: "0.6rem 0.85rem", fontSize: 12.5, marginBottom: 12 },
  linkChip: { border: `1px solid ${teal}`, background: white, color: tealDark, fontSize: 11.5, padding: "0.3rem 0.65rem", borderRadius: 100, cursor: "pointer", marginTop: 6 },
  section: { marginTop: 20, background: white, border: `1px solid ${sandDark}`, borderRadius: 12, padding: "1rem 1.1rem" },
  sectionHeadRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  sectionTitle: { fontFamily: "'Fraunces', serif", fontWeight: 500, fontSize: 14.5, margin: "0 0 10px", color: rust900 },
  grid3: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 },
  grid3WideLater: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginTop: 12 },
  field: { display: "flex", flexDirection: "column", gap: 4 },
  fieldLabel: { fontSize: 10.5, color: inkSoft, textTransform: "uppercase", letterSpacing: 0.4 },
  propRow: { display: "flex", alignItems: "center", gap: 16, padding: "9px 2px", flexWrap: "wrap" },
  propLabel: { width: 190, flexShrink: 0, color: inkSoft, fontSize: 13.5, display: "flex", alignItems: "center", gap: 8 },
  propIcon: { width: 18, display: "inline-flex", justifyContent: "center", color: rust700, fontSize: 14 },
  propValue: { flex: 1, minWidth: 160, fontSize: 14.5, color: ink },
  plainInput: { border: "none", background: "transparent", fontSize: 14.5, color: ink, width: "100%", padding: "5px 7px", borderRadius: 6 },
  moreBtn: { border: "none", background: "none", color: tealDark, fontSize: 12.5, fontWeight: 500, cursor: "pointer", padding: "4px 2px" },
  input: { border: `1px solid ${sandDark}`, borderRadius: 7, padding: "0.4rem 0.55rem", fontSize: 12.5, background: sand, color: ink, width: "100%" },
  textarea: { border: `1px solid ${sandDark}`, borderRadius: 7, padding: "0.5rem 0.6rem", fontSize: 12.5, background: sand, color: ink, width: "100%", resize: "vertical" },
  resteBox: { marginTop: 10, fontSize: 13, color: rust900 },
  hint: { fontSize: 11.5, color: inkSoft, margin: "6px 0 10px" },
  smallAddBtn: { border: "none", background: rust700, color: white, fontWeight: 500, fontSize: 11.5, padding: "0.4rem 0.65rem", borderRadius: 7, cursor: "pointer", marginTop: 6 },
  smallDeleteBtn: { border: `1px solid ${sandDark}`, background: white, color: alertText, fontSize: 10.5, padding: "0.3rem 0.55rem", borderRadius: 7, cursor: "pointer", flexShrink: 0 },
  collapseBtn: { border: `1px solid ${sandDark}`, background: white, color: inkSoft, fontSize: 10.5, padding: "0.3rem 0.55rem", borderRadius: 7, cursor: "pointer", flexShrink: 0 },
  resaCard: { border: `1px dashed ${sandDark}`, borderRadius: 10, padding: "0.85rem", marginBottom: 10 },
  resaStatusRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10, flexWrap: "wrap" },
  confirmedTag: { fontSize: 12, fontWeight: 500, color: tealDark, background: tealBg, padding: "0.3rem 0.7rem", borderRadius: 100 },
  draftTag: { fontSize: 12, color: warnText, background: warnBg, padding: "0.3rem 0.7rem", borderRadius: 100 },
  confirmBtn: { border: "none", background: teal, color: white, fontWeight: 500, fontSize: 12, padding: "0.4rem 0.75rem", borderRadius: 8, cursor: "pointer" },
  unconfirmBtn: { border: `1px solid ${sandDark}`, background: white, color: inkSoft, fontSize: 12, padding: "0.4rem 0.75rem", borderRadius: 8, cursor: "pointer" },
  actCardDone: { display: "flex", alignItems: "center", gap: 10, background: tealBg, border: `1px solid ${teal}`, borderRadius: 10, padding: "0.6rem 0.9rem", cursor: "pointer", marginBottom: 8 },
  actCardDoneBlock: { background: tealBg, border: `1px solid ${teal}`, borderRadius: 10, padding: "0.75rem 0.9rem", cursor: "pointer", marginBottom: 8, display: "flex", flexDirection: "column", gap: 5 },
  actCardDoneTop: { display: "flex", alignItems: "center", gap: 8 },
  subHeading: { fontFamily: "'Fraunces', serif", fontWeight: 500, fontSize: 13, color: rust700, margin: "14px 0 8px" },
  doneCheck: { color: teal, fontWeight: 700, fontSize: 15 },
  actCardTitleDone: { fontFamily: "'Fraunces', serif", fontWeight: 500, fontSize: 13.5, color: rust900 },
  resaTopRow: { display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" },
  resaName: { flex: 1, border: `1px solid ${sandDark}`, borderRadius: 7, padding: "0.4rem 0.55rem", fontSize: 13, fontWeight: 500, background: sand, minWidth: 150 },
  resaSummary: { border: `1px solid ${sandDark}`, borderRadius: 10, padding: "0.75rem 0.9rem", marginBottom: 10, cursor: "pointer", background: white },
  resaSummaryTop: { display: "flex", justifyContent: "space-between", fontSize: 13.5 },
  resaSummaryMeta: { display: "flex", gap: 10, flexWrap: "wrap", fontSize: 11.5, color: inkSoft, marginTop: 6 },
  summaryTotal: { fontFamily: "'Space Mono', monospace", color: tealDark },
  miniBadge: (statut) => ({ fontSize: 10.5, padding: "1px 7px", borderRadius: 100, background: statut === "Payé" ? tealBg : statut === "Partiel" ? warnBg : alertBg, color: statut === "Payé" ? tealDark : statut === "Partiel" ? warnText : alertText }),
  optionFlag: { color: warnText, fontWeight: 500 },
  miniAlert: { marginTop: 6, fontSize: 11.5, color: alertText, background: alertBg, borderRadius: 7, padding: "0.35rem 0.6rem" },
  optionAlertBox: { background: warnBg, color: warnText, borderRadius: 8, padding: "0.5rem 0.75rem", fontSize: 12, marginBottom: 10 },
  optionRow: { display: "grid", gridTemplateColumns: "1fr 1fr 100px auto", gap: 8, marginBottom: 8, alignItems: "center" },
  chipRow: { display: "flex", gap: 6, flexWrap: "wrap" },
  chip: (active, tone) => ({
    border: `1px solid ${active ? (tone === "ok" ? teal : rust700) : sandDark}`,
    background: active ? (tone === "ok" ? tealBg : warnBg) : white,
    color: active ? (tone === "ok" ? tealDark : warnText) : inkSoft,
    fontSize: 11.5, padding: "0.35rem 0.7rem", borderRadius: 100, cursor: "pointer",
  }),
  resaFooter: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, paddingTop: 10, borderTop: `1px solid ${sand}`, fontSize: 13 },
  paiementCard: { border: `1px dashed ${sandDark}`, borderRadius: 10, padding: "0.75rem", marginBottom: 10 },
  copyBlock: { background: sand, border: `1px solid ${sandDark}`, borderRadius: 8, padding: "0.6rem 0.75rem", fontFamily: "'Space Mono', monospace", fontSize: 11.5, whiteSpace: "pre-wrap", margin: "0 0 10px" },
  previewWrap: { padding: "1.2rem 1.4rem", background: sand, maxHeight: 760, overflowY: "auto" },
  previewPicker: { display: "flex", alignItems: "center", gap: 10, marginBottom: 16 },
  previewLabel: { fontSize: 12.5, color: inkSoft },
  previewSelect: { border: `1px solid ${sandDark}`, borderRadius: 8, padding: "0.4rem 0.6rem", fontSize: 13, background: white },
  catalogueWrap: { padding: "1.2rem 1.4rem", background: sand, maxHeight: 760, overflowY: "auto" },
  catalogueHead: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, gap: 10, flexWrap: "wrap" },
  catalogueSub: { fontSize: 11.5, color: inkSoft, margin: "2px 0 0" },
  catalogueCard: { background: white, border: `1px solid ${sandDark}`, borderRadius: 12, padding: "0.9rem 1rem", marginBottom: 10 },
  suivisWrap: { padding: "1.2rem 1.4rem", background: sand, maxHeight: 760, overflowY: "auto" },
  tableWrap: { marginTop: 16 },
  suiviRow: { display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", background: white, border: `1px solid ${sandDark}`, borderRadius: 10, padding: "0.6rem 0.85rem", marginBottom: 8, fontSize: 12.5, cursor: "pointer" },
  suiviRowToday: { borderColor: gold, background: "#FFF8EA" },
  suiviRowDate: { fontFamily: "'Space Mono', monospace", fontSize: 11, color: tealDark, minWidth: 110 },
  suiviRowMain: { flex: 1, minWidth: 140 },
  checkLabel: { fontSize: 12, display: "flex", alignItems: "center", gap: 5 },
  expandableCard: { marginBottom: 8 },
  expandDetail: { background: white, border: `1px solid ${sandDark}`, borderTop: "none", borderRadius: "0 0 10px 10px", padding: "0.6rem 0.85rem", fontSize: 12, color: inkSoft, display: "flex", flexDirection: "column", gap: 4 },
  cardGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 },
  actCard: { background: white, border: `1px solid ${sandDark}`, borderRadius: 12, padding: "0.9rem 1rem", cursor: "pointer", display: "flex", flexDirection: "column", gap: 5 },
  actCardTitle: { fontFamily: "'Fraunces', serif", fontWeight: 500, fontSize: 14, margin: 0, color: rust900 },
  warnIcon: { fontFamily: "'Work Sans', sans-serif", fontWeight: 500, fontSize: 11.5, color: alertText },
  actCardMeta: { fontSize: 11, color: inkSoft, margin: 0 },
  actCardClient: { fontSize: 12.5, fontWeight: 500, margin: 0, color: tealDark },
  actCardFooter: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  actCardTotal: { fontFamily: "'Space Mono', monospace", fontSize: 12.5, color: rust900 },
  verifRow: { fontSize: 12.5, color: tealDark, padding: "0.4rem 0", borderBottom: `1px solid ${sand}` },
  stepperRow: { display: "flex", gap: 6, flexWrap: "wrap", margin: "16px 0" },
  stepPill: { border: `1px solid ${sandDark}`, background: white, color: inkSoft, fontSize: 11.5, padding: "0.4rem 0.75rem", borderRadius: 100, cursor: "pointer" },
  stepPillActive: { border: `1px solid ${rust700}`, background: rust700, color: white, fontSize: 11.5, padding: "0.4rem 0.75rem", borderRadius: 100, cursor: "pointer", fontWeight: 500 },
  stepNavRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 20, paddingTop: 14, borderTop: `1px solid ${sandDark}` },
  stepNavBtn: { border: `1px solid ${sandDark}`, background: white, color: rust900, fontSize: 12.5, fontWeight: 500, padding: "0.55rem 0.9rem", borderRadius: 9, cursor: "pointer" },
  stepNavLabel: { fontSize: 11.5, color: inkSoft },
  pinWrap: { padding: "2rem 1.4rem", display: "flex", flexDirection: "column", gap: 10, maxWidth: 260 },
  dashGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 },
  dashCard: { background: white, border: `1px solid ${sandDark}`, borderRadius: 12, padding: "0.9rem 1rem" },
  dashLabel: { fontSize: 11, color: inkSoft, textTransform: "uppercase", letterSpacing: 0.4, margin: "0 0 6px" },
  dashValue: { fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 500, margin: 0, color: rust900 },
  plainChip: { display: "inline-flex", alignItems: "center", background: sand, borderRadius: 100, padding: "0.35rem 0.75rem", fontSize: 12 },
  navPanel: { background: white, border: `1px solid ${sandDark}`, borderRadius: 12, marginBottom: 8, overflow: "hidden" },
  navHead: { display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "0.75rem 1rem", background: "none", border: "none", cursor: "pointer", fontFamily: "'Fraunces', serif", fontSize: 14, color: rust900 },
  navTitle: { fontWeight: 500 },
  navBody: { padding: "0 1rem 1rem" },
  upsellCard: { background: white, border: `1px solid ${sandDark}`, borderRadius: 12, padding: "0.9rem 1rem", display: "flex", flexDirection: "column", gap: 8 },
};

const P = {
  tracker: { display: "flex", margin: "1.5rem 0", padding: "0 4px" },
  trackStep: { flex: 1, textAlign: "center", position: "relative" },
  trackLine: { position: "absolute", top: 12, left: "-50%", right: "50%", height: 2, zIndex: 0 },
  trackDot: { width: 24, height: 24, borderRadius: "50%", border: "2px solid", margin: "0 auto 5px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, position: "relative", zIndex: 1 },
  trackLabel: { fontSize: 10, lineHeight: 1.2, display: "block" },
  helpFallback: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${sand}`, fontSize: 12.5, color: inkSoft, flexWrap: "wrap" },
  helpLink: { color: tealDark, fontWeight: 500, textDecoration: "none" },
  faqItem: { borderTop: `1px solid ${sand}` },
  faqQ: { display: "flex", justifyContent: "space-between", width: "100%", padding: "0.65rem 0", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500, color: ink, textAlign: "left" },
  faqA: { fontSize: 12.5, color: inkSoft, paddingBottom: 10 },
  activityPhoto: { width: "100%", height: 140, objectFit: "cover", display: "block", background: sand },
  helpFooter: { background: rust900, borderRadius: 16, padding: "1.3rem 1.5rem", color: white, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap", marginTop: 24 },
  helpFooterTitle: { fontFamily: "'Fraunces', serif", fontWeight: 500, fontSize: 16, margin: "0 0 3px" },
  helpFooterSub: { margin: 0, fontSize: 12.5, color: "#E9D3B8" },
  helpFooterBtn: { background: gold, color: rust900, fontWeight: 600, fontSize: 13, padding: "0.65rem 1.1rem", borderRadius: 10, textDecoration: "none", whiteSpace: "nowrap" },
  wrap: { maxWidth: 560, margin: "0 auto" },
  ticket: { background: rust900, color: white, borderRadius: 16, padding: "1.4rem 1.5rem" },
  greeting: { fontFamily: "'Fraunces', serif", fontWeight: 500, fontSize: 19, margin: "0 0 4px" },
  greetingSub: { fontSize: 12.5, color: "#E9D3B8", margin: "0 0 16px" },
  ticketGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 10 },
  fieldLabel: { fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, color: "#D8B78E", margin: "0 0 3px" },
  fieldValue: { fontFamily: "'Space Mono', monospace", fontSize: 12.5, color: white, margin: 0 },
  countdown: { marginTop: 16, display: "inline-flex", gap: 8, alignItems: "baseline", background: "rgba(255,252,246,0.1)", padding: "0.4rem 0.8rem", borderRadius: 100 },
  countdownNum: { fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 15, color: gold },
  countdownLabel: { fontSize: 11.5, color: "#E9D3B8" },
  section: { marginTop: 24 },
  h2: { fontFamily: "'Fraunces', serif", fontWeight: 500, fontSize: 17, color: rust900, margin: "0 0 10px" },
  emptyNote: { fontSize: 12.5, color: inkSoft },
  dayCard: { background: white, border: `1px solid ${sandDark}`, borderRadius: 12, marginBottom: 8, overflow: "hidden" },
  dayHead: { display: "flex", alignItems: "center", gap: 10, padding: "0.7rem 0.9rem", background: sand, flexWrap: "wrap" },
  dayDate: { fontFamily: "'Space Mono', monospace", fontSize: 11, color: tealDark, background: tealBg, borderRadius: 7, padding: "3px 7px" },
  dayTitle: { fontWeight: 500, fontSize: 13.5, flex: 1 },
  dayMoment: { fontSize: 11, color: inkSoft },
  dayBody: { padding: "0.6rem 0.9rem" },
  dayRow: { display: "flex", gap: 8, fontSize: 12, marginBottom: 5, color: inkSoft },
  payCard: { background: white, border: `1px solid ${sandDark}`, borderRadius: 12, padding: "1rem 1.1rem" },
  payTotalRow: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 },
  payTotal: { fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 500 },
  payLabel: { fontSize: 12, color: inkSoft },
  payBarTrack: { height: 7, background: sand, borderRadius: 100, overflow: "hidden", marginBottom: 10 },
  payBarFill: { height: "100%", background: teal, borderRadius: 100 },
  payDetail: { display: "flex", justifyContent: "space-between", fontSize: 12.5 },
  payDue: { color: alertText, fontWeight: 500 },
};
