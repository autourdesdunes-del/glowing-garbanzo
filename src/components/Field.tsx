export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-sm font-medium text-neutral-700">{label}</span>
      {children}
    </label>
  );
}
