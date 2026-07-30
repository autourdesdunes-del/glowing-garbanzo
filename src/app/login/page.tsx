"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [mode, setMode] = useState<"checking" | "login" | "set-password">("checking");
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const searchParams = new URLSearchParams(window.location.search);
    const linkType = hashParams.get("type") || searchParams.get("type");
    const isInviteOrRecovery = linkType === "invite" || linkType === "recovery";
    const linkError = hashParams.get("error_description") || searchParams.get("error_description");

    if (linkError) {
      setError(decodeURIComponent(linkError).replace(/\+/g, " "));
      setMode("login");
      return;
    }

    if (!isInviteOrRecovery) {
      const supabase = createClient();
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) {
          router.replace("/");
          router.refresh();
        } else {
          setMode("login");
        }
      });
      return;
    }

    // Invite/recovery link: instantiating the client triggers Supabase's
    // automatic detection of the access_token in the URL hash. React once
    // that session is established — and stop waiting after a few seconds if
    // the link turns out to be expired or already used, instead of hanging
    // on "Connexion…" forever.
    const supabase = createClient();
    let settled = false;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) return;
      settled = true;
      setMode("set-password");
    });

    const timeout = setTimeout(() => {
      if (!settled) {
        setError(
          "Ce lien d'invitation a expiré ou a déjà été utilisé. Demande un nouvel envoi depuis Supabase, puis clique dessus tout de suite après réception."
        );
        setMode("login");
      }
    }, 6000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) {
      setError("Le mot de passe doit faire au moins 8 caractères.");
      return;
    }
    if (newPassword !== newPassword2) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (error) {
      setError("Impossible d'enregistrer le mot de passe. Réessaie.");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  if (mode === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F2E6D2] px-4">
        <p className="text-sm text-neutral-500">Connexion…</p>
      </div>
    );
  }

  if (mode === "set-password") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F2E6D2] px-4">
        <form
          onSubmit={handleSetPassword}
          className="w-full max-w-sm rounded-xl bg-white p-8 shadow-md"
        >
          <div className="mb-6 text-center">
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-[#5C2A1D] font-bold text-[#F2E6D2]">
              AD
            </div>
            <h1 className="text-lg font-semibold text-[#5C2A1D]">Bienvenue !</h1>
            <p className="text-sm text-neutral-500">Choisis ton mot de passe pour finaliser ton compte</p>
          </div>

          <label className="mb-1 block text-sm font-medium text-neutral-700">
            Nouveau mot de passe
          </label>
          <input
            type="password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="mb-4 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-[#0F5C56] focus:outline-none"
          />

          <label className="mb-1 block text-sm font-medium text-neutral-700">
            Confirmer le mot de passe
          </label>
          <input
            type="password"
            required
            minLength={8}
            value={newPassword2}
            onChange={(e) => setNewPassword2(e.target.value)}
            className="mb-4 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-[#0F5C56] focus:outline-none"
          />

          {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-[#0F5C56] px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Enregistrement…" : "Valider et accéder à l'espace"}
          </button>
        </form>
      </div>
    );
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
