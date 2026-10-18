"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { SLOTS, dayKey, fromParisInputValue } from "@/lib/journee";

/** Modifier, réanalyser ou supprimer une prise (décision 15). */
export default function MealEditor({
  id,
  mealType,
  time,
  note,
  hasPhoto,
}: {
  id: string;
  mealType: string;
  time: string;
  note: string;
  hasPhoto: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [slot, setSlot] = useState(
    (SLOTS as readonly string[]).includes(mealType) ? mealType : ""
  );
  const [t, setT] = useState(time);
  const [n, setN] = useState(note);
  const [busy, setBusy] = useState<"" | "save" | "reanalyze" | "delete">("");
  const [error, setError] = useState("");

  async function save(reanalyze: boolean) {
    const at = fromParisInputValue(t);
    if (!at) return setError("Heure invalide");
    if (!slot) return setError("Choisis un créneau");
    if (reanalyze && !hasPhoto && !n.trim()) return setError("Sans photo, une note est nécessaire");
    setBusy(reanalyze ? "reanalyze" : "save");
    setError("");
    const res = await fetch(`/api/meals/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ meal_type: slot, eaten_at: at.toISOString(), note: n, reanalyze }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy("");
    if (!res.ok) return setError(data.error ?? `Erreur ${res.status}`);
    setOpen(false);
    router.refresh();
  }

  async function remove() {
    if (!confirm("Supprimer cette prise, sa photo et sa discussion ? C'est définitif.")) return;
    setBusy("delete");
    const res = await fetch(`/api/meals/${id}`, { method: "DELETE" });
    setBusy("");
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return setError(data.error ?? `Erreur ${res.status}`);
    }
    const at = fromParisInputValue(time);
    const key = at ? dayKey(at) : null;
    router.push(!key || key === dayKey(new Date()) ? "/" : `/jour/${key}`);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="self-start rounded-lg border border-border px-4 py-2 text-sm"
      >
        ✏️ Modifier, réanalyser ou supprimer
      </button>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {SLOTS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSlot(s)}
            className={`rounded-full px-3 py-1.5 text-sm border ${
              slot === s ? "bg-accent text-white border-accent" : "border-border"
            }`}
          >
            {s}
          </button>
        ))}
      </div>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-semibold">Heure de la prise</span>
        <input
          type="datetime-local"
          value={t}
          onChange={(e) => setT(e.target.value)}
          className="rounded-lg border border-border bg-background px-4 py-2.5 text-base"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-semibold">Note</span>
        <textarea
          value={n}
          onChange={(e) => setN(e.target.value)}
          rows={3}
          placeholder="Ex. : il y avait 2 càs d'huile de colza, et du pain en plus"
          className="rounded-lg border border-border bg-background px-4 py-3 text-base"
        />
      </label>
      <div className="flex flex-col gap-2">
        <button
          onClick={() => save(true)}
          disabled={Boolean(busy)}
          className="rounded-lg bg-accent text-white py-2.5 font-semibold disabled:opacity-60"
        >
          {busy === "reanalyze" ? "Réanalyse en cours…" : "Enregistrer et réanalyser"}
        </button>
        <button
          onClick={() => save(false)}
          disabled={Boolean(busy)}
          className="rounded-lg border border-border py-2.5 disabled:opacity-60"
        >
          {busy === "save" ? "Enregistrement…" : "Enregistrer sans réanalyser"}
        </button>
        <div className="flex justify-between">
          <button onClick={() => setOpen(false)} className="text-sm text-muted underline">
            Annuler
          </button>
          <button
            onClick={remove}
            disabled={Boolean(busy)}
            className="text-sm text-danger underline disabled:opacity-60"
          >
            {busy === "delete" ? "Suppression…" : "Supprimer la prise"}
          </button>
        </div>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <p className="text-xs text-muted">
        Réanalyser : le coach refait l&apos;estimation avec la photo d&apos;origine et la note
        à jour. Utile si tu précises une quantité.
      </p>
    </section>
  );
}
