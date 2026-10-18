import type { SupabaseClient } from "@supabase/supabase-js";
import { loadKnowledge, buildMealSystemPrompt } from "@/lib/coach/prompt";
import { getProvider } from "@/lib/llm";
import type { CoachMealReply } from "@/lib/llm/types";
import { dayKey, isCollation } from "@/lib/journee";
import { describeDay, loadDay } from "@/lib/journee-db";

export interface AnalyzeArgs {
  supabase: SupabaseClient;
  mealType: string;
  note: string;
  eatenAt: Date;
  imageBase64?: string;
  imageMediaType?: string;
  /** Réanalyse : le repas lui-même n'entre pas dans « déjà mangé ». */
  excludeMealId?: string;
}

/** Analyse une prise (repas ou collation) et renvoie la réponse du coach
 *  ainsi que les colonnes à enregistrer. Ne lève jamais : en cas d'erreur,
 *  la prise est enregistrée sans estimation. */
export async function analyzeIntake(args: AnalyzeArgs): Promise<{
  feedback: CoachMealReply;
  columns: Record<string, unknown>;
}> {
  const silent = isCollation(args.mealType);
  let feedback: CoachMealReply;
  try {
    const [pages, day] = await Promise.all([
      loadKnowledge(),
      loadDay(args.supabase, dayKey(args.eatenAt)),
    ]);
    feedback = await getProvider().analyzeMeal({
      systemPrompt: buildMealSystemPrompt(pages, {
        silent,
        dayContext: describeDay(day, args.excludeMealId),
      }),
      note: args.note,
      mealType: args.mealType,
      eatenAtLabel: args.eatenAt.toLocaleString("fr-FR", {
        timeZone: "Europe/Paris",
        weekday: "long",
        hour: "2-digit",
        minute: "2-digit",
      }),
      imageBase64: args.imageBase64,
      imageMediaType: args.imageMediaType,
    });
    if (silent && feedback.verdict !== "simule") {
      feedback = { ...feedback, verdict: "note", ajouts: [], commentaire: "" };
    }
  } catch (err) {
    feedback = {
      verdict: "a_completer",
      resume: "Le coach n'a pas pu analyser cette prise (erreur technique).",
      ajouts: [],
      commentaire: `Erreur : ${err instanceof Error ? err.message : "inconnue"}. La prise est tout de même enregistrée, sans estimation. Tu peux la réanalyser plus tard.`,
      kcal_min: null,
      kcal_max: null,
      prot_min: null,
      prot_max: null,
      categories: [],
      hypotheses: "",
      model: "aucun",
    };
  }
  return {
    feedback,
    columns: {
      coach_verdict: feedback.verdict,
      coach_feedback_md: JSON.stringify({
        resume: feedback.resume,
        ajouts: feedback.ajouts,
        commentaire: feedback.commentaire,
      }),
      model_used: feedback.model,
      kcal_min: feedback.kcal_min,
      kcal_max: feedback.kcal_max,
      prot_min: feedback.prot_min,
      prot_max: feedback.prot_max,
      categories: feedback.categories,
      hypotheses: feedback.hypotheses || null,
    },
  };
}
