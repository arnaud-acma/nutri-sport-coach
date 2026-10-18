"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Markdown from "@/components/Markdown";
import {
  SLOTS,
  dayKey,
  defaultSlotFor,
  fromParisInputValue,
  isCollation,
  parisLocalToDate,
  toParisInputValue,
} from "@/lib/journee";
import { exifToDate, readExifDate } from "@/lib/exif";

interface Feedback {
  verdict: string;
  resume: string;
  ajouts: string[];
  commentaire: string;
  kcal_min: number | null;
  kcal_max: number | null;
  prot_min: number | null;
  prot_max: number | null;
  gluc_min: number | null;
  gluc_max: number | null;
  lip_min: number | null;
  lip_max: number | null;
  fib_min: number | null;
  fib_max: number | null;
  hypotheses: string;
  model: string;
}

const range = (a: number | null, b: number | null, u: string) =>
  a == null || b == null ? "non estimé" : a === b ? `${a} ${u}` : `${a} à ${b} ${u}`;

/** Heure de prise d'une photo : EXIF si présent, sinon date du fichier si
 *  elle est plausible (plus de 2 minutes et moins de 2 jours). Null sinon.
 *  Comportement réel sur iPhone : à vérifier en test. */
async function photoTime(f: File): Promise<{ date: Date; source: string } | null> {
  try {
    const head = await f.slice(0, 256 * 1024).arrayBuffer();
    const exif = readExifDate(head);
    const d = exif ? exifToDate(exif, parisLocalToDate) : null;
    if (d && d.getTime() <= Date.now() + 60000) return { date: d, source: "photo" };
  } catch {
    // illisible : on passe à la date du fichier
  }
  const age = Date.now() - f.lastModified;
  if (f.lastModified && age > 2 * 60000 && age < 2 * 86400000) {
    return { date: new Date(f.lastModified), source: "fichier" };
  }
  return null;
}

export default function NouveauRepasForm({
  kind,
  initialTime,
}: {
  kind: "repas" | "collation" | null;
  initialTime: string;
}) {
  const router = useRouter();
  const [start] = useState(() => new Date(initialTime));
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [mealType, setMealType] = useState<string>(() => defaultSlotFor(start, kind));
  const [slotTouched, setSlotTouched] = useState(false);
  const [time, setTime] = useState(() => toParisInputValue(start));
  const [timeHint, setTimeHint] = useState("");
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "envoi" | "fait" | "erreur">("idle");
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [mealId, setMealId] = useState<string | null>(null);
  const [savedDay, setSavedDay] = useState<string | null>(null);

  /** Réduit la photo côté téléphone (max 1600 px, JPEG qualité 0.8) :
   *  envoi plus rapide, stockage léger, et sous la limite de l'API vision.
   *  En cas d'échec (format exotique), on garde le fichier original. */
  async function compress(f: File): Promise<File> {
    try {
      const url = URL.createObjectURL(f);
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = reject;
        el.src = url;
      });
      const maxDim = 1600;
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.8)
      );
      if (!blob) return f;
      return new File([blob], "repas.jpg", { type: "image/jpeg" });
    } catch {
      return f;
    }
  }

  async function onFile(raw: File | null) {
    if (!raw) {
      setFile(null);
      setPreview(null);
      return;
    }
    // L'heure se lit sur l'original : la compression efface l'EXIF.
    const pt = await photoTime(raw);
    if (pt) {
      setTime(toParisInputValue(pt.date));
      if (!slotTouched) setMealType(defaultSlotFor(pt.date, kind));
      setTimeHint(
        pt.source === "photo"
          ? "Heure lue dans la photo."
          : "Heure du fichier photo (à vérifier)."
      );
    } else {
      setTimeHint("");
    }
    const f = raw.size > 500 * 1024 ? await compress(raw) : raw;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const at = fromParisInputValue(time);
    if (!at) {
      setState("erreur");
      setError("Heure invalide");
      return;
    }
    setState("envoi");
    setError("");
    try {
      const fd = new FormData();
      if (file) fd.append("photo", file);
      fd.append("meal_type", mealType);
      fd.append("note", note);
      fd.append("eaten_at", at.toISOString());
      const res = await fetch("/api/meals", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Erreur ${res.status}`);
      setFeedback(data.feedback);
      setMealId(data.meal_id ?? null);
      setSavedDay(dayKey(at));
      setState("fait");
    } catch (err) {
      setState("erreur");
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    }
  }

  const backToDay = () => {
    const today = dayKey(new Date());
    router.push(!savedDay || savedDay === today ? "/" : `/jour/${savedDay}`);
    router.refresh();
  };

  if (state === "fait" && feedback) {
    const silent = feedback.verdict === "note";
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-bold">
          {silent
            ? "Collation enregistrée"
            : feedback.verdict === "valide"
              ? "✅ Repas validé"
              : feedback.verdict === "simule"
                ? "🧪 Réponse simulée"
                : "➕ À compléter"}
        </h1>
        <p className="text-sm">{feedback.resume}</p>
        <div className="rounded-xl border border-border bg-card p-4 text-sm flex flex-col gap-1">
          <p>
            <span className="font-semibold">Estimation :</span>{" "}
            {range(feedback.kcal_min, feedback.kcal_max, "kcal")} · protéines{" "}
            {range(feedback.prot_min, feedback.prot_max, "g")}
          </p>
          <p className="text-xs tabular-nums">
            glucides {range(feedback.gluc_min, feedback.gluc_max, "g")} · lipides{" "}
            {range(feedback.lip_min, feedback.lip_max, "g")} · fibres{" "}
            {range(feedback.fib_min, feedback.fib_max, "g")}
          </p>
          {feedback.hypotheses && <p className="text-xs text-muted">{feedback.hypotheses}</p>}
        </div>
        {!silent && feedback.ajouts.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="font-semibold text-sm mb-1">Le coach te demande d&apos;ajouter :</p>
            <ul className="list-disc pl-5 text-sm">
              {feedback.ajouts.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </div>
        )}
        {!silent && feedback.commentaire && (
          <div className="rounded-xl border border-border bg-card p-4">
            <Markdown md={feedback.commentaire} />
            <p className="text-xs text-muted mt-2">Modèle : {feedback.model}</p>
          </div>
        )}
        <button onClick={backToDay} className="rounded-lg bg-accent text-white py-3 font-semibold">
          Voir la journée
        </button>
        {mealId && (
          <button
            onClick={() => router.push(`/repas/${mealId}`)}
            className="rounded-lg border border-border py-3"
          >
            {silent ? "Corriger ou préciser" : "💬 Répondre au coach"}
          </button>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">
        {isCollation(mealType) ? "Nouvelle collation" : "Nouveau repas"}
      </h1>

      <div className="flex flex-wrap gap-2">
        {SLOTS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setMealType(t);
              setSlotTouched(true);
            }}
            className={`rounded-full px-3 py-1.5 text-sm border ${
              mealType === t ? "bg-accent text-white border-accent" : "border-border bg-card"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <label className="rounded-xl border-2 border-dashed border-border bg-card p-4 text-center cursor-pointer">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Aperçu" className="mx-auto max-h-60 rounded-lg object-cover" />
        ) : (
          <span className="text-sm text-muted">
            📷 Photo facultative : prends l&apos;assiette, ou choisis-la dans ta pellicule
          </span>
        )}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
      </label>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={
          file
            ? "Précisions (facultatif) : quantité d'huile, ce qui ne se voit pas…"
            : "Ce que tu as mangé, avec les quantités si tu les connais (ex. 30 g d'amandes, 2 tranches de jambon)"
        }
        rows={3}
        className="rounded-lg border border-border bg-card px-4 py-3 text-base"
      />

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-semibold">Heure de la prise</span>
        <input
          type="datetime-local"
          value={time}
          onChange={(e) => {
            setTime(e.target.value);
            setTimeHint("");
          }}
          className="rounded-lg border border-border bg-card px-4 py-2.5 text-base"
        />
        {timeHint && <span className="text-xs text-muted">{timeHint}</span>}
      </label>

      <button
        type="submit"
        disabled={state === "envoi" || (!file && !note.trim())}
        className="rounded-lg bg-accent text-white py-3 font-semibold disabled:opacity-60"
      >
        {state === "envoi" ? "Analyse en cours…" : "Enregistrer"}
      </button>
      {state === "erreur" && <p className="text-sm text-danger">{error}</p>}
      <p className="text-xs text-muted">
        {isCollation(mealType)
          ? "Collation : le coach l'estime pour tes jauges, sans commentaire."
          : "Le coach estime le repas en fourchette et dit quoi ajouter si besoin."}{" "}
        Photo ou texte : au moins l&apos;un des deux.
      </p>
    </form>
  );
}
