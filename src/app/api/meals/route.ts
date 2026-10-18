import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { loadKnowledge, buildMealSystemPrompt } from "@/lib/coach/prompt";
import { getProvider } from "@/lib/llm";

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
  const mealType = String(form.get("meal_type") ?? "").slice(0, 40);

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

  // 2. Le coach lit les fiches puis analyse
  let feedback;
  try {
    const pages = await loadKnowledge();
    const provider = getProvider();
    feedback = await provider.analyzeMeal({
      systemPrompt: buildMealSystemPrompt(pages),
      note,
      mealType,
      imageBase64,
      imageMediaType,
    });
  } catch (err) {
    feedback = {
      verdict: "a_completer" as const,
      resume: "Le coach n'a pas pu analyser ce repas (erreur technique).",
      ajouts: [],
      commentaire: `Erreur : ${err instanceof Error ? err.message : "inconnue"}. Le repas est tout de même enregistré.`,
      model: "aucun",
    };
  }

  // 3. Enregistrement
  const supabase = await createClient();
  const { data: inserted, error: insErr } = await supabase.from("meals").insert({
    user_id: user.id,
    meal_type: mealType || null,
    note: note || null,
    photo_path: photoPath,
    coach_verdict: feedback.verdict,
    coach_feedback_md: JSON.stringify({
      resume: feedback.resume,
      ajouts: feedback.ajouts,
      commentaire: feedback.commentaire,
    }),
    model_used: feedback.model,
  }).select("id").single();
  if (insErr) {
    return NextResponse.json(
      { error: `Enregistrement : ${insErr.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ feedback, meal_id: inserted?.id ?? null });
}
