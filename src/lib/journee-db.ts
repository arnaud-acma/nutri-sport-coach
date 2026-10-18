import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CATEGORIES,
  DEFAULT_TARGET,
  dayBounds,
  isCollation,
  summarizeDay,
  targetFor,
  type DaySummary,
  type Target,
} from "@/lib/journee";

export const MEAL_COLUMNS =
  "id,eaten_at,meal_type,note,photo_path,coach_verdict,coach_feedback_md,model_used," +
  "kcal_min,kcal_max,prot_min,prot_max,categories,hypotheses";

export interface DayMeal {
  id: string;
  eaten_at: string;
  meal_type: string | null;
  note: string | null;
  photo_path: string | null;
  coach_verdict: string | null;
  coach_feedback_md: string | null;
  model_used: string | null;
  kcal_min: number | null;
  kcal_max: number | null;
  prot_min: number | null;
  prot_max: number | null;
  categories: string[] | null;
  hypotheses: string | null;
}

export interface Stool {
  id: string;
  occurred_at: string;
  bristol: number;
  flottent: boolean | null;
  note: string | null;
}

/** Cibles datées ; table absente (migration 0003 non faite) : défaut. */
export async function loadTargets(supabase: SupabaseClient): Promise<Target[]> {
  const { data, error } = await supabase
    .from("nutrition_targets")
    .select("valid_from,kcal,proteines_g,prises_min,note")
    .order("valid_from");
  if (error || !data?.length) return [DEFAULT_TARGET];
  return data as Target[];
}

export async function loadMealsBetween(
  supabase: SupabaseClient,
  start: Date,
  end: Date
): Promise<DayMeal[]> {
  const { data, error } = await supabase
    .from("meals")
    .select(MEAL_COLUMNS)
    .gte("eaten_at", start.toISOString())
    .lt("eaten_at", end.toISOString())
    .order("eaten_at")
    .returns<DayMeal[]>();
  if (error) throw new Error(`Lecture des repas : ${error.message}`);
  return data ?? [];
}

export async function loadStoolsBetween(
  supabase: SupabaseClient,
  start: Date,
  end: Date
): Promise<Stool[]> {
  const { data, error } = await supabase
    .from("stools")
    .select("id,occurred_at,bristol,flottent,note")
    .gte("occurred_at", start.toISOString())
    .lt("occurred_at", end.toISOString())
    .order("occurred_at")
    .returns<Stool[]>();
  if (error) return []; // table absente avant la migration 0003
  return data ?? [];
}

export interface DayData {
  key: string;
  target: Target;
  meals: DayMeal[];
  stools: Stool[];
  summary: DaySummary;
}

export async function loadDay(supabase: SupabaseClient, key: string): Promise<DayData> {
  const { start, end } = dayBounds(key);
  const [targets, meals, stools] = await Promise.all([
    loadTargets(supabase),
    loadMealsBetween(supabase, start, end),
    loadStoolsBetween(supabase, start, end),
  ]);
  const target = targetFor(key, targets);
  return { key, target, meals, stools, summary: summarizeDay(meals, target) };
}

export function parseFeedback(raw: string | null): {
  resume?: string;
  ajouts?: string[];
  commentaire?: string;
} {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return { commentaire: raw };
  }
}

const hhmm = (d: string) =>
  new Date(d).toLocaleTimeString("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
  });

export function rangeLabel(min: number | null, max: number | null, unit: string): string {
  if (min == null || max == null) return "non estimé";
  return min === max ? `${min} ${unit}` : `${min} à ${max} ${unit}`;
}

const catLabel = (k: string) => CATEGORIES.find((c) => c.key === k)?.label ?? k;

/** Texte de la journée en cours, pour les consignes du coach :
 *  cibles, prises déjà enregistrées, totaux et reste à atteindre. */
export function describeDay(day: DayData, excludeMealId?: string): string {
  const meals = day.meals.filter((m) => m.id !== excludeMealId);
  const summary = excludeMealId ? summarizeDay(meals, day.target) : day.summary;
  const t = day.target;
  const lines = [
    `Journée nutritionnelle du ${day.key} (de 4h à 4h, heure de Paris).`,
    `Cibles en vigueur (provisoires, à recaler sur la courbe de poids) : ${t.kcal} kcal estimées, ${t.proteines_g} g de protéines, ${t.prises_min} prises ou plus, catégories ${CATEGORIES.map((c) => c.label.toLowerCase()).join(", ")}.`,
  ];
  if (!meals.length) {
    lines.push("Aucune autre prise enregistrée pour l'instant dans cette journée.");
  } else {
    lines.push("Prises déjà enregistrées :");
    for (const m of meals) {
      const fb = parseFeedback(m.coach_feedback_md);
      lines.push(
        `- ${hhmm(m.eaten_at)} · ${m.meal_type ?? "repas"}${isCollation(m.meal_type) ? " (collation)" : ""} · ` +
          `${rangeLabel(m.kcal_min, m.kcal_max, "kcal")} · protéines ${rangeLabel(m.prot_min, m.prot_max, "g")}` +
          (fb.resume ? ` · ${fb.resume}` : m.note ? ` · « ${m.note} »` : "")
      );
    }
    lines.push(
      `Total estimé : ${summary.kcal.min} à ${summary.kcal.max} kcal, ${summary.prot.min} à ${summary.prot.max} g de protéines, ${summary.prises} prises.`,
      `Catégories déjà couvertes : ${summary.categories.map(catLabel).join(", ") || "aucune"}.`,
      `Reste environ ${Math.max(0, t.kcal - summary.kcal.mid)} kcal et ${Math.max(0, t.proteines_g - summary.prot.mid)} g de protéines pour atteindre les cibles.`
    );
  }
  if (day.stools.length) {
    lines.push(
      `Selles notées dans la journée : ${day.stools
        .map((s) => `Bristol ${s.bristol}${s.flottent ? ", flottent" : ""}`)
        .join(" ; ")}.`
    );
  }
  return lines.join("\n");
}
