"use client";

import { initials } from "@/lib/dashboardFormat";

// Petits composants de présentation propres au Tableau de bord
// (DashboardView.tsx) — extraits pour alléger ce fichier, sans changement
// de comportement.

// Encre uniforme — pas de teinte hachée par client : l'encre est la
// marque, pas une palette décorative.
export function Avatar({ name, size = 34 }: { name: string; size?: number }) {
  return (
    <div
      className="flex flex-shrink-0 items-center justify-center rounded-full bg-[#171717] font-medium text-white"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials(name || "Sans nom")}
    </div>
  );
}

function IconSvg({ path, className = "h-5 w-5" }: { path: React.ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      {path}
    </svg>
  );
}

const ICONS: Record<string, React.ReactNode> = {
  users: (
    <>
      <circle cx="7.5" cy="6.5" r="2.5" />
      <path d="M2.5 16c0-2.5 2.2-4.2 5-4.2s5 1.7 5 4.2" strokeLinecap="round" />
      <circle cx="14" cy="6.5" r="2" />
      <path d="M13 11.9c1.9.3 4.5 1.6 4.5 4.1" strokeLinecap="round" />
    </>
  ),
  alert: (
    <>
      <path d="M10 3 2.5 16h15L10 3Z" strokeLinejoin="round" />
      <path d="M10 8.5v3.2" strokeLinecap="round" />
      <circle cx="10" cy="14" r="0.6" fill="currentColor" stroke="none" />
    </>
  ),
  target: (
    <>
      <circle cx="10" cy="10" r="7" />
      <circle cx="10" cy="10" r="3.5" />
      <circle cx="10" cy="10" r="0.8" fill="currentColor" stroke="none" />
    </>
  ),
  clipboard: (
    <>
      <rect x="5" y="3.5" width="10" height="14" rx="1.5" />
      <path d="M8 3.5V3a2 2 0 0 1 4 0v.5" />
      <path d="M7.5 9h5M7.5 12h5" strokeLinecap="round" />
    </>
  ),
  car: (
    <>
      <path d="M3 12.5 4.3 8a1.5 1.5 0 0 1 1.4-1h8.6a1.5 1.5 0 0 1 1.4 1l1.3 4.5" strokeLinejoin="round" />
      <rect x="2.5" y="12.5" width="15" height="3.5" rx="1.2" />
      <circle cx="6" cy="16.3" r="1.2" />
      <circle cx="14" cy="16.3" r="1.2" />
    </>
  ),
  key: (
    <>
      <circle cx="7" cy="13" r="3" />
      <path d="M9.1 10.9 16 4" strokeLinecap="round" />
      <path d="M13 7l2 2M15.2 4.8l2 2" strokeLinecap="round" />
    </>
  ),
  wallet: (
    <>
      <rect x="2.5" y="5.5" width="15" height="10" rx="2" />
      <path d="M2.5 8.5h15" />
      <circle cx="14.5" cy="11.5" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  check: (
    <>
      <circle cx="10" cy="10" r="7.2" />
      <path d="M6.8 10.2l2.1 2.1 4.3-4.6" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  wave: (
    <>
      <path
        d="M4 12c1-4 3-6 3-9M8 12c1-4 2-7 1-10M12 12c1-3 3-5 4-8"
        strokeLinecap="round"
      />
      <path d="M3 15c3 1.5 11 1.5 14 0" strokeLinecap="round" />
    </>
  ),
  star: (
    <path d="M10 2.8 12.2 7.6l5.2.6-3.9 3.6 1 5.1-4.5-2.6-4.5 2.6 1-5.1-3.9-3.6 5.2-.6L10 2.8Z" strokeLinejoin="round" />
  ),
  refresh: (
    <>
      <path d="M4 10a6 6 0 0 1 10.2-4.2L16 7.5" strokeLinecap="round" />
      <path d="M16 4v3.5h-3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 10a6 6 0 0 1-10.2 4.2L4 12.5" strokeLinecap="round" />
      <path d="M4 16v-3.5h3.5" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  plane: (
    <path
      d="M2.5 11.5 17 6l.9 1.6-6.4 4.3.9 5-1.8.6-2-4.5-3.5 2.4.2 2-1.4.4-.9-2.8-2.8-.9.4-1.4 2-.2 2.4-3.5-4.5-2Z"
      strokeLinejoin="round"
    />
  ),
  phone: (
    <path
      d="M4.5 3.5h2.7l1 3.3-1.7 1.4a10 10 0 0 0 4.3 4.3l1.4-1.7 3.3 1v2.7c0 .8-.7 1.4-1.5 1.3C8.6 15.2 4.8 11.4 4 5.9c-.1-.8.5-1.4 1.3-1.4Z"
      strokeLinejoin="round"
    />
  ),
};

export function Icon({ name, className }: { name: keyof typeof ICONS; className?: string }) {
  return <IconSvg path={ICONS[name]} className={className} />;
}

// Traitement typographique, pas de carte : pas de bordure, pas de fond,
// pas d'icône par métrique — seule la couleur d'état signale la sévérité.
export function Metric({
  label,
  value,
  sub,
  tone,
  first,
  onClick,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: "default" | "error";
  first?: boolean;
  onClick?: () => void;
}) {
  const valueClass = tone === "error" ? "text-[#EE0000]" : "text-[#171717]";
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`flex-1 px-5 text-left ${first ? "pl-0" : "border-l border-[#eaeaea]"} ${
        onClick ? "cursor-pointer hover:opacity-70" : ""
      }`}
    >
      <p className="text-[11px] font-medium text-[#666666]">{label}</p>
      <p className={`mt-1.5 text-[28px] font-bold leading-none ${valueClass}`}>{value}</p>
      {sub && <p className="mt-1.5 text-xs text-[#666666]">{sub}</p>}
    </Wrapper>
  );
}

export function ActionRow({
  icon,
  title,
  sub,
  count,
  onClick,
}: {
  icon: keyof typeof ICONS;
  title: string;
  sub: string;
  count?: number;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3.5 transition ${
        onClick ? "cursor-pointer hover:bg-[#fafafa]" : ""
      }`}
    >
      <Icon name={icon} className="h-4.5 w-4.5 flex-shrink-0 text-[#666666]" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[#171717]">{title}</p>
        <p className="text-xs text-[#666666]">{sub}</p>
      </div>
      {!!count && (
        <span className="flex flex-shrink-0 items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-semibold text-white">
          🔔 {count}
        </span>
      )}
      {onClick && (
        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-[6px] text-[#666666]">
          ›
        </span>
      )}
    </div>
  );
}

// Popup générique "coup d'œil rapide" : nom, pourquoi c'est signalé, et
// l'action à faire — réutilisée pour les 4 métriques cliquables du
// tableau de bord (Cas urgents, Prospects à relancer, Dossiers incomplets,
// Pick-ups manquants) pour éviter 4 popups copiés-collés.
export function InfoListModal({
  title,
  rows,
  onClose,
}: {
  title: string;
  rows: {
    key: string;
    name: string;
    reason: string;
    actionLabel: string;
    onAction: () => void;
  }[];
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-lg border border-neutral-200 bg-white p-5 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-heading text-base font-semibold text-[#171717]">
            {title} ({rows.length})
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-[#171717]"
          >
            ✕
          </button>
        </div>
        <div className="mt-3 space-y-2">
          {rows.length === 0 && (
            <p className="text-sm text-neutral-500">Rien à signaler.</p>
          )}
          {rows.map((row) => (
            <div key={row.key} className="rounded-md border border-neutral-100 px-3 py-2 text-sm">
              <p className="font-medium text-[#171717]">{row.name}</p>
              <p className="mt-0.5 text-xs text-neutral-500">{row.reason}</p>
              <button
                type="button"
                onClick={row.onAction}
                className="mt-1.5 text-xs font-medium text-[#0F5C56] hover:underline"
              >
                {row.actionLabel} →
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
