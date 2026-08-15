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
  return (
    <div className="flex items-center gap-2.5 py-0.5">
      {icon ? (
        <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center text-neutral-400">
          {icon}
        </span>
      ) : (
        <span className="w-4 flex-shrink-0" />
      )}
      <span className="w-36 flex-shrink-0 text-sm text-neutral-500">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
