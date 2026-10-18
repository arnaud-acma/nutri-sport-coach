"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { macroTargets } from "@/lib/journee";

interface T {
  valid_from: string;
  kcal: number;
  proteines_g: number;
  prises_min: number;
  glucides_g?: number | null;
  lipides_g?: number | null;
  fibres_g?: number | null;
  note?: string | null;
}

/** Cibles du jour datées (décision 12) : une nouvelle cible s'applique à
 *  partir de sa date ; les journées passées gardent leur cible. */
export default function TargetsForm({
  current,
  history,
  today,
  isDefault,
}: {
  current: T;
  history: T[];
  today: string;
  isDefault: boolean;
}) {
  const router = useRouter();
  const [kcal, setKcal] = useState(String(current.kcal));
  const [prot, setProt] = useState(String(current.proteines_g));
  const [prises, setPrises] = useState(String(current.prises_min));
  const [gluc, setGluc] = useState(current.glucides_g != null ? String(current.glucides_g) : "");
  const [lip, setLip] = useState(current.lipides_g != null ? String(current.lipides_g) : "");
  const [fib, setFib] = useState(current.fibres_g != null ? String(current.fibres_g) : "");
  // Aperçu du calcul automatique avec les valeurs en cours de saisie.
  const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));
  const preview = macroTargets({
    valid_from: "",
    kcal: Number(kcal) || 0,
    proteines_g: Number(prot) || 0,
    prises_min: 5,
    glucides_g: num(gluc),
    lipides_g: num(lip),
    fibres_g: num(fib),
  });
  const [from, setFrom] = useState(today);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/targets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        valid_from: from,
        kcal,
        proteines_g: prot,
        prises_min: prises,
        glucides_g: gluc,
        lipides_g: lip,
        fibres_g: fib,
        note,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg(data.error ?? `Erreur ${res.status}`);
    setMsg("Cible enregistrée.");
    setNote("");
    router.refresh();
  }

  const input = "rounded-lg border border-border bg-background px-3 py-2 text-base w-full";
  return (
    <section className="rounded-xl border border-border bg-card p-4 text-sm flex flex-col gap-3">
      <h2 className="font-semibold">Cibles du jour</h2>
      <p className="text-xs text-muted">
        En vigueur : {current.kcal} kcal, {current.proteines_g} g de protéines,{" "}
        {current.prises_min} prises ; hors score : glucides {macroTargets(current).glucides} g,
        lipides {macroTargets(current).lipides} g, fibres {macroTargets(current).fibres} g
        {isDefault ? " (valeurs provisoires de départ, jamais enregistrées)" : ` depuis le ${current.valid_from}`}.
        À recaler sur la courbe de poids après 3 à 4 semaines.
      </p>
      <form onSubmit={save} className="grid grid-cols-3 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">kcal</span>
          <input inputMode="numeric" value={kcal} onChange={(e) => setKcal(e.target.value)} className={input} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Protéines (g)</span>
          <input inputMode="numeric" value={prot} onChange={(e) => setProt(e.target.value)} className={input} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Prises</span>
          <input inputMode="numeric" value={prises} onChange={(e) => setPrises(e.target.value)} className={input} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Glucides (g)</span>
          <input inputMode="numeric" value={gluc} onChange={(e) => setGluc(e.target.value)} placeholder={`auto ${preview.glucides}`} className={input} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Lipides (g)</span>
          <input inputMode="numeric" value={lip} onChange={(e) => setLip(e.target.value)} placeholder={`auto ${preview.lipides}`} className={input} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Fibres (g)</span>
          <input inputMode="numeric" value={fib} onChange={(e) => setFib(e.target.value)} placeholder={`auto ${preview.fibres}`} className={input} />
        </label>
        <p className="col-span-3 text-xs text-muted">
          Glucides, lipides, fibres : hors score. Laissés vides, ils sont calculés
          d&apos;après la cible calorique (repères ANSES 2016 pour l&apos;adulte :
          lipides 37,5 % de l&apos;énergie, fibres 30 g, glucides = le reste).
          Repères de population générale, pas spécifiques au sport.
        </p>
        <label className="col-span-3 flex flex-col gap-1">
          <span className="text-xs text-muted">À partir du</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={input} />
        </label>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Raison (ex. : poids stable 3 semaines, +200 kcal)"
          className={`col-span-3 ${input}`}
        />
        <button
          disabled={busy}
          className="col-span-3 rounded-lg bg-accent text-white py-2.5 font-semibold disabled:opacity-60"
        >
          {busy ? "Enregistrement…" : "Enregistrer une nouvelle cible"}
        </button>
      </form>
      {msg && <p className="text-xs">{msg}</p>}
      {history.length > 0 && !isDefault && (
        <ul className="text-xs text-muted flex flex-col gap-0.5">
          {[...history].reverse().map((h) => (
            <li key={h.valid_from}>
              Depuis le {h.valid_from} : {h.kcal} kcal, {h.proteines_g} g, {h.prises_min} prises
              {h.glucides_g != null ? `, G ${h.glucides_g} g` : ""}
              {h.lipides_g != null ? `, L ${h.lipides_g} g` : ""}
              {h.fibres_g != null ? `, F ${h.fibres_g} g` : ""}
              {h.note ? ` (${h.note})` : ""}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
