"use client";

// Le transfert aéroport au Caire n'est normalement plus vendu (voir HELP) —
// avant de laisser l'ajouter, on avertit et on demande de vérifier avec
// Hossam ou de le vendre à 30€ minimum (au lieu des 20€ catalogue).
export default function CaireAeroportAlert({
  onProceedAnyway,
  onCancel,
}: {
  onProceedAnyway: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg border-2 border-red-600 bg-white p-5 shadow-xl">
        <h2 className="font-heading text-base font-semibold text-red-600">Transfert aéroport - Le Caire</h2>
        <p className="mt-2 text-sm text-[#171717]">
          Normalement, on ne vend plus ce transfert. Vérifie avec Hossam avant de continuer — ou, si tu le
          vends quand même, ce doit être à 30€ minimum (pas 20€).
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={onProceedAnyway}
            className="w-full rounded-md border border-red-600 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Continuer quand même
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="w-full rounded-md border border-[#eaeaea] px-3 py-2 text-sm text-[#666666] hover:bg-[#fafafa]"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
