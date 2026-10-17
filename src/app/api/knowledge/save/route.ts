import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** Sauvegarde d'une fiche : met à jour la page ET archive l'ancienne
 *  version dans knowledge_revisions (historique, décision n°1). */
export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  }
  const body = (await request.json()) as {
    slug?: string;
    content_md?: string;
    note?: string;
  };
  if (!body.slug || typeof body.content_md !== "string") {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: page, error: readErr } = await supabase
    .from("knowledge_pages")
    .select("id,content_md")
    .eq("slug", body.slug)
    .maybeSingle();
  if (readErr || !page) {
    return NextResponse.json({ error: "Fiche introuvable" }, { status: 404 });
  }

  // Archiver l'état précédent (seulement s'il était non vide)
  if (page.content_md.trim()) {
    await supabase.from("knowledge_revisions").insert({
      page_id: page.id,
      content_md: page.content_md,
      note: body.note?.slice(0, 300) || null,
    });
  }

  const { error: upErr } = await supabase
    .from("knowledge_pages")
    .update({ content_md: body.content_md, updated_at: new Date().toISOString() })
    .eq("id", page.id);
  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
