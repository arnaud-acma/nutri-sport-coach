import type {
  AnalyzeMealInput,
  ChatInput,
  ChatReply,
  CoachMealReply,
  LlmProvider,
} from "./types";

/** Fournisseur simulé : aucune clé requise. Sert aux tests et au premier
 *  démarrage avant configuration. Chaque réponse est clairement marquée. */
export class MockProvider implements LlmProvider {
  readonly name = "mock";

  async analyzeMeal(input: AnalyzeMealInput): Promise<CoachMealReply> {
    const hasPhoto = Boolean(input.imageBase64);
    return {
      verdict: "simule",
      resume: hasPhoto
        ? "Photo reçue (analyse simulée, aucune clé API configurée)."
        : "Repas noté sans photo (analyse simulée).",
      ajouts: [
        "Configurer ANTHROPIC_API_KEY pour obtenir une vraie analyse",
      ],
      commentaire: [
        "**Réponse simulée.** Le fournisseur LLM est en mode `mock` :",
        "aucun appel réel n'a été fait. Renseigne `ANTHROPIC_API_KEY` et",
        "`LLM_PROVIDER=anthropic` dans les variables d'environnement pour",
        "activer le vrai coach.",
        input.note ? `\n_Ta note a bien été enregistrée : « ${input.note} »_` : "",
      ].join(" "),
      model: "mock",
    };
  }

  async chat(input: ChatInput): Promise<ChatReply> {
    const last = input.turns[input.turns.length - 1]?.content ?? "";
    return {
      text:
        "**Réponse simulée** (mode `mock`, aucun appel réel). " +
        `Ta question a bien été enregistrée : « ${last.slice(0, 200)} »`,
      proposal: null,
      model: "mock",
    };
  }
}
