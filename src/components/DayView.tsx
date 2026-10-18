import Link from "next/link";
import { CATEGORIES, dayKey, frDayLabel, isCollation, macroTargets, shiftDay } from "@/lib/journee";
import { aVerifier, parseFeedback, rangeLabel, type DayData } from "@/lib/journee-db";
import DeleteStoolButton from "@/components/DeleteStoolButton";

const hhmm = (d: string) =>
  new Date(d).toLocaleTimeString("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
  });

const fmt = (n: number) => n.toLocaleString("fr-FR");

/** Barre de progression : remplissage accent sur une piste du même ton.
 *  La valeur est toujours écrite en texte (jamais la couleur seule). */
function Meter({
  label,
  value,
  detail,
  ratio,
}: {
  label: string;
  value: string;
  detail: string;
  ratio: number;
}) {
  const r = Number.isFinite(ratio) ? ratio : 0;
  const pct = Math.round(Math.min(1, Math.max(0, r)) * 100);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-semibold">{label}</span>
        <span className="tabular-nums">{value}</span>
      </div>
      <div
        className="h-2.5 rounded-full bg-accent-soft overflow-hidden"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
      {detail && <p className="text-xs text-muted">{detail}</p>}
    </div>
  );
}

/** Score du jour : anneau + nombre héros. */
function ScoreRing({ score }: { score: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const filled = (Math.min(100, Math.max(0, score)) / 100) * c;
  return (
    <div className="relative h-36 w-36 shrink-0">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="60" cy="60" r={r} fill="none" strokeWidth="10" className="stroke-accent-soft" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          className="stroke-accent"
          strokeDasharray={`${filled} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-5xl font-semibold tabular-nums leading-none">{score}</span>
        <span className="text-xs text-muted mt-1">score / 100</span>
      </div>
    </div>
  );
}

export default function DayView({ day }: { day: DayData }) {
  const { summary: s, target: t } = day;
  const mt = macroTargets(t);
  const anyAuto = mt.auto.glucides || mt.auto.lipides || mt.auto.fibres;
  const today = dayKey(new Date());
  const isToday = day.key === today;
  const prev = shiftDay(day.key, -1);
  const next = shiftDay(day.key, 1);
  const dayHref = (k: string) => (k === today ? "/" : `/jour/${k}`);
  const q = isToday ? "" : `&jour=${day.key}`;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center justify-between gap-2">
        <Link href={dayHref(prev)} className="rounded-lg border border-border px-3 py-2 text-sm" aria-label="Jour précédent">
          ←
        </Link>
        <div className="text-center">
          <h1 className="text-lg font-bold first-letter:uppercase">
            {isToday ? "Aujourd'hui" : frDayLabel(day.key)}
          </h1>
          {isToday && <p className="text-xs text-muted">{frDayLabel(day.key)}</p>}
        </div>
        {day.key < today ? (
          <Link href={dayHref(next)} className="rounded-lg border border-border px-3 py-2 text-sm" aria-label="Jour suivant">
            →
          </Link>
        ) : (
          <span className="px-3 py-2 text-sm opacity-0" aria-hidden>→</span>
        )}
      </header>

      <section className="rounded-xl border border-border bg-card p-4 flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <ScoreRing score={s.score} />
          <div className="flex flex-col gap-1 text-xs text-muted">
            <p>Énergie {s.parts.energie} / 35</p>
            <p>Protéines {s.parts.proteines} / 35</p>
            <p>Qualité {s.parts.qualite} / 20</p>
            <p>Prises {s.parts.prises} / 10</p>
          </div>
        </div>

        <Meter
          label="Énergie"
          value={`${fmt(s.kcal.mid)} / ${fmt(t.kcal)} kcal`}
          detail={
            s.prises
              ? `Estimation : ${fmt(s.kcal.min)} à ${fmt(s.kcal.max)} kcal`
              : "Rien d'enregistré pour l'instant"
          }
          ratio={s.kcal.mid / t.kcal}
        />
        <Meter
          label="Protéines"
          value={`${s.prot.mid} / ${t.proteines_g} g`}
          detail={s.prises ? `Estimation : ${s.prot.min} à ${s.prot.max} g` : "Cible du jour"}
          ratio={s.prot.mid / t.proteines_g}
        />

        <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
          <p className="text-xs text-muted">
            Hors score : glucides, lipides, fibres
            {anyAuto ? " · cibles calculées (repères ANSES adulte)" : ""}
          </p>
          <Meter
            label="Glucides"
            value={`${s.gluc.mid} / ${mt.glucides} g`}
            detail={s.prises ? `Estimation : ${s.gluc.min} à ${s.gluc.max} g` : ""}
            ratio={s.gluc.mid / mt.glucides}
          />
          <Meter
            label="Lipides"
            value={`${s.lip.mid} / ${mt.lipides} g`}
            detail={s.prises ? `Estimation : ${s.lip.min} à ${s.lip.max} g` : ""}
            ratio={s.lip.mid / mt.lipides}
          />
          <Meter
            label="Fibres"
            value={`${s.fib.mid} / ${mt.fibres} g`}
            detail={s.prises ? `Estimation très approximative : ${s.fib.min} à ${s.fib.max} g` : ""}
            ratio={s.fib.mid / mt.fibres}
          />
          {s.sansMacros > 0 && s.prises > 0 && (
            <p className="text-xs text-muted">
              {s.sansMacros} prise{s.sansMacros > 1 ? "s" : ""} sans détail glucides, lipides,
              fibres (enregistrée{s.sansMacros > 1 ? "s" : ""} avant la V1.3) : réanalyse possible
              depuis sa fiche.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-semibold">Qualité</span>
            <span className="tabular-nums">{s.categories.length} / 5 catégories</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => {
              const ok = s.categories.includes(c.key);
              return (
                <span
                  key={c.key}
                  className={`rounded-full px-2.5 py-1 text-xs border ${
                    ok ? "bg-accent-soft border-accent text-foreground" : "border-border text-muted"
                  }`}
                >
                  {ok ? "✓ " : ""}
                  {c.label}
                </span>
              );
            })}
          </div>
        </div>

        <div className="flex items-baseline justify-between text-sm">
          <span className="font-semibold">Prises</span>
          <span className="tabular-nums">
            {s.prises} / {t.prises_min} ou plus
          </span>
        </div>

        {s.nonEstimees > 0 && (
          <p className="text-xs text-muted">
            {s.nonEstimees} prise{s.nonEstimees > 1 ? "s" : ""} sans estimation (avant la V1.2 ou
            erreur d&apos;analyse) : comptée{s.nonEstimees > 1 ? "s" : ""} dans les prises
            seulement. Tu peux la réanalyser depuis sa fiche.
          </p>
        )}
        <p className="text-xs text-muted">
          Valeurs estimées par le coach, en fourchette. Cibles provisoires,
          modifiables dans Réglages.
        </p>
      </section>

      <section className="grid grid-cols-3 gap-2">
        <Link
          href={`/repas/nouveau?creneau=repas${q}`}
          className="rounded-xl bg-accent text-white text-center py-3 text-sm font-semibold"
        >
          + Repas
        </Link>
        <Link
          href={`/repas/nouveau?creneau=collation${q}`}
          className="rounded-xl border border-accent text-accent text-center py-3 text-sm font-semibold"
        >
          + Collation
        </Link>
        <Link
          href={`/selles/nouveau${isToday ? "" : `?jour=${day.key}`}`}
          className="rounded-xl border border-border text-center py-3 text-sm font-semibold"
        >
          + Selles
        </Link>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Prises de la journée</h2>
        {!day.meals.length && <p className="text-sm text-muted">Aucune prise enregistrée.</p>}
        {day.meals.map((m) => {
          const fb = parseFeedback(m.coach_feedback_md);
          return (
            <Link
              key={m.id}
              href={`/repas/${m.id}`}
              className="rounded-lg border border-border bg-card px-4 py-3 text-sm flex flex-col gap-0.5"
            >
              <span className="flex justify-between gap-2">
                <span className="font-semibold first-letter:uppercase">
                  {m.meal_type ?? "repas"}
                  {m.photo_path ? " 📷" : ""}
                </span>
                <span className="text-muted tabular-nums">{hhmm(m.eaten_at)}</span>
              </span>
              <span className="text-muted line-clamp-2">{fb.resume || m.note || ""}</span>
              <span className="text-xs tabular-nums">
                {rangeLabel(m.kcal_min, m.kcal_max, "kcal")} · protéines{" "}
                {rangeLabel(m.prot_min, m.prot_max, "g")}
                {!isCollation(m.meal_type) && m.coach_verdict === "a_completer" ? " · ➕ à compléter" : ""}
                {m.coach_verdict === "valide" ? " · ✅" : ""}
                {aVerifier(m) ? " · ⚠️ estimation à vérifier" : ""}
              </span>
            </Link>
          );
        })}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Selles</h2>
        {!day.stools.length && <p className="text-sm text-muted">Rien de noté.</p>}
        {day.stools.map((st) => (
          <div
            key={st.id}
            className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm flex items-center justify-between gap-2"
          >
            <span>
              <span className="tabular-nums text-muted">{hhmm(st.occurred_at)}</span> · Bristol{" "}
              {st.bristol}
              {st.flottent === true ? " · flottent" : st.flottent === false ? " · coulent" : ""}
              {st.note ? ` · ${st.note}` : ""}
            </span>
            <DeleteStoolButton id={st.id} />
          </div>
        ))}
      </section>
    </div>
  );
}
