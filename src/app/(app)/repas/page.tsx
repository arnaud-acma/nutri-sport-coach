import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import MealCard, { type MealRow } from "@/components/MealCard";
import { MEAL_COLUMNS } from "@/lib/journee-db";

export const dynamic = "force-dynamic";

export default async function Repas() {
  await requireUser();
  const supabase = await createClient();
  const { data: meals } = await supabase
    .from("meals")
    .select(MEAL_COLUMNS)
    .order("eaten_at", { ascending: false })
    .limit(30)
    .returns<MealRow[]>();

  // URL signées pour les photos (bucket privé)
  const service = createServiceClient();
  const photoUrls = new Map<string, string>();
  const paths = (meals ?? [])
    .map((m) => m.photo_path)
    .filter((p): p is string => Boolean(p));
  if (paths.length) {
    const { data: signed } = await service.storage
      .from("meal-photos")
      .createSignedUrls(paths, 3600);
    signed?.forEach((s) => {
      if (s.signedUrl && s.path) photoUrls.set(s.path, s.signedUrl);
    });
  }

  // Nombre de messages échangés par repas (table absente avant la
  // migration 0002 : on ignore simplement l'erreur).
  const counts = new Map<string, number>();
  if (meals?.length) {
    const { data: msgs } = await supabase
      .from("coach_messages")
      .select("meal_id")
      .in("meal_id", meals.map((m) => m.id));
    msgs?.forEach((r) => {
      if (r.meal_id) counts.set(r.meal_id, (counts.get(r.meal_id) ?? 0) + 1);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Repas</h1>
        <Link
          href="/repas/nouveau"
          className="rounded-lg bg-accent text-white px-4 py-2 text-sm font-semibold"
        >
          + Nouveau
        </Link>
      </div>

      {!meals?.length && (
        <p className="text-sm text-muted">Aucun repas enregistré.</p>
      )}

      {meals?.map((m) => {
        const n = counts.get(m.id) ?? 0;
        return (
          <MealCard
            key={m.id}
            meal={m}
            photoUrl={m.photo_path ? (photoUrls.get(m.photo_path) ?? null) : null}
            footer={
              <Link
                href={`/repas/${m.id}`}
                className="mt-1 self-start text-sm font-semibold text-accent underline"
              >
                💬 {n ? `Discussion (${n} message${n > 1 ? "s" : ""})` : "Répondre au coach"}
              </Link>
            }
          />
        );
      })}
    </div>
  );
}
