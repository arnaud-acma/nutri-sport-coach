"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "envoi" | "envoye" | "erreur">(
    "idle"
  );
  const [message, setMessage] = useState("");
  const refus = params.get("erreur") === "non-autorise";

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setState("envoi");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
      setState("envoye");
    } catch (err) {
      setState("erreur");
      setMessage(err instanceof Error ? err.message : "Erreur inconnue");
    }
  }

  return (
    <main className="mx-auto max-w-md px-6 pt-24 flex flex-col gap-6">
      <div className="flex flex-col items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="" className="w-16 h-16 rounded-2xl" />
        <h1 className="text-xl font-semibold">Coach nutrition et sport</h1>
        <p className="text-sm text-muted text-center">
          Connexion par lien magique : entre ton adresse, clique sur le lien
          reçu par mail, c&apos;est tout.
        </p>
      </div>

      {refus && (
        <p className="text-sm text-danger text-center border border-danger rounded-lg p-3">
          Cette adresse n&apos;est pas autorisée sur cette appli.
        </p>
      )}

      {state === "envoye" ? (
        <p className="text-sm text-center border border-border bg-card rounded-lg p-4">
          Lien envoyé à <strong>{email}</strong>. Ouvre le mail sur ce
          téléphone et clique sur le lien.
        </p>
      ) : (
        <form onSubmit={sendLink} className="flex flex-col gap-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ton@email.fr"
            className="rounded-lg border border-border bg-card px-4 py-3 text-base"
            autoComplete="email"
          />
          <button
            type="submit"
            disabled={state === "envoi"}
            className="rounded-lg bg-accent text-white py-3 font-semibold disabled:opacity-60"
          >
            {state === "envoi" ? "Envoi…" : "Recevoir le lien de connexion"}
          </button>
          {state === "erreur" && (
            <p className="text-sm text-danger">
              Échec de l&apos;envoi : {message}. Vérifie que les variables
              Supabase sont configurées (voir le guide d&apos;installation).
            </p>
          )}
        </form>
      )}
    </main>
  );
}

export default function Page() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
