"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Markdown from "@/components/Markdown";

export default function PageEditor({
  slug,
  initialContent,
}: {
  slug: string;
  initialContent: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(initialContent);
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "envoi" | "erreur">("idle");
  const [error, setError] = useState("");

  async function save() {
    setState("envoi");
    try {
      const res = await fetch("/api/knowledge/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, content_md: content, note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Erreur ${res.status}`);
      setEditing(false);
      setNote("");
      setState("idle");
      router.refresh();
    } catch (err) {
      setState("erreur");
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    }
  }

  if (!editing) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
        {content.trim() ? (
          <Markdown md={content} />
        ) : (
          <p className="text-sm text-muted">
            Fiche vide. Remplis-la ici, ou importe la connaissance initiale
            depuis Réglages.
          </p>
        )}
        <button
          onClick={() => setEditing(true)}
          className="rounded-lg border border-border py-2 text-sm font-semibold"
        >
          ✏️ Modifier
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={14}
        className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono"
      />
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Raison du changement (optionnel, gardée dans l'historique)"
        className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
      />
      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={state === "envoi"}
          className="flex-1 rounded-lg bg-accent text-white py-2.5 font-semibold disabled:opacity-60"
        >
          {state === "envoi" ? "Enregistrement…" : "Enregistrer"}
        </button>
        <button
          onClick={() => {
            setEditing(false);
            setContent(initialContent);
          }}
          className="rounded-lg border border-border px-4"
        >
          Annuler
        </button>
      </div>
      {state === "erreur" && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
