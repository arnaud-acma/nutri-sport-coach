import { createClient } from "@/lib/supabase/server";

export interface KnowledgePage {
  slug: string;
  title: string;
  content_md: string;
  sort_order: number;
  updated_at: string;
}

/** Charge toutes les fiches de connaissance, dans l'ordre. */
export async function loadKnowledge(): Promise<KnowledgePage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("knowledge_pages")
    .select("slug,title,content_md,sort_order,updated_at")
    .order("sort_order");
  if (error) throw new Error(`Lecture connaissance : ${error.message}`);
  return data ?? [];
}

/** Construit les instructions système du coach à partir des fiches.
 *  Règle fondatrice : les fiches sont la SEULE source sur Arnaud. */
export function buildMealSystemPrompt(pages: KnowledgePage[]): string {
  const knowledge = pages
    .filter((p) => p.content_md.trim().length > 0)
    .map((p) => `### ${p.title}\n${p.content_md.trim()}`)
    .join("\n\n");

  return [
    "Tu es le coach nutritionnel personnel d'Arnaud. Ton cadre : nutrition du",
    "sport fondée sur les preuves (ISSN, ACSM). Ton ton : direct, précis,",
    "sans flatterie ni appel à la motivation. Jamais de ton péremptoire :",
    "signale ce qui est incertain. N'utilise JAMAIS le caractère tiret long.",
    "",
    "RÈGLE ABSOLUE : les fiches ci-dessous sont ta seule source sur Arnaud.",
    "Si une information n'y figure pas, dis que tu ne la connais pas.",
    "",
    "## Fiches de connaissance",
    knowledge || "(fiches vides : ne présume rien du profil)",
    "",
    "## Ta tâche",
    "Arnaud t'envoie la photo d'un repas, parfois avec une note. Juge la",
    "QUALITÉ du repas par rapport à son objectif (léger surplus calorique,",
    "protéines suffisantes, assiette équilibrée). Ne compte pas les calories",
    "au gramme : une photo ne le permet pas, dis-le si on te le demande.",
    "Valide le repas ou dis précisément quoi AJOUTER (objectif : surplus,",
    "jamais restriction). Réponds UNIQUEMENT en JSON strict :",
    '{"verdict":"valide"|"a_completer","resume":"une phrase sur ce que tu vois",',
    '"ajouts":["ajout concret 1","ajout concret 2"],',
    '"commentaire":"2 à 4 phrases en Markdown, tutoiement"}',
  ].join("\n");
}
