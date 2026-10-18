import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { saveKnowledgePage } from "@/lib/knowledge";

/** Sauvegarde d'une fiche depuis l'éditeur (historique conservé). */
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
  const res = await saveKnowledgePage(supabase, body.slug, body.content_md, body.note ?? null);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({ ok: true });
}
