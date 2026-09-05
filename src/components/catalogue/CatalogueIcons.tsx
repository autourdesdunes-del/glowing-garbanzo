// Petites icônes SVG propres aux fiches du Catalogue — extraites de
// CatalogueView.tsx pour alléger ce fichier, sans changement de comportement.

export function RowIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#fafafa] text-[#666666]">
      {children}
    </span>
  );
}

export function IconAdulte() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
      <circle cx="10" cy="6.5" r="3" />
      <path d="M4 17c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" strokeLinecap="round" />
    </svg>
  );
}
export function IconEnfant() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5">
      <circle cx="10" cy="7" r="2.4" />
      <path d="M5.5 16.5c0-2.6 2-4.3 4.5-4.3s4.5 1.7 4.5 4.3" strokeLinecap="round" />
    </svg>
  );
}
export function IconBebe() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5">
      <circle cx="10" cy="8" r="4" />
      <path d="M7.5 8.2c.4.5 1 .8 2.5.8s2.1-.3 2.5-.8" strokeLinecap="round" />
      <path d="M10 4v-.8" strokeLinecap="round" />
    </svg>
  );
}
export function IconTag() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
      <path d="M10.5 3.5H16v5.5L9 16 3.5 10.5 10.5 3.5Z" strokeLinejoin="round" />
      <circle cx="13" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
export function IconPin() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
      <path d="M10 17.5S15.5 12.4 15.5 8.3A5.5 5.5 0 0 0 4.5 8.3c0 4.1 5.5 9.2 5.5 9.2Z" strokeLinejoin="round" />
      <circle cx="10" cy="8.2" r="1.8" />
    </svg>
  );
}
export function IconCheck() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
      <path d="M4 10.5 8 14.5 16 5.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export function IconCross() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
      <path d="M5 5 15 15M15 5 5 15" strokeLinecap="round" />
    </svg>
  );
}
export function IconBag() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
      <rect x="4" y="7" width="12" height="9" rx="1.5" />
      <path d="M7 7V5.5A3 3 0 0 1 10 2.5v0a3 3 0 0 1 3 3V7" />
    </svg>
  );
}
export function IconGuide() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
      <circle cx="10" cy="6" r="2.6" />
      <path d="M4.5 17c0-3 2.4-5 5.5-5s5.5 2 5.5 5" strokeLinecap="round" />
      <path d="M4 10.5 2.5 9M16 10.5 17.5 9" strokeLinecap="round" />
    </svg>
  );
}
