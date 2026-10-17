"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Markdown from "@/components/Markdown";

const MEAL_TYPES = [
  "petit-déjeuner",
  "déjeuner",
  "goûter",
  "dîner",
  "collation",
] as const;

interface Feedback {
  verdict: string;
  resume: string;
  ajouts: string[];
  commentaire: string;
  model: string;
}

export default function NouveauRepas() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [mealType, setMealType] = useState<string>("déjeuner");
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "envoi" | "fait" | "erreur">(
    "idle"
  );
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  function onFile(f: File | null) {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("envoi");
    setError("");
    try {
      const fd = new FormData();
      if (file) fd.append("photo", file);
      fd.append("meal_type", mealType);
      fd.append("note", note);
      const res = await fetch("/api/meals", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Erreur ${res.status}`);
      setFeedback(data.feedback);
      setState("fait");
    } catch (err) {
      setState("erreur");
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    }
  }

  if (state === "fait" && feedback) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-bold">
          {feedback.verdict === "valide"
            ? "✅ Repas validé"
            : feedback.verdict === "simule"
              ? "🧪 Réponse simulée"
              : "➕ À compléter"}
        </h1>
        <p className="text-sm">{feedback.resume}</p>
        {feedback.ajouts.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="font-semibold text-sm mb-1">Le coach te demande d&apos;ajouter :</p>
            <ul className="list-disc pl-5 text-sm">
              {feedback.ajouts.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="rounded-xl border border-border bg-card p-4">
          <Markdown md={feedback.commentaire} />
          <p className="text-xs text-muted mt-2">Modèle : {feedback.model}</p>
        </div>
        <button
          onClick={() => router.push("/repas")}
          className="rounded-lg bg-accent text-white py-3 font-semibold"
        >
          Voir l&apos;historique
        </button>
        <button
          onClick={() => {
            setState("idle");
            setFeedback(null);
            onFile(null);
            setNote("");
          }}
          className="rounded-lg border border-border py-3"
        >
          Nouveau repas
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Nouveau repas</h1>

      <label className="rounded-xl border-2 border-dashed border-border bg-card p-4 text-center cursor-pointer">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Aperçu du repas"
            className="mx-auto max-h-60 rounded-lg object-cover"
          />
        ) : (
          <span className="text-sm text-muted">
            📷 Appuie ici pour prendre la photo de l&apos;assiette
          </span>
        )}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
      </label>

      <div className="flex flex-wrap gap-2">
        {MEAL_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setMealType(t)}
            className={`rounded-full px-3 py-1.5 text-sm border ${
              mealType === t
                ? "bg-accent text-white border-accent"
                : "border-border bg-card"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note pour le coach (optionnel) : contexte, faim, sport du jour…"
        rows={3}
        className="rounded-lg border border-border bg-card px-4 py-3 text-base"
      />

      <button
        type="submit"
        disabled={state === "envoi" || (!file && !note)}
        className="rounded-lg bg-accent text-white py-3 font-semibold disabled:opacity-60"
      >
        {state === "envoi" ? "Analyse en cours…" : "Envoyer au coach"}
      </button>
      {state === "erreur" && <p className="text-sm text-danger">{error}</p>}
      <p className="text-xs text-muted">
        Le coach juge la qualité du repas et ce qu&apos;il faut ajouter. Il ne
        compte pas les calories au gramme : une photo ne le permet pas.
      </p>
    </form>
  );
}
