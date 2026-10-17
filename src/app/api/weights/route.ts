import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  }
  const body = (await request.json()) as {
    measured_at?: string;
    weight_kg?: string | number;
    note?: string;
  };

  const kg = Number(body.weight_kg);
  if (!body.measured_at || !Number.isFinite(kg) || kg < 30 || kg > 200) {
    return NextResponse.json({ error: "Poids invalide" }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.from("weights").upsert(
    {
      user_id: user.id,
      measured_at: body.measured_at,
      weight_kg: kg,
      note: body.note?.slice(0, 300) || null,
    },
    { onConflict: "user_id,measured_at" }
  );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
