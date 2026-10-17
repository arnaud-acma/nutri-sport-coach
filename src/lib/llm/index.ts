import { AnthropicProvider } from "./anthropic";
import { MockProvider } from "./mock";
import type { LlmProvider } from "./types";

export const DEFAULT_MODEL = "claude-sonnet-5-5";

/** Point d'entrée unique : le reste du code ne connaît jamais le fournisseur.
 *  LLM_PROVIDER=mock force la simulation ; sans clé API, on retombe aussi
 *  en simulation plutôt que de planter. */
export function getProvider(): LlmProvider {
  const wanted = (process.env.LLM_PROVIDER ?? "anthropic").toLowerCase();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.LLM_MODEL || DEFAULT_MODEL;

  if (wanted === "mock" || !apiKey) return new MockProvider();
  return new AnthropicProvider(apiKey, model);
}
