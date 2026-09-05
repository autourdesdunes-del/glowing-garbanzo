// Icônes de la sidebar (TABS) et de "Outil en construction" — extraites de
// AppShell.tsx pour alléger ce fichier, sans changement de comportement.

export function OutilEnConstruction() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-1 text-center text-neutral-400">
      <p>Bientôt disponible.</p>
      <p>Cet outil est en cours de construction.</p>
    </div>
  );
}

export function IconHome() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
      <path d="M3 9.5 10 3l7 6.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 8.5V17h10V8.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export function IconUsers() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
      <circle cx="7.5" cy="6.5" r="2.5" />
      <path d="M2.5 16c0-2.5 2.2-4.2 5-4.2s5 1.7 5 4.2" strokeLinecap="round" />
      <circle cx="14" cy="6.5" r="2" />
      <path d="M13 11.9c1.9.3 4.5 1.6 4.5 4.1" strokeLinecap="round" />
    </svg>
  );
}
export function IconTarget() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
      <circle cx="10" cy="10" r="7" />
      <circle cx="10" cy="10" r="3.5" />
      <circle cx="10" cy="10" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}
export function IconBook() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
      <path d="M10 5.5C8.7 4.5 6.5 4 3.5 4v11c3 0 5.2.5 6.5 1.5V5.5Z" strokeLinejoin="round" />
      <path d="M10 5.5C11.3 4.5 13.5 4 16.5 4v11c-3 0-5.2.5-6.5 1.5V5.5Z" strokeLinejoin="round" />
    </svg>
  );
}
export function IconChecklist() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
      <path d="M3 5.5 4.3 6.8 7 4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.5 5.2h7" strokeLinecap="round" />
      <path d="M3 11.5 4.3 12.8 7 10" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.5 11.2h7" strokeLinecap="round" />
      <path d="M3.3 17h13.4" strokeLinecap="round" />
    </svg>
  );
}
export function IconCalendar() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
      <rect x="3" y="4.5" width="14" height="12" rx="1.5" />
      <path d="M3 8h14" />
      <path d="M6.5 3v3M13.5 3v3" strokeLinecap="round" />
    </svg>
  );
}
export function IconEye() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
      <path d="M2 10c1.8-3.3 4.8-5 8-5s6.2 1.7 8 5c-1.8 3.3-4.8 5-8 5s-6.2-1.7-8-5Z" strokeLinejoin="round" />
      <circle cx="10" cy="10" r="2.3" />
    </svg>
  );
}
export function IconShield() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
      <path d="M10 2.5 16 5v5c0 4-2.6 6.5-6 7.5-3.4-1-6-3.5-6-7.5V5l6-2.5Z" strokeLinejoin="round" />
      <path d="M7.3 9.7 9 11.4 12.7 7.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export function IconClipboard() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
      <rect x="4.5" y="4" width="11" height="13" rx="1.5" />
      <path d="M7.5 3.5h5a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-5A.5.5 0 0 1 7 5V4a.5.5 0 0 1 .5-.5Z" />
      <path d="M7.3 10.5h5.4M7.3 13.5h5.4" strokeLinecap="round" />
    </svg>
  );
}
export function IconSparkles() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
      <path d="M10 3.5 11.3 7.5 15.3 8.8 11.3 10.1 10 14.1 8.7 10.1 4.7 8.8 8.7 7.5 10 3.5Z" strokeLinejoin="round" />
      <path d="M15.5 13.5 16.1 15.1 17.7 15.7 16.1 16.3 15.5 17.9 14.9 16.3 13.3 15.7 14.9 15.1 15.5 13.5Z" strokeLinejoin="round" />
    </svg>
  );
}
export function IconHelp() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
      <circle cx="10" cy="10" r="7.5" />
      <path d="M7.8 7.8c.3-1 1.1-1.6 2.2-1.6 1.2 0 2.2.8 2.2 1.9 0 1.6-2.2 1.5-2.2 3.2" strokeLinecap="round" />
      <circle cx="10" cy="13.8" r="0.15" fill="currentColor" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}
export function IconStar() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
      <path
        d="M10 2.8 12.3 7.6 17.5 8.4 13.8 12 14.7 17.2 10 14.7 5.3 17.2 6.2 12 2.5 8.4 7.7 7.6 10 2.8Z"
        strokeLinejoin="round"
      />
    </svg>
  );
}
export function IconChart() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
      <path d="M3.5 16.5v-6M9 16.5V6M14.5 16.5v-9" strokeLinecap="round" />
      <path d="M2.5 16.5h15" strokeLinecap="round" />
    </svg>
  );
}
export function IconMenu() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
      <path d="M3 5.5h14M3 10h14M3 14.5h14" strokeLinecap="round" />
    </svg>
  );
}
