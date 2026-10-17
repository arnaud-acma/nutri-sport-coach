"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

/** Import de la connaissance initiale depuis un fichier JSON local.
 *  Le fichier ne transite que vers TA base : jamais dans le dépôt Git. */
export default function ImportKnowledge() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "envoi" | "fait" | "erreur">(
    "idle"
  );
  const [message, setMessage] = useState("");

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setState("envoi");
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const res = await fetch("/api/knowledge/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(json),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Erreur ${res.status}`);
      setState("fait");
      setMessage(`${data.imported} fiche(s) importée(s).`);
      router.refresh();
    } catch (err) {
      setState("erreur");
      setMessage(err instanceof Error ? err.message : "Fichier invalide");
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4 text-sm flex flex-col gap-2">
      <h2 className="font-semibold">Importer la connaissance initiale</h2>
      <p className="text-xs text-muted">
        Charge le fichier connaissance-initiale.json fourni par Claude. Les
        fiches actuelles non vides sont archivées dans l&apos;historique avant
        remplacement.
      </p>
      <label className="rounded-lg border border-border text-center py-2.5 font-semibold cursor-pointer">
        Choisir le fichier JSON
        <input
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={onFile}
          disabled={state === "envoi"}
        />
      </label>
      {state === "fait" && <p className="text-accent">{message}</p>}
      {state === "erreur" && <p className="text-danger">{message}</p>}
    </section>
  );
}
