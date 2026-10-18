import type { SupabaseClient } from "@supabase/supabase-js";

/** Sauvegarde d'une fiche : met à jour la page ET archive l'ancienne
 *  version dans knowledge_revisions (historique, décision n°1).
 *  Utilisé par l'éditeur de fiches et par la validation des propositions
 *  du coach. */
export async function saveKnowledgePage(
  supabase: SupabaseClient,
  slug: string,
  contentMd: string,
  note: string | null
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const { data: page, error: readErr } = await supabase
    .from("knowledge_pages")
    .select("id,content_md")
    .eq("slug", slug)
    .maybeSingle();
  if (readErr || !page) return { ok: false, status: 404, error: "Fiche introuvable" };

  if (page.content_md.trim()) {
    await supabase.from("knowledge_revisions").insert({
      page_id: page.id,
      content_md: page.content_md,
      note: note?.slice(0, 300) || null,
    });
  }

  const { error: upErr } = await supabase
    .from("knowledge_pages")
    .update({ content_md: contentMd, updated_at: new Date().toISOString() })
    .eq("id", page.id);
  if (upErr) return { ok: false, status: 500, error: upErr.message };
  return { ok: true };
}

/** Applique une proposition du coach au texte d'une fiche.
 *  ancien_texte vide : ajout en fin de fiche. Sinon remplacement exact,
 *  refusé si le passage n'existe plus (fiche modifiée entre-temps). */
export function applyProposal(
  current: string,
  ancien: string,
  nouveau: string
): string | null {
  if (!ancien.trim()) {
    const base = current.replace(/\s+$/, "");
    return base ? `${base}\n${nouveau.trim()}\n` : `${nouveau.trim()}\n`;
  }
  const idx = current.indexOf(ancien);
  if (idx === -1) return null;
  return current.slice(0, idx) + nouveau + current.slice(idx + ancien.length);
}
