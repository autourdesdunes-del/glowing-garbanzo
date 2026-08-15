export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-sm font-medium text-neutral-700">{label}</span>
      {children}
    </label>
  );
}

// Ligne compacte façon "propriété" (label à gauche, valeur à droite, une
// seule ligne) — pour les champs simples des fiches client, à la place
// d'un Field empilé quand on veut gagner de la place verticale.
export function PropertyRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-0.5">
      <span className="w-40 flex-shrink-0 text-sm text-neutral-500">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
