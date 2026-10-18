/** Contrat de l'adaptateur LLM (décision n°4 : indépendance du fournisseur).
 *  Tout nouveau fournisseur implémente cette interface et s'enregistre dans index.ts. */

/** « note » : collation enregistrée et estimée, sans jugement (décision 16). */
export type MealVerdict = "valide" | "a_completer" | "simule" | "note";

export interface CoachMealReply {
  verdict: MealVerdict;
  /** Résumé en une phrase de ce que le coach a vu. */
  resume: string;
  /** Ce qu'il faudrait ajouter ou ajuster (vide si validé). */
  ajouts: string[];
  /** Commentaire libre du coach, en Markdown. */
  commentaire: string;
  /** Estimation en fourchette (décision 11) ; null si impossible. */
  kcal_min: number | null;
  kcal_max: number | null;
  prot_min: number | null;
  prot_max: number | null;
  /** Glucides, lipides, fibres en grammes (fourchettes), décision 19. */
  gluc_min: number | null;
  gluc_max: number | null;
  lip_min: number | null;
  lip_max: number | null;
  fib_min: number | null;
  fib_max: number | null;
  /** Catégories couvertes : proteines, legumes, feculents, bon_gras, fruits. */
  categories: string[];
  /** Hypothèses prises pour l'estimation (huile supposée, portion...). */
  hypotheses: string;
  /** Modèle réellement utilisé (traçabilité). */
  model: string;
}

export interface AnalyzeMealInput {
  /** Instructions système : rôle du coach + fiches de connaissance. */
  systemPrompt: string;
  /** Note de l'utilisateur accompagnant la photo (optionnelle). */
  note?: string;
  /** Créneau déclaré (petit-déjeuner, goûter, ...). */
  mealType?: string;
  /** Heure de la prise, lisible (heure de Paris). */
  eatenAtLabel?: string;
  /** Photo en base64, sans préfixe data:. */
  imageBase64?: string;
  imageMediaType?: string;
}

export interface LlmProvider {
  readonly name: string;
  analyzeMeal(input: AnalyzeMealInput): Promise<CoachMealReply>;
  chat(input: ChatInput): Promise<ChatReply>;
}

/** Proposition de modification d'une fiche, faite par le coach pendant
 *  une discussion. Rien n'est appliqué sans validation d'Arnaud. */
export interface KnowledgeProposal {
  slug: string;
  /** Passage exact à remplacer ; vide = ajout en fin de fiche. */
  ancien_texte: string;
  /** Nouveau texte (remplace ancien_texte, ou s'ajoute en fin de fiche). */
  nouveau_texte: string;
  /** Pourquoi le coach propose ce changement. */
  raison: string;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ChatInput {
  systemPrompt: string;
  /** Historique du fil, du plus ancien au plus récent ; le dernier est d'Arnaud. */
  turns: ChatTurn[];
}

export interface ChatReply {
  text: string;
  proposal: KnowledgeProposal | null;
  model: string;
}
