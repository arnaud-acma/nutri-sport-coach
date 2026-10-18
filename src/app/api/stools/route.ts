import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseEatenAt } from "@/lib/journee";

const UUID = /^[0-9a-f-]{36}$/i;

/** Journal des selles (décision 17) : type de Bristol, flottent, remarque. */
export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  const body = (await request.json()) as {
    occurred_at?: string;
    bristol?: number;
    flottent?: boolean | null;
    note?: string;
  };
  const bristol = Number(body.bristol);
  if (!Number.isInteger(bristol) || bristol < 1 || bristol > 7) {
    return NextResponse.json({ error: "Type de Bristol invalide (1 à 7)" }, { status: 400 });
  }
  const at = parseEatenAt(body.occurred_at);
  if (!at) return NextResponse.json({ error: "Heure invalide" }, { status: 400 });

  const supabase = await createClient();
  const { error } = await supabase.from("stools").insert({
    user_id: user.id,
    occurred_at: at.toISOString(),
    bristol,
    flottent: typeof body.flottent === "boolean" ? body.flottent : null,
    note: body.note?.trim().slice(0, 500) || null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!UUID.test(id)) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
  const supabase = await createClient();
  const { error } = await supabase.from("stools").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
