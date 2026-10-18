"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { dayKey, fromParisInputValue, toParisInputValue } from "@/lib/journee";

/** Échelle de Bristol : descriptions usuelles des 7 types. */
const BRISTOL = [
  { n: 1, label: "Petites boules dures, séparées" },
  { n: 2, label: "En forme de saucisse, grumeleuse" },
  { n: 3, label: "Saucisse avec des craquelures en surface" },
  { n: 4, label: "Saucisse lisse et molle" },
  { n: 5, label: "Morceaux mous, bords nets" },
  { n: 6, label: "Morceaux floconneux, bords déchiquetés, pâteux" },
  { n: 7, label: "Entièrement liquide, sans morceau" },
];

export default function SellesForm({ initialTime }: { initialTime: string }) {
  const router = useRouter();
  const [bristol, setBristol] = useState<number | null>(null);
  const [flottent, setFlottent] = useState<boolean | null>(null);
  const [note, setNote] = useState("");
  const [time, setTime] = useState(() => toParisInputValue(new Date(initialTime)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const at = fromParisInputValue(time);
    if (!at) return setError("Heure invalide");
    if (!bristol) return setError("Choisis un type");
    setBusy(true);
    setError("");
    const res = await fetch("/api/stools", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ occurred_at: at.toISOString(), bristol, flottent, note }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error ?? `Erreur ${res.status}`);
    const key = dayKey(at);
    router.push(key === dayKey(new Date()) ? "/" : `/jour/${key}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Selles</h1>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-semibold mb-1">Type (échelle de Bristol)</legend>
        {BRISTOL.map((b) => (
          <button
            key={b.n}
            type="button"
            onClick={() => setBristol(b.n)}
            className={`rounded-lg border px-4 py-2.5 text-left text-sm flex gap-3 ${
              bristol === b.n ? "bg-accent text-white border-accent" : "border-border bg-card"
            }`}
          >
            <span className="font-semibold tabular-nums">{b.n}</span>
            <span>{b.label}</span>
          </button>
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-semibold mb-1">Flottent ?</legend>
        <div className="grid grid-cols-3 gap-2">
          {[
            { v: true, l: "Oui" },
            { v: false, l: "Non" },
            { v: null, l: "Pas vu" },
          ].map((o) => (
            <button
              key={o.l}
              type="button"
              onClick={() => setFlottent(o.v)}
              className={`rounded-lg border py-2 text-sm ${
                flottent === o.v ? "bg-accent text-white border-accent" : "border-border bg-card"
              }`}
            >
              {o.l}
            </button>
          ))}
        </div>
      </fieldset>

      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Remarque (facultatif) : collent, odeur, stress, urgence…"
        className="rounded-lg border border-border bg-card px-4 py-3 text-base"
      />

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-semibold">Heure</span>
        <input
          type="datetime-local"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="rounded-lg border border-border bg-card px-4 py-2.5 text-base"
        />
      </label>

      <button
        type="submit"
        disabled={busy || !bristol}
        className="rounded-lg bg-accent text-white py-3 font-semibold disabled:opacity-60"
      >
        {busy ? "Enregistrement…" : "Enregistrer"}
      </button>
      {error && <p className="text-sm text-danger">{error}</p>}
      <p className="text-xs text-muted">
        Données de santé : stockées dans ta base, jamais dans le code. Transmises au coach
        pour l&apos;analyse, et exportables pour ton médecin.
      </p>
    </form>
  );
}
