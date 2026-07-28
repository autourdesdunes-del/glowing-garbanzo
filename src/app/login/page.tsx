"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError("Email ou mot de passe incorrect.");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F2E6D2] px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl bg-white p-8 shadow-md"
      >
        <div className="mb-6 text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-[#5C2A1D] font-bold text-[#F2E6D2]">
            AD
          </div>
          <h1 className="text-lg font-semibold text-[#5C2A1D]">Autour des Dunes</h1>
          <p className="text-sm text-neutral-500">Espace interne</p>
        </div>

        <label className="mb-1 block text-sm font-medium text-neutral-700">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-[#0F5C56] focus:outline-none"
        />

        <label className="mb-1 block text-sm font-medium text-neutral-700">Mot de passe</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-[#0F5C56] focus:outline-none"
        />

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-[#0F5C56] px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Connexion…" : "Se connecter"}
        </button>
      </form>
    </div>
  );
}
