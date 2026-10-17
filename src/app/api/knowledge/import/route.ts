import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

interface ImportPage {
  slug: string;
  title?: string;
  content_md: string;
}

/** Import en masse des fiches (connaissance-initiale.json).
 *  Chaque fiche écrasée est d'abord archivée en révision. */
export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  }
  const body = (await request.json()) as { pages?: ImportPage[] };
  if (!Array.isArray(body.pages) || body.pages.length === 0) {
    return NextResponse.json(
      { error: "Format attendu : { pages: [{ slug, content_md }] }" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  let imported = 0;

  for (const p of body.pages) {
    if (!p.slug || typeof p.content_md !== "string") continue;
    const { data: existing } = await supabase
      .from("knowledge_pages")
      .select("id,content_md")
      .eq("slug", p.slug)
      .maybeSingle();

    if (existing) {
      if (existing.content_md.trim()) {
        await supabase.from("knowledge_revisions").insert({
          page_id: existing.id,
          content_md: existing.content_md,
          note: "Avant import",
        });
      }
      const { error } = await supabase
        .from("knowledge_pages")
        .update({
          content_md: p.content_md,
          ...(p.title ? { title: p.title } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      if (!error) imported++;
    } else {
      const { error } = await supabase.from("knowledge_pages").insert({
        slug: p.slug,
        title: p.title ?? p.slug,
        content_md: p.content_md,
      });
      if (!error) imported++;
    }
  }

  return NextResponse.json({ imported });
}
