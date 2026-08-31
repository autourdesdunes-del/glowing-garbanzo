export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-sm font-medium text-neutral-700">{label}</span>
      {children}
    </label>
  );
}

// Ligne compacte façon "propriété" (icône + label à gauche, valeur à
// droite, une seule ligne) — pour les champs simples des fiches client, à
// la place d'un Field empilé quand on veut gagner de la place verticale.
// Les champs eux-mêmes utilisent .input-flat (voir globals.css) pour se
// lire comme du texte au repos, à la manière d'une propriété Notion.
export function PropertyRow({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  // Sur mobile, le label fixe (w-36) + une valeur large (ex. deux champs
  // date côte à côte) ne tiennent pas sur une seule ligne — on laisse donc
  // la valeur passer sur sa propre ligne pleine largeur (flex-wrap +
  // basis-full) en dessous de l'icône/label, et on revient à la ligne
  // unique dès sm (≥640px), comme avant.
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 border-b border-[#666666]/10 py-1.5 last:border-b-0 sm:flex-nowrap sm:py-1">
      {icon ? (
        <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center text-neutral-400">
          {icon}
        </span>
      ) : (
        <span className="w-4 flex-shrink-0" />
      )}
      <span className="w-32 flex-shrink-0 text-sm text-neutral-500 sm:w-36">{label}</span>
      <div className="min-w-0 max-w-full flex-1 basis-full sm:max-w-sm sm:basis-auto">{children}</div>
    </div>
  );
}
