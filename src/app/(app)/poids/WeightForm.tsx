"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function WeightForm() {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [kg, setKg] = useState("");
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "envoi" | "erreur">("idle");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("envoi");
    try {
      const res = await fetch("/api/weights", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ measured_at: date, weight_kg: kg, note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Erreur ${res.status}`);
      setKg("");
      setNote("");
      setState("idle");
      router.refresh();
    } catch (err) {
      setState("erreur");
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2"
    >
      <div className="flex gap-2">
        <input
          type="date"
          value={date}
          max={today}
          onChange={(e) => setDate(e.target.value)}
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-base"
          required
        />
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          min="40"
          max="120"
          value={kg}
          onChange={(e) => setKg(e.target.value)}
          placeholder="62.5"
          className="w-28 rounded-lg border border-border bg-background px-3 py-2 text-base"
          required
        />
      </div>
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (optionnel)"
        className="rounded-lg border border-border bg-background px-3 py-2 text-base"
      />
      <button
        type="submit"
        disabled={state === "envoi"}
        className="rounded-lg bg-accent text-white py-2.5 font-semibold disabled:opacity-60"
      >
        Enregistrer la pesée
      </button>
      {state === "erreur" && <p className="text-sm text-danger">{error}</p>}
    </form>
  );
}
