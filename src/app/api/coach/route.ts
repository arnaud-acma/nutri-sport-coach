import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadKnowledge, buildChatSystemPrompt } from "@/lib/coach/prompt";
import { buildCoachContext } from "@/lib/coach/context";
import { getProvider } from "@/lib/llm";
import type { ChatTurn } from "@/lib/llm/types";

export const maxDuration = 60;

const HISTORY_LIMIT = 20;
const UUID = /^[0-9a-f-]{36}$/i;

const COLUMNS =
  "id,meal_id,role,content_md,proposal,proposal_status,model_used,created_at";

/** Fil de discussion : ?meal_id=<uuid> pour un repas, sans paramètre pour
 *  la discussion libre (onglet Coach). */
export async function GET(request: Request) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  const mealId = new URL(request.url).searchParams.get("meal_id");
  if (mealId && !UUID.test(mealId)) {
    return NextResponse.json({ error: "meal_id invalide" }, { status: 400 });
  }
  const supabase = await createClient();
  let q = supabase.from("coach_messages").select(COLUMNS).order("created_at");
  q = mealId ? q.eq("meal_id", mealId) : q.is("meal_id", null);
  const { data, error } = await q.limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ messages: data ?? [] });
}

/** Arnaud écrit au coach ; on enregistre sa question puis la réponse. */
export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  const body = (await request.json()) as { meal_id?: string | null; message?: string };
  const message = (body.message ?? "").trim().slice(0, 4000);
  const mealId = body.meal_id || null;
  if (!message) return NextResponse.json({ error: "Message vide" }, { status: 400 });
  if (mealId && !UUID.test(mealId)) {
    return NextResponse.json({ error: "meal_id invalide" }, { status: 400 });
  }

  const supabase = await createClient();

  const { error: insErr } = await supabase.from("coach_messages").insert({
    user_id: user.id,
    meal_id: mealId,
    role: "user",
    content_md: message,
  });
  if (insErr) {
    return NextResponse.json({ error: `Enregistrement : ${insErr.message}` }, { status: 500 });
  }

  // Historique du fil (le message qu'on vient d'insérer est le dernier).
  let hq = supabase
    .from("coach_messages")
    .select("role,content_md,proposal,proposal_status")
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);
  hq = mealId ? hq.eq("meal_id", mealId) : hq.is("meal_id", null);
  const { data: history } = await hq;
  const turns: ChatTurn[] = mergeTurns(
    [...(history ?? [])].reverse().map((h) => ({
      role: h.role as ChatTurn["role"],
      content:
        h.content_md +
        (h.proposal
          ? `\n\n[Proposition de modification de la fiche « ${(h.proposal as { slug?: string }).slug} » : ${h.proposal_status ?? "proposee"}]`
          : ""),
    }))
  );

  let reply;
  try {
    const [pages, context] = await Promise.all([
      loadKnowledge(),
      buildCoachContext(supabase, mealId),
    ]);
    reply = await getProvider().chat({
      systemPrompt: buildChatSystemPrompt(pages, context),
      turns,
    });
  } catch (err) {
    reply = {
      text: `Le coach n'a pas pu répondre (erreur technique) : ${err instanceof Error ? err.message : "inconnue"}`,
      proposal: null,
      model: "aucun",
    };
  }

  const { error: repErr } = await supabase.from("coach_messages").insert({
    user_id: user.id,
    meal_id: mealId,
    role: "assistant",
    content_md: reply.text,
    proposal: reply.proposal,
    proposal_status: reply.proposal ? "proposee" : null,
    model_used: reply.model,
  });
  if (repErr) {
    return NextResponse.json({ error: `Enregistrement : ${repErr.message}` }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

/** L'API exige une alternance stricte user/assistant commençant par user :
 *  on fusionne les messages consécutifs du même rôle et on retire un
 *  éventuel assistant en tête (historique tronqué). */
function mergeTurns(turns: ChatTurn[]): ChatTurn[] {
  const out: ChatTurn[] = [];
  for (const t of turns) {
    const last = out[out.length - 1];
    if (last && last.role === t.role) last.content += `\n\n${t.content}`;
    else out.push({ ...t });
  }
  while (out.length && out[0].role !== "user") out.shift();
  return out;
}
