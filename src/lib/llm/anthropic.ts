import type { AnalyzeMealInput, CoachMealReply, LlmProvider } from "./types";

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";

type ContentBlock =
  | { type: "text"; text: string }
  | {
      type: "image";
      source: { type: "base64"; media_type: string; data: string };
    };

/** Fournisseur Anthropic. Appelé uniquement côté serveur (clé secrète). */
export class AnthropicProvider implements LlmProvider {
  readonly name = "anthropic";
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async analyzeMeal(input: AnalyzeMealInput): Promise<CoachMealReply> {
    const content: ContentBlock[] = [];
    if (input.imageBase64 && input.imageMediaType) {
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: input.imageMediaType,
          data: input.imageBase64,
        },
      });
    }
    content.push({
      type: "text",
      text: [
        input.mealType ? `Type de repas : ${input.mealType}.` : "",
        input.note ? `Note d'Arnaud : ${input.note}` : "",
        "Analyse ce repas puis appelle l'outil verdict_repas avec ton analyse (ne réponds pas en texte libre).",
      ]
        .filter(Boolean)
        .join("\n"),
    });

    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": API_VERSION,
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 4096,
        system: input.systemPrompt,
        messages: [{ role: "user", content }],
        // Sortie structurée : le modèle remplit les champs d'un outil au lieu
        // d'écrire du JSON à la main. tool_choice "tool"/"any" est refusé par
        // certains modèles (erreur 400 constatée le 18/10 avec Sonnet 5.5) :
        // on reste en "auto" et la consigne demande d'appeler l'outil.
        // Repli sur la lecture du texte si le modèle répond quand même en texte.
        tools: [COACH_TOOL],
        tool_choice: { type: "auto" },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Anthropic ${res.status}: ${body.slice(0, 500)}`);
    }

    const data = (await res.json()) as {
      model: string;
      stop_reason?: string;
      content: Array<{ type: string; text?: string; input?: unknown }>;
    };
    const model = data.model ?? this.model;
    const tool = data.content?.find((b) => b.type === "tool_use");
    if (tool && tool.input && typeof tool.input === "object") {
      return normalizeReply(tool.input as Record<string, unknown>, model, "");
    }
    // Repli : réponse texte (ancien comportement).
    const text =
      data.content?.find((b) => b.type === "text")?.text?.trim() ?? "";
    const reply = parseCoachJson(text, model);
    if (data.stop_reason === "max_tokens") {
      reply.commentaire += "\n\n_(Réponse coupée : limite de longueur atteinte.)_";
    }
    return reply;
  }
}

const COACH_TOOL = {
  name: "verdict_repas",
  description: "Enregistre l'analyse du repas par le coach.",
  input_schema: {
    type: "object",
    properties: {
      verdict: { type: "string", enum: ["valide", "a_completer"] },
      resume: {
        type: "string",
        description: "Une phrase sur ce que tu vois dans l'assiette.",
      },
      ajouts: {
        type: "array",
        items: { type: "string" },
        description: "Ajouts ou ajustements concrets (vide si validé).",
      },
      commentaire: {
        type: "string",
        description: "2 à 4 phrases en Markdown, tutoiement.",
      },
    },
    required: ["verdict", "resume", "ajouts", "commentaire"],
  },
} as const;

/** Met une réponse brute (objet) au format attendu par l'appli. */
export function normalizeReply(
  raw: Record<string, unknown>,
  model: string,
  fallbackText: string
): CoachMealReply {
  const verdict =
    raw.verdict === "valide" || raw.verdict === "a_completer"
      ? raw.verdict
      : "a_completer";
  return {
    verdict,
    resume: typeof raw.resume === "string" ? raw.resume : "",
    ajouts: Array.isArray(raw.ajouts)
      ? raw.ajouts.filter((a): a is string => typeof a === "string")
      : [],
    commentaire:
      typeof raw.commentaire === "string" ? raw.commentaire : fallbackText,
    model,
  };
}

/** Le modèle doit renvoyer un JSON ; on tolère du texte autour. */
export function parseCoachJson(text: string, model: string): CoachMealReply {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      const raw = JSON.parse(text.slice(start, end + 1)) as Record<
        string,
        unknown
      >;
      return normalizeReply(raw, model, text);
    } catch {
      // JSON invalide : on garde le texte brut comme commentaire.
    }
  }
  return {
    verdict: "a_completer",
    resume: "Réponse du coach non structurée (voir commentaire).",
    ajouts: [],
    commentaire: text,
    model,
  };
}
