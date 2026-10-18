import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import WeightForm from "./WeightForm";

export const dynamic = "force-dynamic";

function sparkline(values: number[], w = 320, h = 72): string {
  if (values.length < 2) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * (w - 8) + 4;
    const y = h - 8 - ((v - min) / span) * (h - 16);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return pts.join(" ");
}

export default async function Poids() {
  await requireUser();
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("weights")
    .select("id,measured_at,weight_kg,note")
    .order("measured_at", { ascending: true })
    .limit(104);

  const weights = rows ?? [];
  const values = weights.map((r) => Number(r.weight_kg));
  const last = weights.at(-1);
  const prev = weights.at(-2);
  const delta =
    last && prev ? Number(last.weight_kg) - Number(prev.weight_kg) : null;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Poids</h1>
      <p className="text-xs text-muted">
        Référence : le matin, après les toilettes, avant de manger. Une fois
        par semaine suffit.
      </p>

      <WeightForm />

      {last && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-2xl font-bold">
            {Number(last.weight_kg).toFixed(1)} kg
            {delta !== null && (
              <span
                className={`ml-2 text-sm font-semibold ${
                  delta >= 0 ? "text-accent" : "text-danger"
                }`}
              >
                {delta >= 0 ? "+" : ""}
                {delta.toFixed(1)}
              </span>
            )}
          </p>
          {values.length >= 2 && (
            <svg
              viewBox="0 0 320 72"
              className="w-full mt-2"
              role="img"
              aria-label="Courbe de poids"
            >
              <polyline
                points={sparkline(values)}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>
          )}
        </div>
      )}

      <section className="flex flex-col gap-1">
        {[...weights].reverse().map((r) => (
          <div
            key={r.id}
            className="flex justify-between text-sm border-b border-border py-2"
          >
            <span>
              {new Date(r.measured_at + "T00:00:00").toLocaleDateString(
                "fr-FR",
                { timeZone: "Europe/Paris", day: "numeric", month: "short", year: "2-digit" }
              )}
              {r.note ? ` · ${r.note}` : ""}
            </span>
            <span className="font-semibold">
              {Number(r.weight_kg).toFixed(1)} kg
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}
