import Markdown from "@/components/Markdown";

import { aVerifier, macrosLabel, rangeLabel, type DayMeal } from "@/lib/journee-db";
import { CATEGORIES } from "@/lib/journee";

export type MealRow = DayMeal;

interface StoredFeedback {
  resume?: string;
  ajouts?: string[];
  commentaire?: string;
}

function parseFeedback(raw: string | null): StoredFeedback {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as StoredFeedback;
  } catch {
    return { commentaire: raw };
  }
}

/** Carte d'un repas : photo, en-tête, note et analyse du coach. */
export default function MealCard({
  meal,
  photoUrl,
  footer,
}: {
  meal: MealRow;
  photoUrl: string | null;
  footer?: React.ReactNode;
}) {
  const fb = parseFeedback(meal.coach_feedback_md);
  return (
    <article
      id={meal.id}
      className="rounded-xl border border-border bg-card overflow-hidden"
    >
      {photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt="" className="w-full max-h-64 object-cover" />
      )}
      <div className="p-4 flex flex-col gap-2">
        <p className="text-sm font-semibold">
          {meal.coach_verdict === "valide"
            ? "✅"
            : meal.coach_verdict === "simule"
              ? "🧪"
              : meal.coach_verdict === "note"
                ? "🥜"
                : "➕"}{" "}
          {meal.meal_type ?? "Repas"} ·{" "}
          {new Date(meal.eaten_at).toLocaleString("fr-FR", {
            timeZone: "Europe/Paris",
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
        {meal.note && <p className="text-sm text-muted">« {meal.note} »</p>}
        {fb.resume && <p className="text-sm">{fb.resume}</p>}
        <p className="text-xs tabular-nums">
          Estimation : {rangeLabel(meal.kcal_min, meal.kcal_max, "kcal")} · protéines{" "}
          {rangeLabel(meal.prot_min, meal.prot_max, "g")}
          {meal.categories?.length
            ? ` · ${meal.categories
                .map((c) => CATEGORIES.find((x) => x.key === c)?.label.toLowerCase() ?? c)
                .join(", ")}`
            : ""}
        </p>
        {macrosLabel(meal) && <p className="text-xs tabular-nums">{macrosLabel(meal)}</p>}
        {aVerifier(meal) && (
          <p className="text-xs text-danger">
            ⚠️ Estimation incohérente : les calories ne correspondent pas aux protéines,
            glucides et lipides annoncés. Précise la note puis réanalyse.
          </p>
        )}
        {meal.hypotheses && <p className="text-xs text-muted">Hypothèses : {meal.hypotheses}</p>}
        {fb.ajouts && fb.ajouts.length > 0 && (
          <ul className="list-disc pl-5 text-sm">
            {fb.ajouts.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        )}
        {fb.commentaire && <Markdown md={fb.commentaire} />}
        {footer}
      </div>
    </article>
  );
}
