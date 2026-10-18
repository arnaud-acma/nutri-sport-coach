import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import MealCard, { type MealRow } from "@/components/MealCard";
import { MEAL_COLUMNS } from "@/lib/journee-db";
import CoachThread from "@/components/CoachThread";
import MealEditor from "./MealEditor";
import { dayKey, isCollation, toParisInputValue } from "@/lib/journee";

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
    .select(MEAL_COLUMNS)
    .eq("id", id)
    .maybeSingle<MealRow>();
  if (!meal) notFound();

  const key = dayKey(new Date(meal.eaten_at));
  const dayHref = key === dayKey(new Date()) ? "/" : `/jour/${key}`;

  let photoUrl: string | null = null;
  if (meal.photo_path) {
    const { data } = await createServiceClient()
      .storage.from("meal-photos")
      .createSignedUrl(meal.photo_path, 3600);
    photoUrl = data?.signedUrl ?? null;
  }

  return (
    <div className="flex flex-col gap-4">
      <Link href={dayHref} className="text-sm text-accent underline">
        ← Journée
      </Link>
      <MealCard meal={meal} photoUrl={photoUrl} />
      <MealEditor
        id={meal.id}
        mealType={meal.meal_type ?? "déjeuner"}
        time={toParisInputValue(new Date(meal.eaten_at))}
        note={meal.note ?? ""}
        hasPhoto={Boolean(meal.photo_path)}
      />
      <h2 className="font-semibold">
        Discussion sur {isCollation(meal.meal_type) ? "cette collation" : "ce repas"}
      </h2>
      <CoachThread
        mealId={meal.id}
        placeholder="Ta réponse (ex. : j'avais pris du pain avant la photo / pourquoi tu dis ça ?)"
      />
    </div>
  );
}
