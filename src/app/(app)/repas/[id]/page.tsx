import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import MealCard, { type MealRow } from "@/components/MealCard";
import CoachThread from "@/components/CoachThread";

export const dynamic = "force-dynamic";

export default async function RepasDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const { data: meal } = await supabase
    .from("meals")
    .select("id,eaten_at,meal_type,note,photo_path,coach_verdict,coach_feedback_md,model_used")
    .eq("id", id)
    .maybeSingle<MealRow>();
  if (!meal) notFound();

  let photoUrl: string | null = null;
  if (meal.photo_path) {
    const { data } = await createServiceClient()
      .storage.from("meal-photos")
      .createSignedUrl(meal.photo_path, 3600);
    photoUrl = data?.signedUrl ?? null;
  }

  return (
    <div className="flex flex-col gap-4">
      <Link href="/repas" className="text-sm text-accent underline">
        ← Tous les repas
      </Link>
      <MealCard meal={meal} photoUrl={photoUrl} />
      <h2 className="font-semibold">Discussion sur ce repas</h2>
      <CoachThread
        mealId={meal.id}
        placeholder="Ta réponse (ex. : j'avais pris du pain avant la photo / pourquoi tu dis ça ?)"
      />
    </div>
  );
}
