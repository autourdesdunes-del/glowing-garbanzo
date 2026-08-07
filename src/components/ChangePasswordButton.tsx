"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ChangePasswordButton() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const close = () => {
    setOpen(false);
    setPassword("");
    setPassword2("");
    setError(null);
    setSuccess(false);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Le mot de passe doit faire au moins 8 caractères.");
      return;
    }
    if (password !== password2) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError("Impossible d'enregistrer le mot de passe. Réessaie.");
      return;
    }
    setSuccess(true);
    setPassword("");
    setPassword2("");
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="appearance-none whitespace-nowrap text-xs text-[#666666] hover:text-[#171717]"
      >
        Mot de passe
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-[6px] border border-[#eaeaea] bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-heading text-lg font-semibold text-[#171717]">
                Changer mon mot de passe
              </h2>
              <button onClick={close} className="text-neutral-400 hover:text-neutral-600">
                ✕
              </button>
            </div>

            {success ? (
              <div>
                <p className="mb-4 text-sm text-[#171717]">
                  Mot de passe mis à jour ✓
                </p>
                <button
                  onClick={close}
                  className="w-full rounded-md bg-[#171717] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
                >
                  Fermer
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <label className="mb-1 block text-sm font-medium text-neutral-700">
                  Nouveau mot de passe
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input mb-3"
                />
                <label className="mb-1 block text-sm font-medium text-neutral-700">
                  Confirmer le mot de passe
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  className="input mb-3"
                />
                {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-md bg-[#171717] px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  {loading ? "Enregistrement…" : "Enregistrer"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
