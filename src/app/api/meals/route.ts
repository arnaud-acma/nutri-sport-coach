import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { analyzeIntake } from "@/lib/coach/analyze";
import { SLOTS, parseEatenAt } from "@/lib/journee";

export const maxDuration = 60;

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];

export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  }

  const form = await request.formData();
  const photo = form.get("photo");
  const note = String(form.get("note") ?? "").slice(0, 2000);
  const rawType = String(form.get("meal_type") ?? "");
  const mealType = (SLOTS as readonly string[]).includes(rawType) ? rawType : "déjeuner";
  const eatenAt = parseEatenAt(form.get("eaten_at"));
  if (!eatenAt) {
    return NextResponse.json({ error: "Heure de la prise invalide" }, { status: 400 });
  }

  if (!(photo instanceof File) && !note) {
    return NextResponse.json(
      { error: "Photo ou note requise" },
      { status: 400 }
    );
  }

  // 1. Photo vers le Storage (bucket privé), si présente
  let photoPath: string | null = null;
  let imageBase64: string | undefined;
  let imageMediaType: string | undefined;

  if (photo instanceof File && photo.size > 0) {
    if (photo.size > MAX_PHOTO_BYTES) {
      return NextResponse.json(
        { error: "Photo trop lourde (8 Mo max)" },
        { status: 400 }
      );
    }
    const mediaType = ALLOWED_TYPES.includes(photo.type)
      ? photo.type
      : "image/jpeg";
    const bytes = Buffer.from(await photo.arrayBuffer());
    const ext = mediaType.split("/")[1] ?? "jpg";
    photoPath = `${user.id}/${Date.now()}.${ext}`;

    const service = createServiceClient();
    const { error: upErr } = await service.storage
      .from("meal-photos")
      .upload(photoPath, bytes, { contentType: mediaType });
    if (upErr) {
      return NextResponse.json(
        { error: `Stockage photo : ${upErr.message}` },
        { status: 500 }
      );
    }
    // HEIC non supporté par l'API vision : on envoie quand même le reste.
    if (mediaType !== "image/heic") {
      imageBase64 = bytes.toString("base64");
      imageMediaType = mediaType;
    }
  }

  // 2. Le coach lit les fiches et la journée en cours, puis estime
  const supabase = await createClient();
  const { feedback, columns } = await analyzeIntake({
    supabase,
    mealType,
    note,
    eatenAt,
    imageBase64,
    imageMediaType,
  });

  // 3. Enregistrement
  const { data: inserted, error: insErr } = await supabase
    .from("meals")
    .insert({
      user_id: user.id,
      eaten_at: eatenAt.toISOString(),
      meal_type: mealType,
      note: note || null,
      photo_path: photoPath,
      ...columns,
    })
    .select("id")
    .single();
  if (insErr) {
    return NextResponse.json(
      { error: `Enregistrement : ${insErr.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ feedback, meal_id: inserted?.id ?? null });
}

