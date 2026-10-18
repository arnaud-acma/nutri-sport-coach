import type { SupabaseClient } from "@supabase/supabase-js";

import { dayBounds, dayKey, groupByDay, macroTargets, shiftDay, summarizeDay, targetFor } from "@/lib/journee";
import {
  loadMealsBetween,
  loadStoolsBetween,
  loadTargets,
  parseFeedback,
  rangeLabel,
} from "@/lib/journee-db";

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
 *  Toujours : cibles, journées des 7 derniers jours, selles, pesées. */
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
      .select("eaten_at,meal_type,note,coach_verdict,coach_feedback_md,kcal_min,kcal_max,prot_min,prot_max,hypotheses")
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
        fb.commentaire ? `Ton commentaire : ${fb.commentaire}` : "",
        `Ton estimation : ${rangeLabel(meal.kcal_min, meal.kcal_max, "kcal")}, protéines ${rangeLabel(meal.prot_min, meal.prot_max, "g")}.`,
        meal.hypotheses ? `Tes hypothèses : ${meal.hypotheses}` : ""
      );
    }
  }

  // Journées nutritionnelles (4h à 4h) des 7 derniers jours, avec totaux
  // estimés, score et détail des prises ; selles sur 14 jours.
  const today = dayKey(new Date());
  const first = shiftDay(today, -6);
  const [targets, meals, stools] = await Promise.all([
    loadTargets(supabase),
    loadMealsBetween(supabase, dayBounds(first).start, dayBounds(today).end),
    loadStoolsBetween(supabase, dayBounds(shiftDay(today, -13)).start, dayBounds(today).end),
  ]);
  const t = targetFor(today, targets);
  parts.push(
    "",
    "### Cibles du jour en vigueur (provisoires)",
    `${t.kcal} kcal estimées, ${t.proteines_g} g de protéines, ${t.prises_min} prises ou plus, 5 catégories (protéines, légumes, féculents, bon gras, fruits). Score du jour sur 100 : énergie 35, protéines 35, qualité 20, prises 10.`,
    `Hors score : glucides ${macroTargets(t).glucides} g, lipides ${macroTargets(t).lipides} g, fibres ${macroTargets(t).fibres} g (vides dans les réglages = calculés d'après les repères ANSES 2016 pour l'adulte, non spécifiques au sport).`,
    "",
    "### Journées des 7 derniers jours (estimations en fourchette)"
  );
  const byDay = groupByDay(meals);
  for (let i = 6; i >= 0; i--) {
    const key = shiftDay(today, -i);
    const list = byDay.get(key) ?? [];
    const sum = summarizeDay(list, targetFor(key, targets));
    parts.push(
      `- ${key}${key === today ? " (aujourd'hui, en cours)" : ""} : ` +
        (list.length
          ? `score ${sum.score}/100, ${sum.kcal.min} à ${sum.kcal.max} kcal, ${sum.prot.min} à ${sum.prot.max} g de protéines, glucides ${sum.gluc.mid} g, lipides ${sum.lip.mid} g, fibres ${sum.fib.mid} g (milieux de fourchette), ${sum.prises} prises, catégories : ${sum.categories.join(", ") || "aucune"}`
          : "rien d'enregistré")
    );
    for (const m of list) {
      const fb = parseFeedback(m.coach_feedback_md);
      parts.push(
        `  - ${fmt(m.eaten_at)} · ${m.meal_type ?? "repas"} · ${rangeLabel(m.kcal_min, m.kcal_max, "kcal")}` +
          (fb.resume ? ` · ${fb.resume}` : "") +
          (m.note ? ` · note : « ${m.note} »` : "")
      );
    }
  }

  parts.push("", "### Selles des 14 derniers jours (échelle de Bristol)");
  if (stools.length) {
    for (const st of stools) {
      parts.push(
        `- ${fmt(st.occurred_at)} : type ${st.bristol}` +
          (st.flottent === true ? ", flottent" : st.flottent === false ? ", coulent" : "") +
          (st.note ? ` (${st.note})` : "")
      );
    }
  } else {
    parts.push("(rien de noté)");
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
