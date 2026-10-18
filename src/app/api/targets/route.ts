import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dayKey, isDayKey } from "@/lib/journee";

/** Nouvelle cible datée (décision 12). Une cible par date : enregistrer
 *  deux fois le même jour remplace la première. Les journées passées
 *  gardent la cible en vigueur à leur date. */
export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  const body = (await request.json()) as {
    valid_from?: string;
    kcal?: number | string;
    proteines_g?: number | string;
    prises_min?: number | string;
    glucides_g?: number | string | null;
    lipides_g?: number | string | null;
    fibres_g?: number | string | null;
    note?: string;
  };
  const validFrom = body.valid_from || dayKey(new Date());
  const kcal = Number(body.kcal);
  const prot = Number(body.proteines_g);
  const prises = Number(body.prises_min ?? 5);
  if (!isDayKey(validFrom)) {
    return NextResponse.json({ error: "Date invalide" }, { status: 400 });
  }
  if (!Number.isFinite(kcal) || kcal < 1200 || kcal > 6000) {
    return NextResponse.json({ error: "Calories entre 1 200 et 6 000" }, { status: 400 });
  }
  if (!Number.isFinite(prot) || prot < 30 || prot > 300) {
    return NextResponse.json({ error: "Protéines entre 30 et 300 g" }, { status: 400 });
  }
  if (!Number.isInteger(prises) || prises < 1 || prises > 10) {
    return NextResponse.json({ error: "Prises entre 1 et 10" }, { status: 400 });
  }

  // Champ vide = calcul automatique (décision 20) : stocké null.
  const optional = (v: unknown, min: number, max: number, label: string) => {
    if (v == null || String(v).trim() === "") return { value: null };
    const n = Number(String(v).replace(",", "."));
    if (!Number.isFinite(n) || n < min || n > max) return { error: `${label} entre ${min} et ${max} g, ou vide` };
    return { value: Math.round(n) };
  };
  const gluc = optional(body.glucides_g, 50, 900, "Glucides");
  const lip = optional(body.lipides_g, 20, 400, "Lipides");
  const fib = optional(body.fibres_g, 5, 100, "Fibres");
  for (const r of [gluc, lip, fib]) {
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.from("nutrition_targets").upsert(
    {
      user_id: user.id,
      valid_from: validFrom,
      kcal: Math.round(kcal),
      proteines_g: Math.round(prot),
      prises_min: prises,
      glucides_g: "value" in gluc ? gluc.value : null,
      lipides_g: "value" in lip ? lip.value : null,
      fibres_g: "value" in fib ? fib.value : null,
      note: body.note?.trim().slice(0, 300) || null,
    },
    { onConflict: "user_id,valid_from" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
