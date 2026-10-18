import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function frDate(d: string | Date): string {
  return new Date(d).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris",
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export default async function Home() {
  const user = await requireUser();
  const supabase = await createClient();

  const [{ data: lastWeight }, { data: lastMeals }, { count: pagesFilled }] =
    await Promise.all([
      supabase
        .from("weights")
        .select("measured_at,weight_kg")
        .order("measured_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("meals")
        .select("id,eaten_at,meal_type,coach_verdict")
        .order("eaten_at", { ascending: false })
        .limit(3),
      supabase
        .from("knowledge_pages")
        .select("id", { count: "exact", head: true })
        .neq("content_md", ""),
    ]);

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold">Salut Arnaud</h1>
        <p className="text-sm text-muted">{user.email}</p>
      </header>

      <Link
        href="/repas/nouveau"
        className="rounded-xl bg-accent text-white text-center py-4 font-semibold text-lg"
      >
        📷 Photographier un repas
      </Link>

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted">Dernière pesée</p>
          {lastWeight ? (
            <>
              <p className="text-2xl font-bold">{lastWeight.weight_kg} kg</p>
              <p className="text-xs text-muted">
                {frDate(lastWeight.measured_at)}
              </p>
            </>
          ) : (
            <p className="text-sm mt-1">
              Aucune.{" "}
              <Link href="/poids" className="text-accent underline">
                Saisir
              </Link>
            </p>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted">Fiches remplies</p>
          <p className="text-2xl font-bold">{pagesFilled ?? 0} / 5</p>
          <Link href="/connaissance" className="text-xs text-accent underline">
            Voir les fiches
          </Link>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Derniers repas</h2>
        {!lastMeals?.length && (
          <p className="text-sm text-muted">
            Aucun repas enregistré pour l&apos;instant.
          </p>
        )}
        {lastMeals?.map((m) => (
          <Link
            key={m.id}
            href={`/repas#${m.id}`}
            className="rounded-lg border border-border bg-card px-4 py-3 text-sm flex justify-between"
          >
            <span>
              {m.meal_type ?? "Repas"} · {frDate(m.eaten_at)}
            </span>
            <span>
              {m.coach_verdict === "valide"
                ? "✅"
                : m.coach_verdict === "a_completer"
                  ? "➕"
                  : "🧪"}
            </span>
          </Link>
        ))}
      </section>
    </div>
  );
}
