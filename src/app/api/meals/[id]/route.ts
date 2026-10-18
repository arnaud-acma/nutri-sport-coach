import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { analyzeIntake } from "@/lib/coach/analyze";
import { SLOTS, parseEatenAt } from "@/lib/journee";

export const maxDuration = 60;

const UUID = /^[0-9a-f-]{36}$/i;

/** Modifie une prise : créneau, heure, note. Avec `reanalyze: true`, le
 *  coach refait son estimation (photo d'origine + note à jour). */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });

  const body = (await request.json()) as {
    meal_type?: string;
    eaten_at?: string;
    note?: string;
    reanalyze?: boolean;
  };

  const supabase = await createClient();
  const { data: meal, error: readErr } = await supabase
    .from("meals")
    .select("id,eaten_at,meal_type,note,photo_path")
    .eq("id", id)
    .maybeSingle();
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });
  if (!meal) return NextResponse.json({ error: "Prise introuvable" }, { status: 404 });

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.meal_type !== undefined) {
    if (!(SLOTS as readonly string[]).includes(body.meal_type)) {
      return NextResponse.json({ error: "Créneau invalide" }, { status: 400 });
    }
    update.meal_type = body.meal_type;
  }
  // L'heure n'est contrôlée (et changée) que si elle a vraiment bougé :
  // le formulaire travaille à la minute, la base garde les secondes.
  const minute = (v: string) => Math.floor(new Date(v).getTime() / 60000);
  if (body.eaten_at !== undefined && minute(body.eaten_at) !== minute(meal.eaten_at)) {
    const d = parseEatenAt(body.eaten_at);
    if (!d) return NextResponse.json({ error: "Heure invalide" }, { status: 400 });
    update.eaten_at = d.toISOString();
  }
  if (body.note !== undefined) update.note = body.note.trim().slice(0, 2000) || null;

  if (body.reanalyze) {
    const mealType = (update.meal_type as string) ?? meal.meal_type ?? "déjeuner";
    const note = update.note !== undefined ? ((update.note as string | null) ?? "") : (meal.note ?? "");
    let imageBase64: string | undefined;
    let imageMediaType: string | undefined;
    if (meal.photo_path && !meal.photo_path.endsWith(".heic")) {
      const { data: blob } = await createServiceClient()
        .storage.from("meal-photos")
        .download(meal.photo_path);
      if (blob) {
        imageBase64 = Buffer.from(await blob.arrayBuffer()).toString("base64");
        imageMediaType = meal.photo_path.endsWith(".png")
          ? "image/png"
          : meal.photo_path.endsWith(".webp")
            ? "image/webp"
            : "image/jpeg";
      }
    }
    if (!imageBase64 && !note) {
      return NextResponse.json(
        { error: "Rien à analyser : ni photo ni note" },
        { status: 400 }
      );
    }
    const { columns } = await analyzeIntake({
      supabase,
      mealType,
      note,
      eatenAt: new Date((update.eaten_at as string) ?? meal.eaten_at),
      imageBase64,
      imageMediaType,
      excludeMealId: id,
    });
    Object.assign(update, columns);
  }

  const { error } = await supabase.from("meals").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** Supprime une prise, sa photo et son fil de discussion. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });

  const supabase = await createClient();
  const { data: meal } = await supabase
    .from("meals")
    .select("photo_path")
    .eq("id", id)
    .maybeSingle();
  if (!meal) return NextResponse.json({ error: "Prise introuvable" }, { status: 404 });

  // La discussion liée part avec la prise (on delete cascade).
  const { error } = await supabase.from("meals").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (meal.photo_path) {
    // Échec non bloquant : au pire une photo orpheline reste dans le Storage.
    await createServiceClient().storage.from("meal-photos").remove([meal.photo_path]);
  }
  return NextResponse.json({ ok: true });
}
