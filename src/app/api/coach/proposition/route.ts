import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { applyProposal, saveKnowledgePage } from "@/lib/knowledge";
import type { KnowledgeProposal } from "@/lib/llm/types";

/** Arnaud accepte ou refuse une proposition de modification de fiche.
 *  Acceptée : la fiche est modifiée et l'ancienne version archivée. */
export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  const body = (await request.json()) as { message_id?: string; action?: string };
  if (!body.message_id || (body.action !== "accepter" && body.action !== "refuser")) {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: msg } = await supabase
    .from("coach_messages")
    .select("id,proposal,proposal_status")
    .eq("id", body.message_id)
    .maybeSingle();
  if (!msg?.proposal) {
    return NextResponse.json({ error: "Proposition introuvable" }, { status: 404 });
  }
  if (msg.proposal_status !== "proposee") {
    return NextResponse.json({ error: "Proposition déjà traitée" }, { status: 409 });
  }

  if (body.action === "accepter") {
    const p = msg.proposal as KnowledgeProposal;
    const { data: page } = await supabase
      .from("knowledge_pages")
      .select("content_md")
      .eq("slug", p.slug)
      .maybeSingle();
    if (!page) return NextResponse.json({ error: "Fiche introuvable" }, { status: 404 });
    const updated = applyProposal(page.content_md, p.ancien_texte, p.nouveau_texte);
    if (updated === null) {
      return NextResponse.json(
        {
          error:
            "Le passage à remplacer n'existe plus dans la fiche (elle a changé). " +
            "Refuse cette proposition et redemande au coach.",
        },
        { status: 409 }
      );
    }
    const res = await saveKnowledgePage(
      supabase,
      p.slug,
      updated,
      `Proposition du coach acceptée : ${p.raison}`
    );
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  }

  const { error } = await supabase
    .from("coach_messages")
    .update({ proposal_status: body.action === "accepter" ? "acceptee" : "refusee" })
    .eq("id", msg.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
