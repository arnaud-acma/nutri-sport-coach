/** Contrat de l'adaptateur LLM (décision n°4 : indépendance du fournisseur).
 *  Tout nouveau fournisseur implémente cette interface et s'enregistre dans index.ts. */

export type MealVerdict = "valide" | "a_completer" | "simule";

export interface CoachMealReply {
  verdict: MealVerdict;
  /** Résumé en une phrase de ce que le coach a vu. */
  resume: string;
  /** Ce qu'il faudrait ajouter ou ajuster (vide si validé). */
  ajouts: string[];
  /** Commentaire libre du coach, en Markdown. */
  commentaire: string;
  /** Modèle réellement utilisé (traçabilité). */
  model: string;
}

export interface AnalyzeMealInput {
  /** Instructions système : rôle du coach + fiches de connaissance. */
  systemPrompt: string;
  /** Note de l'utilisateur accompagnant la photo (optionnelle). */
  note?: string;
  /** Type de repas déclaré (petit-déjeuner, déjeuner, ...). */
  mealType?: string;
  /** Photo en base64, sans préfixe data:. */
  imageBase64?: string;
  imageMediaType?: string;
}

export interface LlmProvider {
  readonly name: string;
  analyzeMeal(input: AnalyzeMealInput): Promise<CoachMealReply>;
}
