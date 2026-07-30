export default function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-neutral-400">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#5C2A1D]/20 border-t-[#5C2A1D]" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}
