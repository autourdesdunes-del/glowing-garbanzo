"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CatalogueItem, Client, Paiement, Reservation, ReservationOption } from "@/lib/types";
import { resaTotalMontant } from "@/lib/resa";

function euros(n: number) {
  return (Number(n) || 0).toLocaleString("fr-FR");
}
function fmtDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
function daysUntil(dateStr: string | null) {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / 86400000);
}

function computeTrackerStep(client: Client, totalPaye: number) {
  const daysToStart = daysUntil(client.date_debut);
  const daysToEnd = daysUntil(client.date_fin);
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

const FAQ_EGYPTE = [
  {
    q: "Quelle météo prévoir ?",
    a: "À Hurghada, comptez 25-32°C en journée toute l'année, avec des soirées plus fraîches en hiver. Le désert peut être frais la nuit.",
  },
  {
    q: "Comment s'habiller ?",
    a: "Vêtements légers et respirants en journée, une veste pour les soirées et le désert. Prévoyez une tenue couvrante pour les sites religieux et Louxor.",
  },
  {
    q: "Faut-il donner des pourboires ?",
    a: "Oui, c'est une pratique courante en Égypte pour les guides et chauffeurs. Prévoyez quelques livres égyptiennes en petites coupures.",
  },
  {
    q: "Et pour internet sur place ?",
    a: "La plupart des hôtels ont le wifi. Une carte SIM locale est simple à acheter à l'aéroport si vous voulez du réseau en excursion.",
  },
  {
    q: "Quel argent apporter ?",
    a: "Les distributeurs sont rares. Voyagez avec les espèces nécessaires pour vos soldes à régler sur place.",
  },
  {
    q: "Que mettre dans ma valise ?",
    a: "Maillot de bain, crème solaire, chapeau, chaussures fermées pour les excursions désert, une pochette étanche pour la mer.",
  },
];

function NavPanel({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3 overflow-hidden rounded-md border border-[#8B4531]/20 bg-white">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="font-heading font-semibold text-[#5C2A1D]">{title}</span>
        <span className={`transition-transform ${open ? "rotate-180" : ""}`}>⌄</span>
      </button>
      {open && <div className="border-t border-[#8B4531]/10 px-4 py-3">{children}</div>}
    </div>
  );
}

function ActivityPhoto({ path, alt }: { path: string; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.storage
      .from("activity-photos")
      .createSignedUrl(path, 3600)
      .then(({ data }) => setUrl(data?.signedUrl ?? null));
  }, [path]);

  if (!url) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className="mb-2 h-32 w-full rounded-md object-cover" />;
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-neutral-100 py-2 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between text-left text-sm font-medium text-[#5C2A1D]"
      >
        <span>{q}</span>
        <span>{open ? "−" : "+"}</span>
      </button>
      {open && <div className="mt-1 text-sm text-neutral-600">{a}</div>}
    </div>
  );
}

export default function ClientPreviewView({
  client,
  catalogue,
}: {
  client: Client;
  catalogue: CatalogueItem[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [resaOptions, setResaOptions] = useState<Record<string, ReservationOption[]>>({});
  const [paiements, setPaiements] = useState<Paiement[]>([]);
  const [openPanel, setOpenPanel] = useState("sejour");
  const [search, setSearch] = useState("");
  const [interests, setInterests] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      const [{ data: resas }, { data: pays }] = await Promise.all([
        supabase.from("reservations").select("*").eq("client_id", client.id),
        supabase.from("paiements").select("*").eq("client_id", client.id),
      ]);
      const list = (resas as Reservation[]) || [];
      setReservations(list);
      setPaiements((pays as Paiement[]) || []);
      if (list.length) {
        const { data: opts } = await supabase
          .from("reservation_options")
          .select("*")
          .in(
            "reservation_id",
            list.map((r) => r.id)
          );
        const grouped: Record<string, ReservationOption[]> = {};
        ((opts as ReservationOption[]) || []).forEach((o) => {
          grouped[o.reservation_id] = [...(grouped[o.reservation_id] || []), o];
        });
        setResaOptions(grouped);
      } else {
        setResaOptions({});
      }
    })();
  }, [client.id, supabase]);

  const daysToStart = daysUntil(client.date_debut);
  const daysToEnd = daysUntil(client.date_fin);
  let countdownNum = "";
  let countdownLabel = "";
  if (daysToStart === null) countdownNum = "";
  else if (daysToStart > 0) {
    countdownNum = `J-${daysToStart}`;
    countdownLabel = "avant le départ";
  } else if (daysToEnd !== null && daysToEnd > 0) {
    countdownNum = "En Égypte";
    countdownLabel = `retour dans ${daysToEnd} j`;
  } else if (daysToEnd === 0) {
    countdownNum = "Dernier jour";
    countdownLabel = "retour aujourd'hui";
  } else {
    countdownNum = "Séjour terminé";
  }

  const totalAcomptes = paiements.reduce((s, p) => s + (Number(p.montant) || 0), 0);
  const totalPaye = totalAcomptes + (client.solde_paye ? Number(client.solde_montant) || 0 : 0);
  const sortedResas = [...reservations].sort((a, b) =>
    (a.date_debut || "").localeCompare(b.date_debut || "")
  );
  const total = sortedResas.reduce(
    (s, r) => s + resaTotalMontant(r, client, resaOptions[r.id] || []),
    0
  );
  const reste = total - totalPaye;
  const pct = total > 0 ? Math.min(100, Math.round((totalPaye / total) * 100)) : 0;
  const trackerStep = computeTrackerStep(client, totalPaye);
  const steps = [
    "Réservation confirmée",
    "Acompte reçu",
    "Préparation",
    "Départ",
    "En Égypte",
    "Retour",
  ];

  const bookedNames = new Set(reservations.map((r) => r.nom_activite));
  const suggestions = catalogue.filter((a) => a.valide && !bookedNames.has(a.nom)).slice(0, 4);

  const filteredFaq = FAQ_EGYPTE.filter(
    (f) => !search.trim() || (f.q + f.a).toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <div className="mx-auto max-w-xl space-y-4 p-6">
      <div className="rounded-xl border border-[#8B4531]/20 bg-white p-5">
        <p className="font-heading text-lg font-semibold text-[#5C2A1D]">
          Bonjour {client.nom ? client.nom.split(" ")[0] : "voyageur"}
        </p>
        <p className="text-sm text-neutral-500">
          Nous sommes ravis de vous accompagner pour votre séjour.
        </p>
        <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-xs text-neutral-400">Dates</p>
            <p className="font-medium text-[#5C2A1D]">
              {fmtDate(client.date_debut)} → {fmtDate(client.date_fin)}
            </p>
          </div>
          <div>
            <p className="text-xs text-neutral-400">Voyageurs</p>
            <p className="font-medium text-[#5C2A1D]">
              {client.adultes} ad. + {client.enfants} enf.
              {client.ages_enfants ? ` (${client.ages_enfants})` : ""}
            </p>
          </div>
          <div>
            <p className="text-xs text-neutral-400">Hôtel</p>
            <p className="font-medium text-[#5C2A1D]">{client.hotel || "—"}</p>
          </div>
        </div>
        {countdownNum && (
          <div className="mt-3 rounded-md bg-[#F2E6D2] px-3 py-2 text-center">
            <span className="font-heading block text-lg font-semibold text-[#5C2A1D]">
              {countdownNum}
            </span>
            {countdownLabel && (
              <span className="text-xs text-neutral-500">{countdownLabel}</span>
            )}
          </div>
        )}
      </div>

      <div className="flex items-start justify-between rounded-md bg-white p-4">
        {steps.map((label, i) => (
          <div key={label} className="flex flex-1 flex-col items-center text-center">
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs ${
                i < trackerStep
                  ? "border-[#0F5C56] bg-[#0F5C56] text-white"
                  : i === trackerStep
                    ? "border-[#C9973E] bg-[#C9973E] text-white"
                    : "border-neutral-300 bg-white text-neutral-400"
              }`}
            >
              {i < trackerStep ? "✓" : ""}
            </div>
            <span
              className={`mt-1 text-[10px] ${
                i === trackerStep ? "font-semibold text-[#5C2A1D]" : "text-neutral-400"
              }`}
            >
              {label}
            </span>
          </div>
        ))}
      </div>

      <NavPanel
        title="Mon séjour"
        open={openPanel === "sejour"}
        onToggle={() => setOpenPanel(openPanel === "sejour" ? "" : "sejour")}
      >
        <div className="mb-2 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-[#F2E6D2] px-2 py-1">
            {fmtDate(client.date_debut)} → {fmtDate(client.date_fin)}
          </span>
          <span className="rounded-full bg-[#F2E6D2] px-2 py-1">
            {client.adultes} adultes{client.enfants ? ` + ${client.enfants} enfants` : ""}
          </span>
          <span className="rounded-full bg-[#F2E6D2] px-2 py-1">{client.hotel || "Hôtel ?"}</span>
        </div>
        {sortedResas.map((r) => (
          <div key={r.id} className="flex justify-between py-1 text-sm">
            <span className="font-amounts text-neutral-500">{fmtDate(r.date_debut)}</span>
            <span>{r.nom_activite || "Activité"}</span>
          </div>
        ))}
        {sortedResas.length === 0 && (
          <div className="text-sm text-neutral-400">
            Aucune activité programmée pour l&apos;instant.
          </div>
        )}
      </NavPanel>

      <NavPanel
        title="Mes paiements"
        open={openPanel === "paiements"}
        onToggle={() => setOpenPanel(openPanel === "paiements" ? "" : "paiements")}
      >
        <div className="flex items-baseline justify-between">
          <span className="font-amounts text-lg font-semibold text-[#5C2A1D]">
            {euros(total)} €
          </span>
          <span className="text-xs text-neutral-500">montant total du séjour</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-100">
          <div className="h-full bg-[#0F5C56]" style={{ width: pct + "%" }} />
        </div>
        <div className="mt-1 flex justify-between text-xs text-neutral-500">
          <span>{euros(totalPaye)} € déjà payés</span>
          <span className="text-[#C9973E]">{euros(reste)} € restants</span>
        </div>
      </NavPanel>

      <NavPanel
        title="Mes activités"
        open={openPanel === "activites"}
        onToggle={() => setOpenPanel(openPanel === "activites" ? "" : "activites")}
      >
        {sortedResas.length === 0 && (
          <div className="text-sm text-neutral-400">
            Aucune activité programmée pour l&apos;instant.
          </div>
        )}
        {sortedResas.map((r) => (
          <div key={r.id} className="mb-3 rounded-md border border-neutral-100 p-3 last:mb-0">
            {r.photo_path && <ActivityPhoto path={r.photo_path} alt={r.nom_activite} />}
            <div className="flex items-center justify-between text-sm">
              <span className="font-amounts text-neutral-500">
                {fmtDate(r.date_debut)}
                {r.date_fin && r.date_fin !== r.date_debut ? ` → ${fmtDate(r.date_fin)}` : ""}
              </span>
              <span className="font-medium text-[#5C2A1D]">{r.nom_activite || "Activité"}</span>
              <span className="text-xs text-neutral-500">{r.moment}</span>
            </div>
            <div className="mt-2 space-y-1 text-xs text-neutral-600">
              {r.pickup_reel && (
                <div>
                  <strong>Pick-up</strong> — {r.pickup_reel}
                </div>
              )}
              {r.point_rdv && (
                <div>
                  <strong>Point de RDV</strong> — {r.point_rdv}
                </div>
              )}
              {r.a_prevoir && (
                <div>
                  <strong>À prévoir</strong> — {r.a_prevoir}
                </div>
              )}
              {r.inclus && (
                <div>
                  <strong>Inclus</strong> — {r.inclus}
                </div>
              )}
              {r.non_inclus && (
                <div>
                  <strong>Non inclus</strong> — {r.non_inclus}
                </div>
              )}
              {(resaOptions[r.id] || []).length > 0 && (
                <div>
                  <strong>Options</strong> —{" "}
                  {(resaOptions[r.id] || []).map((o) => o.nom).join(", ")}
                </div>
              )}
            </div>
          </div>
        ))}
      </NavPanel>

      <NavPanel
        title="Guide Égypte"
        open={openPanel === "guide"}
        onToggle={() => setOpenPanel(openPanel === "guide" ? "" : "guide")}
      >
        {FAQ_EGYPTE.map((f) => (
          <FaqItem key={f.q} q={f.q} a={f.a} />
        ))}
        <p className="mt-2 text-xs text-neutral-400">
          Contenu de départ à enrichir avec votre expertise terrain.
        </p>
      </NavPanel>

      {suggestions.length > 0 && (
        <div>
          <h2 className="font-heading mb-2 text-lg font-semibold text-[#5C2A1D]">
            Envie de plus ?
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {suggestions.map((a) => (
              <div key={a.id} className="rounded-md border border-neutral-200 bg-white p-3">
                <p className="text-sm font-medium text-[#5C2A1D]">{a.nom}</p>
                <p className="text-xs text-neutral-400">
                  {a.disponibilites || "Disponibilités sur demande"}
                </p>
                <p className="font-amounts mt-1 text-sm">{euros(a.pu_adulte)} € / pers.</p>
                <button
                  disabled={!!interests[a.id]}
                  onClick={() => setInterests({ ...interests, [a.id]: true })}
                  className="mt-2 w-full rounded-md bg-[#0F5C56] px-2 py-1 text-xs text-white disabled:opacity-50"
                >
                  {interests[a.id] ? "Intérêt enregistré ✓" : "Je suis intéressé(e)"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="font-heading mb-2 text-lg font-semibold text-[#5C2A1D]">
          Besoin d&apos;aide ?
        </h2>
        <div className="rounded-md bg-white p-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Je cherche… par exemple « pourboire »"
            className="input mb-2 w-full"
          />
          {search && filteredFaq.length === 0 && (
            <div className="text-sm text-neutral-400">
              Rien trouvé dans le guide pour l&apos;instant.
            </div>
          )}
          {search && filteredFaq.map((f) => <FaqItem key={f.q} q={f.q} a={f.a} />)}
          <div className="mt-2 flex items-center justify-between border-t border-neutral-100 pt-2 text-sm">
            <span className="text-neutral-500">Vous ne trouvez pas votre réponse ?</span>
            <a
              href="https://wa.me/201556221115"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-[#0F5C56]"
            >
              Contacter ma conseillère →
            </a>
          </div>
        </div>
      </div>

      <div>
        <h2 className="font-heading mb-2 text-lg font-semibold text-[#5C2A1D]">Un souci ?</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md border border-neutral-200 bg-white p-3 text-sm">
            <span>Je veux annuler une activité</span>
            <a
              href="https://wa.me/201556221115"
              target="_blank"
              rel="noreferrer"
              className="mt-1 block font-medium text-[#0F5C56]"
            >
              Voir les conditions →
            </a>
          </div>
          <div className="rounded-md border border-neutral-200 bg-white p-3 text-sm">
            <span>Je ne trouve pas mon transfert</span>
            <a href="tel:+201556221115" className="mt-1 block font-medium text-[#0F5C56]">
              Numéro spécial transfert →
            </a>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-md bg-[#5C2A1D] p-4 text-white">
        <div>
          <h3 className="font-heading font-semibold">Une autre question ?</h3>
          <p className="text-xs text-white/80">
            Notre équipe vous répond directement sur WhatsApp.
          </p>
        </div>
        <a
          href="https://wa.me/201556221115"
          target="_blank"
          rel="noreferrer"
          className="rounded-md bg-[#C9973E] px-3 py-2 text-sm font-medium"
        >
          Écrire sur WhatsApp
        </a>
      </div>
    </div>
  );
}
