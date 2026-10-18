import type { SupabaseClient } from "@supabase/supabase-js";

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

const fmt = (d: string) =>
  new Date(d).toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

/** Résumé texte des données récentes, injecté dans les consignes du coach.
 *  Pour un fil de repas : le repas en détail (note + analyse du coach).
 *  Toujours : les repas des 7 derniers jours (résumés) et les pesées. */
export async function buildCoachContext(
  supabase: SupabaseClient,
  mealId: string | null
): Promise<string> {
  const parts: string[] = [
    `Date et heure actuelles (Paris) : ${fmt(new Date().toISOString())}.`,
  ];

  if (mealId) {
    const { data: meal } = await supabase
      .from("meals")
      .select("eaten_at,meal_type,note,coach_verdict,coach_feedback_md")
      .eq("id", mealId)
      .maybeSingle();
    if (meal) {
      const fb = parseFeedback(meal.coach_feedback_md);
      parts.push(
        "",
        "### Repas dont on parle (la photo n'est pas rejointe à la discussion)",
        `${meal.meal_type ?? "repas"}, ${fmt(meal.eaten_at)}.`,
        meal.note ? `Note d'Arnaud : « ${meal.note} »` : "",
        `Ton analyse initiale : verdict ${meal.coach_verdict ?? "?"}.`,
        fb.resume ? `Ce que tu as vu : ${fb.resume}` : "",
        fb.ajouts?.length ? `Tes ajouts demandés : ${fb.ajouts.join(" ; ")}` : "",
        fb.commentaire ? `Ton commentaire : ${fb.commentaire}` : ""
      );
    }
  }

  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const { data: meals } = await supabase
    .from("meals")
    .select("eaten_at,meal_type,note,coach_verdict,coach_feedback_md")
    .gte("eaten_at", since)
    .order("eaten_at", { ascending: true })
    .limit(40);
  parts.push("", "### Repas des 7 derniers jours");
  if (meals?.length) {
    for (const m of meals) {
      const fb = parseFeedback(m.coach_feedback_md);
      parts.push(
        `- ${fmt(m.eaten_at)} · ${m.meal_type ?? "repas"} · ${m.coach_verdict ?? "?"}` +
          (fb.resume ? ` · ${fb.resume}` : "") +
          (m.note ? ` · note : « ${m.note} »` : "")
      );
    }
  } else {
    parts.push("(aucun repas enregistré)");
  }

  const { data: weights } = await supabase
    .from("weights")
    .select("measured_at,weight_kg,note")
    .order("measured_at", { ascending: false })
    .limit(8);
  parts.push("", "### Dernières pesées");
  if (weights?.length) {
    for (const w of [...weights].reverse()) {
      parts.push(`- ${w.measured_at} : ${Number(w.weight_kg).toFixed(1)} kg${w.note ? ` (${w.note})` : ""}`);
    }
  } else {
    parts.push("(aucune pesée enregistrée)");
  }

  return parts.filter((l) => l !== "").join("\n").replace(/\n###/g, "\n\n###");
}
