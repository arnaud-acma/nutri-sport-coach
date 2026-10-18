import type {
  AnalyzeMealInput,
  ChatInput,
  ChatReply,
  CoachMealReply,
  KnowledgeProposal,
  LlmProvider,
} from "./types";

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

    const data = await this.call({
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
    });
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

  /** Discussion libre ou fil d'un repas. Le modèle peut, en plus de sa
   *  réponse, proposer une modification de fiche via l'outil dédié. */
  async chat(input: ChatInput): Promise<ChatReply> {
    const data = await this.call({
      max_tokens: 4096,
      system: input.systemPrompt,
      messages: input.turns.map((t) => ({ role: t.role, content: t.content })),
      tools: [PROPOSAL_TOOL],
      tool_choice: { type: "auto" },
    });
    const model = data.model ?? this.model;
    let text = data.content
      .filter((b) => b.type === "text" && b.text)
      .map((b) => b.text!.trim())
      .join("\n\n")
      .trim();
    const tool = data.content.find(
      (b) => b.type === "tool_use" && b.name === PROPOSAL_TOOL.name
    );
    const proposal = tool ? toProposal(tool.input) : null;
    if (!text && proposal) text = "Je te propose de mettre à jour une fiche :";
    if (data.stop_reason === "max_tokens") {
      text += "\n\n_(Réponse coupée : limite de longueur atteinte.)_";
    }
    return { text: text || "(réponse vide)", proposal, model };
  }

  /** Appel HTTP brut à l'API Messages. */
  private async call(body: Record<string, unknown>): Promise<ApiResponse> {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": API_VERSION,
      },
      body: JSON.stringify({ model: this.model, ...body }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Anthropic ${res.status}: ${text.slice(0, 500)}`);
    }
    const data = (await res.json()) as ApiResponse;
    return { ...data, content: data.content ?? [] };
  }
}

interface ApiResponse {
  model: string;
  stop_reason?: string;
  content: Array<{ type: string; text?: string; name?: string; input?: unknown }>;
}

const SLUGS = ["profil", "objectifs", "positions", "regime", "sante"] as const;

const PROPOSAL_TOOL = {
  name: "proposer_modif_fiche",
  description:
    "Propose à Arnaud une modification d'UNE fiche de connaissance, quand il " +
    "vient de t'apprendre un fait durable (habitude, contrainte, décision, " +
    "préférence) absent ou périmé dans les fiches. Arnaud valide ou refuse ; " +
    "rien n'est appliqué sans lui. N'utilise pas cet outil pour un fait " +
    "passager (fatigue du jour, repas ponctuel).",
  input_schema: {
    type: "object",
    properties: {
      slug: { type: "string", enum: SLUGS },
      ancien_texte: {
        type: "string",
        description:
          "Passage EXACT de la fiche à remplacer (copié mot pour mot). " +
          "Chaîne vide pour ajouter une ligne en fin de fiche.",
      },
      nouveau_texte: {
        type: "string",
        description: "Texte de remplacement, ou ligne à ajouter (format Markdown de la fiche).",
      },
      raison: { type: "string", description: "Une phrase : pourquoi ce changement." },
    },
    required: ["slug", "ancien_texte", "nouveau_texte", "raison"],
  },
} as const;

function toProposal(input: unknown): KnowledgeProposal | null {
  if (!input || typeof input !== "object") return null;
  const r = input as Record<string, unknown>;
  if (typeof r.slug !== "string" || !SLUGS.includes(r.slug as never)) return null;
  if (typeof r.nouveau_texte !== "string" || !r.nouveau_texte.trim()) return null;
  return {
    slug: r.slug,
    ancien_texte: typeof r.ancien_texte === "string" ? r.ancien_texte : "",
    nouveau_texte: r.nouveau_texte,
    raison: typeof r.raison === "string" ? r.raison : "",
  };
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
