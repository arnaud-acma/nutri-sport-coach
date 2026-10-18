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
        input.mealType ? `Créneau : ${input.mealType}.` : "",
        input.eatenAtLabel ? `Heure de la prise : ${input.eatenAtLabel}.` : "",
        input.imageBase64 ? "" : "Pas de photo : estime à partir de la note seule.",
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

const SLUGS = ["profil", "objectifs", "positions", "regime", "sante", "cuisine"] as const;

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
        description: "2 à 4 phrases en Markdown, tutoiement (vide pour une collation).",
      },
      kcal_min: { type: "integer", description: "Borne basse de l'estimation calorique (kcal)." },
      kcal_max: { type: "integer", description: "Borne haute de l'estimation calorique (kcal)." },
      prot_min: { type: "number", description: "Borne basse des protéines (g)." },
      prot_max: { type: "number", description: "Borne haute des protéines (g)." },
      gluc_min: { type: "number", description: "Borne basse des glucides totaux (g)." },
      gluc_max: { type: "number", description: "Borne haute des glucides totaux (g)." },
      lip_min: { type: "number", description: "Borne basse des lipides (g)." },
      lip_max: { type: "number", description: "Borne haute des lipides (g)." },
      fib_min: { type: "number", description: "Borne basse des fibres (g)." },
      fib_max: { type: "number", description: "Borne haute des fibres (g)." },
      categories: {
        type: "array",
        items: { type: "string", enum: ["proteines", "legumes", "feculents", "bon_gras", "fruits"] },
        description: "Catégories présentes en quantité significative.",
      },
      hypotheses: {
        type: "string",
        description: "Une phrase : hypothèses de l'estimation (portions, huile supposée).",
      },
    },
    required: [
      "verdict", "resume", "ajouts", "commentaire",
      "kcal_min", "kcal_max", "prot_min", "prot_max",
      "gluc_min", "gluc_max", "lip_min", "lip_max", "fib_min", "fib_max",
      "categories", "hypotheses",
    ],
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
    ...normalizeEstimate(raw),
    model,
  };
}

const CATS = ["proteines", "legumes", "feculents", "bon_gras", "fruits"];

function num(v: unknown, max: number): number | null {
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : v;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= max ? n : null;
}

/** Une fourchette : bornes remises dans l'ordre ; une seule borne donne
 *  une valeur ponctuelle ; valeur aberrante (au-delà de max) écartée. */
function pair(lo: unknown, hi: unknown, max: number, decimals: number) {
  let a = num(lo, max);
  let b = num(hi, max);
  if (a == null || b == null) a = b = a ?? b;
  if (a != null && b != null && a > b) [a, b] = [b, a];
  const f = 10 ** decimals;
  return [a == null ? null : Math.round(a * f) / f, b == null ? null : Math.round(b * f) / f];
}

/** Estimation chiffrée normalisée. Plafonds par prise au-delà desquels la
 *  valeur est traitée comme une erreur du modèle : 5 000 kcal, 300 g de
 *  protéines, 700 g de glucides, 400 g de lipides, 100 g de fibres. */
export function normalizeEstimate(raw: Record<string, unknown>) {
  const [kMin, kMax] = pair(raw.kcal_min, raw.kcal_max, 5000, 0);
  const [pMin, pMax] = pair(raw.prot_min, raw.prot_max, 300, 1);
  const [gMin, gMax] = pair(raw.gluc_min, raw.gluc_max, 700, 1);
  const [lMin, lMax] = pair(raw.lip_min, raw.lip_max, 400, 1);
  const [fMin, fMax] = pair(raw.fib_min, raw.fib_max, 100, 1);
  return {
    kcal_min: kMin,
    kcal_max: kMax,
    prot_min: pMin,
    prot_max: pMax,
    gluc_min: gMin,
    gluc_max: gMax,
    lip_min: lMin,
    lip_max: lMax,
    fib_min: fMin,
    fib_max: fMax,
    categories: Array.isArray(raw.categories)
      ? [...new Set(raw.categories.filter((c): c is string => typeof c === "string" && CATS.includes(c)))]
      : [],
    hypotheses: typeof raw.hypotheses === "string" ? raw.hypotheses : "",
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
    ...normalizeEstimate({}),
    model,
  };
}
