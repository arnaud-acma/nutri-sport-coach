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
        "Analyse ce repas et réponds UNIQUEMENT avec le JSON demandé.",
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
        max_tokens: 1024,
        system: input.systemPrompt,
        messages: [{ role: "user", content }],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Anthropic ${res.status}: ${body.slice(0, 500)}`);
    }

    const data = (await res.json()) as {
      model: string;
      content: Array<{ type: string; text?: string }>;
    };
    const text =
      data.content?.find((b) => b.type === "text")?.text?.trim() ?? "";
    return parseCoachJson(text, data.model ?? this.model);
  }
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
          typeof raw.commentaire === "string" ? raw.commentaire : text,
        model,
      };
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
