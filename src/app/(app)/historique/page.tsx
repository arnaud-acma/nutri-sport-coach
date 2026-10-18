import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dayBounds, dayKey, groupByDay, shiftDay, summarizeDay, targetFor } from "@/lib/journee";
import { loadMealsBetween, loadStoolsBetween, loadTargets } from "@/lib/journee-db";

export const dynamic = "force-dynamic";

const DAYS = 30;

const shortLabel = (k: string) =>
  new Date(`${k}T12:00:00Z`).toLocaleDateString("fr-FR", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  });

/** Historique jour par jour : score, énergie, protéines, prises, selles. */
export default async function Historique() {
  await requireUser();
  const supabase = await createClient();
  const today = dayKey(new Date());
  const first = shiftDay(today, -(DAYS - 1));
  const start = dayBounds(first).start;
  const end = dayBounds(today).end;
  const [targets, meals, stools] = await Promise.all([
    loadTargets(supabase),
    loadMealsBetween(supabase, start, end),
    loadStoolsBetween(supabase, start, end),
  ]);
  const byDay = groupByDay(meals);
  const stoolsByDay = groupByDay(stools.map((s) => ({ ...s, eaten_at: s.occurred_at })));

  const rows = Array.from({ length: DAYS }, (_, i) => {
    const key = shiftDay(today, -i);
    const target = targetFor(key, targets);
    return {
      key,
      target,
      s: summarizeDay(byDay.get(key) ?? [], target),
      stools: stoolsByDay.get(key) ?? [],
    };
  });

  // Moyenne sur les 7 dernières journées complètes (hors aujourd'hui).
  const last7 = rows.slice(1, 8).filter((r) => r.s.prises > 0);
  const avg = (f: (r: (typeof rows)[number]) => number) =>
    last7.length ? Math.round(last7.reduce((a, r) => a + f(r), 0) / last7.length) : null;
  const avgScore = avg((r) => r.s.score);
  const avgKcal = avg((r) => r.s.kcal.mid);
  const avgProt = avg((r) => r.s.prot.mid);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Historique</h1>

      <section className="rounded-xl border border-border bg-card p-4 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-xs text-muted">Score moyen</p>
          <p className="text-2xl font-semibold tabular-nums">{avgScore ?? "–"}</p>
        </div>
        <div>
          <p className="text-xs text-muted">kcal / jour</p>
          <p className="text-2xl font-semibold tabular-nums">
            {avgKcal != null ? avgKcal.toLocaleString("fr-FR") : "–"}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted">Protéines</p>
          <p className="text-2xl font-semibold tabular-nums">{avgProt != null ? `${avgProt} g` : "–"}</p>
        </div>
        <p className="col-span-3 text-xs text-muted">
          Moyennes des 7 dernières journées renseignées (hors aujourd&apos;hui), estimées.
        </p>
      </section>

      <ul className="flex flex-col gap-2">
        {rows.map(({ key, s, target, stools: st }) => (
          <li key={key}>
            <Link
              href={key === today ? "/" : `/jour/${key}`}
              className="rounded-lg border border-border bg-card px-4 py-3 flex flex-col gap-1.5"
            >
              <span className="flex items-baseline justify-between text-sm">
                <span className="font-semibold first-letter:uppercase">
                  {key === today ? "Aujourd'hui" : shortLabel(key)}
                </span>
                <span className="tabular-nums">
                  {s.prises ? `${s.score} / 100` : "rien de noté"}
                </span>
              </span>
              {s.prises > 0 && (
                <>
                  <span className="h-2 rounded-full bg-accent-soft overflow-hidden" aria-hidden>
                    <span className="block h-full rounded-full bg-accent" style={{ width: `${s.score}%` }} />
                  </span>
                  <span className="text-xs text-muted tabular-nums">
                    {s.kcal.mid.toLocaleString("fr-FR")} / {target.kcal.toLocaleString("fr-FR")} kcal ·{" "}
                    {s.prot.mid} / {target.proteines_g} g · {s.prises} prise{s.prises > 1 ? "s" : ""} ·{" "}
                    {s.categories.length}/5 catégories
                    {st.length ? ` · selles : ${st.map((x) => `B${x.bristol}${x.flottent ? " flott." : ""}`).join(", ")}` : ""}
                  </span>
                </>
              )}
            </Link>
          </li>
        ))}
      </ul>
      <Link href="/repas" className="text-sm text-accent underline self-start">
        Toutes les prises avec photos
      </Link>
    </div>
  );
}
