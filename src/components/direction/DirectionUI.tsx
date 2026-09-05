"use client";

// Petites primitives visuelles propres à l'onglet Direction — mêmes
// patterns que Metric/ActionRow/IconSvg du Tableau de bord d'accueil
// (DashboardView.tsx), répétées ici plutôt que partagées : ces deux
// fichiers ne s'importent pas l'un l'autre et le jeu d'icônes utile à la
// Direction est un sous-ensemble différent de celui de l'accueil.

function IconSvg({ path, className = "h-5 w-5" }: { path: React.ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      {path}
    </svg>
  );
}

const DIRECTION_ICONS: Record<string, React.ReactNode> = {
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
  wallet: (
    <>
      <rect x="2.5" y="5.5" width="15" height="10" rx="2" />
      <path d="M2.5 8.5h15" />
      <circle cx="14.5" cy="11.5" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  users: (
    <>
      <circle cx="7.5" cy="6.5" r="2.5" />
      <path d="M2.5 16c0-2.5 2.2-4.2 5-4.2s5 1.7 5 4.2" strokeLinecap="round" />
      <circle cx="14" cy="6.5" r="2" />
      <path d="M13 11.9c1.9.3 4.5 1.6 4.5 4.1" strokeLinecap="round" />
    </>
  ),
  target: (
    <>
      <circle cx="10" cy="10" r="7" />
      <circle cx="10" cy="10" r="3.5" />
      <circle cx="10" cy="10" r="0.8" fill="currentColor" stroke="none" />
    </>
  ),
  check: (
    <>
      <circle cx="10" cy="10" r="7.2" />
      <path d="M6.8 10.2l2.1 2.1 4.3-4.6" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
};

export function DirIcon({ name, className }: { name: keyof typeof DIRECTION_ICONS; className?: string }) {
  return <IconSvg path={DIRECTION_ICONS[name]} className={className} />;
}

// Typographique, pas de carte — même traitement que Metric côté accueil.
export function DirMetric({
  label,
  value,
  sub,
  first,
}: {
  label: string;
  value: string;
  sub?: string;
  first?: boolean;
}) {
  return (
    <div className={`flex-1 px-5 ${first ? "pl-0" : "border-l border-[#eaeaea]"}`}>
      <p className="text-[11px] font-medium text-[#666666]">{label}</p>
      <p className="mt-1.5 text-[28px] font-bold leading-none text-[#171717]">{value}</p>
      {sub && <p className="mt-1.5 text-xs text-[#666666]">{sub}</p>}
    </div>
  );
}

export function DirActionRow({
  icon,
  title,
  sub,
  count,
  onClick,
}: {
  icon: keyof typeof DIRECTION_ICONS;
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
      <DirIcon name={icon} className="h-4.5 w-4.5 flex-shrink-0 text-[#666666]" />
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
